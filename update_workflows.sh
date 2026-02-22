#!/bin/bash
# ============================================
# Yauno Bestellsystem – Workflow Update Script
# ============================================
# Aktualisiert die Workflows 02, 04, 05 in n8n
# (URLs jetzt über $env.N8N_BASE_URL)
#
# Ausführen auf dem n8n-Server:
#   chmod +x update_workflows.sh
#   ./update_workflows.sh
# ============================================

N8N_URL="http://localhost:5678"
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDFlYjNkYi1mOGRkLTRhZmEtODEzZS1lYzRmNTBhZGZmN2MiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzgwYTE0YzItNmYyYi00MjI4LTgzN2YtYTdhMDc1MjI5NTM1IiwiaWF0IjoxNzcxNzUyOTg0LCJleHAiOjE3NzQzMDY4MDB9.7zyzXBWexrzZGy7Mj7eLwwbN6fuNBqck4M_W5Qz4FSo"

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

# 1) API-Verbindung testen
echo -n "Teste n8n API-Verbindung... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  echo "  n8n läuft nicht oder API Key ungültig."
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

WF02_ID=$(find_workflow_id "02 - Artikel API")
WF04_ID=$(find_workflow_id "04 - Bestellschluss & Auswertung")
WF05_ID=$(find_workflow_id "05 - Bestellung laden (Token)")

echo ""

# 3) Workflows aktualisieren oder neu erstellen
update_or_create_workflow() {
  local wf_file="$1"
  local wf_id="$2"
  local wf_name="$3"

  if [ ! -f "$wf_file" ]; then
    echo -e "  ${RED}✗${NC} $wf_name – Datei nicht gefunden: $wf_file"
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
    echo -e "  ${RED}✗${NC} $wf_name – JSON-Fehler"
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
      echo -e "  ${GREEN}✓${NC} $wf_name (ID: $RESULT_ID) – aktualisiert"
    else
      echo -e "  ${GREEN}✓${NC} $wf_name (ID: $RESULT_ID) – neu erstellt"
    fi
  else
    echo -e "  ${RED}✗${NC} $wf_name – Fehler (HTTP $HTTP_CODE)"
    echo "    $(echo "$BODY" | head -1)"
  fi
}

echo "Aktualisiere Workflows..."
echo ""
update_or_create_workflow "$SCRIPT_DIR/workflows/workflow_02_artikel_api.json" "$WF02_ID" "02 - Artikel API"
update_or_create_workflow "$SCRIPT_DIR/workflows/workflow_04_abschluss.json" "$WF04_ID" "04 - Bestellschluss & Auswertung"
update_or_create_workflow "$SCRIPT_DIR/workflows/workflow_05_get_order.json" "$WF05_ID" "05 - Bestellung laden (Token)"

echo ""
echo "=========================================="
echo -e "${GREEN}Update abgeschlossen!${NC}"
echo "=========================================="
echo ""
echo -e "${YELLOW}WICHTIG:${NC} Stelle sicher, dass die Umgebungsvariable N8N_BASE_URL gesetzt ist:"
echo "  docker stop <container> && docker run -e N8N_BASE_URL=https://DEINE-URL.trycloudflare.com ..."
echo ""
echo "  Oder nachträglich prüfen:"
echo "  docker exec <container> printenv N8N_BASE_URL"
echo ""
