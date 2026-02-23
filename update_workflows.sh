#!/bin/bash
# ============================================
# Yauno Bestellsystem – Workflow Update Script
# ============================================
# Aktualisiert bestehende Workflows in n8n
# (findet Workflows anhand des Namens).
#
# Voraussetzungen:
#   export N8N_BASE_URL="https://deine-url.trycloudflare.com"
#   export N8N_API_KEY="dein-api-key"
#
# Ausführen:
#   chmod +x update_workflows.sh
#   ./update_workflows.sh
# ============================================

# Konfiguration aus Umgebungsvariablen
N8N_URL="${N8N_BASE_URL:-http://localhost:5678}"
API_KEY="${N8N_API_KEY:-}"

if [ -z "$API_KEY" ]; then
  echo "FEHLER: N8N_API_KEY Umgebungsvariable ist nicht gesetzt."
  echo ""
  echo "Setze sie mit:"
  echo "  export N8N_API_KEY=\"dein-api-key\""
  echo ""
  echo "API Key erstellen: n8n -> Settings -> API -> Create API Key"
  exit 1
fi

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "=========================================="
echo "  Yauno Bestellsystem – Workflow Update"
echo "=========================================="
echo ""
echo "n8n URL: $N8N_URL"
echo ""

# 1) API-Verbindung testen
echo -n "Teste n8n API-Verbindung... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  echo "  n8n laeuft nicht oder API Key ungueltig."
  exit 1
fi
echo -e "${GREEN}OK${NC}"

# 2) Bestehende Workflows auflisten und IDs finden
echo ""
echo "Suche bestehende Workflows..."
WORKFLOWS_JSON=$(curl -s \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

# Workflow-IDs anhand der Namen finden
find_workflow_id() {
  local name="$1"
  echo "$WORKFLOWS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for wf in data.get('data', []):
    if wf.get('name') == '$name':
        print(wf['id'])
        break
" 2>/dev/null
}

# Mapping: Dateiname -> Workflow-Name in n8n
declare -A WF_MAP
WF_MAP["workflow_01_excel_import.json"]="01 - Excel Import & Benachrichtigung"
WF_MAP["workflow_02_artikel_api.json"]="02 - Artikel API"
WF_MAP["workflow_03_bestellung_v2.json"]="03 - Bestellung speichern"
WF_MAP["workflow_04_abschluss.json"]="04 - Bestellschluss & Auswertung"
WF_MAP["workflow_05_get_order.json"]="05 - Bestellung laden (Token)"

# 3) Workflows aktualisieren oder neu erstellen
update_or_create_workflow() {
  local wf_file="$1"
  local wf_id="$2"
  local wf_name="$3"

  if [ ! -f "$wf_file" ]; then
    echo -e "  ${RED}x${NC} $wf_name – Datei nicht gefunden: $wf_file"
    return 1
  fi

  # tags-Feld entfernen (nicht erlaubt bei API-Upload)
  local PAYLOAD=$(python3 -c "
import json, sys
with open('$wf_file') as f:
    wf = json.load(f)
wf.pop('tags', None)
json.dump(wf, sys.stdout)
" 2>/dev/null)

  if [ -z "$PAYLOAD" ]; then
    echo -e "  ${RED}x${NC} $wf_name – JSON-Fehler"
    return 1
  fi

  if [ -n "$wf_id" ]; then
    # Update bestehenden Workflow
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X PUT \
      -H "X-N8N-API-KEY: $API_KEY" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      "$N8N_URL/api/v1/workflows/$wf_id" 2>/dev/null)
  else
    # Neu erstellen
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X POST \
      -H "X-N8N-API-KEY: $API_KEY" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      "$N8N_URL/api/v1/workflows" 2>/dev/null)
  fi

  local HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  local BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    local RESULT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
    if [ -n "$wf_id" ]; then
      echo -e "  ${GREEN}OK${NC} $wf_name (ID: $RESULT_ID) – aktualisiert"
    else
      echo -e "  ${GREEN}OK${NC} $wf_name (ID: $RESULT_ID) – neu erstellt"
    fi
  else
    echo -e "  ${RED}x${NC} $wf_name – Fehler (HTTP $HTTP_CODE)"
    echo "    $(echo "$BODY" | head -1)"
  fi
}

echo ""
echo "Aktualisiere Workflows..."
echo ""

for WF_FILE in "${!WF_MAP[@]}"; do
  WF_NAME="${WF_MAP[$WF_FILE]}"
  WF_ID=$(find_workflow_id "$WF_NAME")
  update_or_create_workflow "$SCRIPT_DIR/workflows/$WF_FILE" "$WF_ID" "$WF_NAME"
done

echo ""
echo "=========================================="
echo -e "${GREEN}Update abgeschlossen!${NC}"
echo "=========================================="
echo ""
echo -e "${YELLOW}WICHTIG:${NC} Stelle sicher, dass die Umgebungsvariable N8N_BASE_URL gesetzt ist:"
echo "  docker run -e N8N_BASE_URL=$N8N_URL ..."
echo ""
