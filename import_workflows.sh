#!/bin/bash
# ============================================
# Yauno Bestellsystem – n8n Workflow Import
# ============================================
# Importiert alle 5 Workflows in deine n8n-Instanz.
#
# Voraussetzungen:
#   export N8N_BASE_URL="https://deine-url.trycloudflare.com"
#   export N8N_API_KEY="dein-api-key"
#
# Ausführen:
#   chmod +x import_workflows.sh
#   ./import_workflows.sh
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

# Farben
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "=========================================="
echo "  Yauno Bestellsystem – Workflow Import"
echo "=========================================="
echo ""
echo "n8n URL: $N8N_URL"
echo ""

# API-Verbindung testen
echo -n "Teste n8n API-Verbindung... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  echo ""
  echo "Moegliche Ursachen:"
  echo "  - n8n laeuft nicht (starte mit: n8n start)"
  echo "  - API Key ist ungueltig"
  echo "  - API ist deaktiviert (N8N_PUBLIC_API_DISABLED=false)"
  exit 1
fi
echo -e "${GREEN}OK${NC}"
echo ""

# Alle 5 Workflows importieren
WORKFLOW_FILES=(
  "workflow_01_excel_import.json"
  "workflow_02_artikel_api.json"
  "workflow_03_bestellung_v2.json"
  "workflow_04_abschluss.json"
  "workflow_05_get_order.json"
)

WORKFLOW_NAMES=(
  "01 - Excel Import & Benachrichtigung"
  "02 - Artikel API"
  "03 - Bestellung speichern"
  "04 - Bestellschluss & Auswertung"
  "05 - Bestellung laden (Token)"
)

SUCCESS=0
ERRORS=0

echo "Importiere Workflows..."
echo ""

for i in "${!WORKFLOW_FILES[@]}"; do
  WF_FILE="$SCRIPT_DIR/workflows/${WORKFLOW_FILES[$i]}"
  WF_NAME="${WORKFLOW_NAMES[$i]}"

  if [ ! -f "$WF_FILE" ]; then
    echo -e "  ${RED}x${NC} $WF_NAME – Datei nicht gefunden"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # tags-Feld entfernen (nicht erlaubt bei API-Upload)
  PAYLOAD=$(python3 -c "
import json, sys
with open('$WF_FILE') as f:
    wf = json.load(f)
wf.pop('tags', None)
json.dump(wf, sys.stdout)
" 2>/dev/null)

  if [ -z "$PAYLOAD" ]; then
    echo -e "  ${RED}x${NC} $WF_NAME – JSON-Fehler"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$N8N_URL/api/v1/workflows" 2>/dev/null)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    WF_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
    echo -e "  ${GREEN}OK${NC} $WF_NAME (ID: $WF_ID)"
    SUCCESS=$((SUCCESS + 1))
  else
    echo -e "  ${RED}x${NC} $WF_NAME – Fehler (HTTP $HTTP_CODE)"
    echo "    $(echo "$BODY" | head -1)"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}Alle $SUCCESS Workflows erfolgreich importiert!${NC}"
else
  echo -e "${YELLOW}$SUCCESS OK, $ERRORS Fehler${NC}"
fi
echo "=========================================="
echo ""
echo "Naechste Schritte:"
echo "  1. Oeffne n8n: $N8N_URL"
echo "  2. Alle Workflows aktivieren (Toggle oben rechts)"
echo "  3. Telegram Credentials pruefen"
echo "  4. N8N_BASE_URL Umgebungsvariable setzen:"
echo "     docker run -e N8N_BASE_URL=$N8N_URL ..."
echo ""
