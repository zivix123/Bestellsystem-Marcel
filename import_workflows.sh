#!/bin/bash
# ============================================
# Yauno Bestellsystem – n8n Workflow Import
# ============================================
# Importiert den Komplett-Workflow in deine n8n-Instanz.
# Bestehende Workflows werden NICHT angetastet.
#
# Voraussetzungen:
#   export N8N_BASE_URL="https://yauno-n8n.duckdns.org"
#   export N8N_API_KEY="dein-api-key"
#
# Ausfuehren:
#   chmod +x import_workflows.sh
#   ./import_workflows.sh
# ============================================

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
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF_FILE="$SCRIPT_DIR/workflows/workflow_komplett.json"

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

if [ ! -f "$WF_FILE" ]; then
  echo -e "${RED}FEHLER:${NC} workflow_komplett.json nicht gefunden!"
  exit 1
fi

echo ""
echo "Importiere Yauno Bestellsystem (Komplett-Workflow)..."

# tags und _comment Felder entfernen (nicht erlaubt bei API-Upload)
PAYLOAD=$(python3 -c "
import json, sys
with open('$WF_FILE') as f:
    wf = json.load(f)
wf.pop('tags', None)
wf['nodes'] = [n for n in wf['nodes'] if '_comment' not in n]
json.dump(wf, sys.stdout)
" 2>/dev/null)

if [ -z "$PAYLOAD" ]; then
  echo -e "${RED}FEHLER:${NC} JSON konnte nicht verarbeitet werden"
  exit 1
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
  echo -e "  ${GREEN}OK${NC} Yauno Bestellsystem (ID: $WF_ID)"
  echo ""
  echo "=========================================="
  echo -e "${GREEN}Import erfolgreich!${NC}"
  echo "=========================================="
  echo ""
  echo "Naechste Schritte:"
  echo "  1. Oeffne n8n: $N8N_URL"
  echo "  2. Workflow 'Yauno Bestellsystem' aktivieren (Toggle oben rechts)"
  echo "  3. Telegram Credentials pruefen"
  echo "  4. Static Data pruefen: webapp_url"
else
  echo -e "  ${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  echo "  $(echo "$BODY" | head -3)"
  echo ""
  echo "=========================================="
  echo -e "${RED}Import fehlgeschlagen.${NC}"
  echo "=========================================="
fi
echo ""
