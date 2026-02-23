#!/bin/bash
# ============================================
# Yauno Bestellsystem – Workflow Update Script
# ============================================
# Findet den bestehenden "Yauno Bestellsystem" Workflow
# in n8n und aktualisiert ihn mit der lokalen Version.
# Bestehende andere Workflows werden NICHT angetastet.
#
# Voraussetzungen:
#   export N8N_BASE_URL="https://yauno-n8n.duckdns.org"
#   export N8N_API_KEY="dein-api-key"
#
# Ausfuehren:
#   chmod +x update_workflows.sh
#   ./update_workflows.sh
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
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF_FILE="$SCRIPT_DIR/workflows/workflow_komplett.json"

echo ""
echo "=========================================="
echo "  Yauno Bestellsystem – Workflow Update"
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
  echo "  n8n laeuft nicht oder API Key ungueltig."
  exit 1
fi
echo -e "${GREEN}OK${NC}"

if [ ! -f "$WF_FILE" ]; then
  echo -e "${RED}FEHLER:${NC} workflow_komplett.json nicht gefunden!"
  exit 1
fi

# Bestehenden Workflow suchen
echo ""
echo "Suche 'Yauno Bestellsystem' Workflow..."
WORKFLOWS_JSON=$(curl -s \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

WF_ID=$(echo "$WORKFLOWS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for wf in data.get('data', []):
    if wf.get('name') == 'Yauno Bestellsystem':
        print(wf['id'])
        break
" 2>/dev/null)

# Payload vorbereiten
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

if [ -n "$WF_ID" ]; then
  echo "  Gefunden (ID: $WF_ID) – aktualisiere..."
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X PUT \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$N8N_URL/api/v1/workflows/$WF_ID" 2>/dev/null)
else
  echo -e "  ${YELLOW}Nicht gefunden${NC} – erstelle neu..."
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$N8N_URL/api/v1/workflows" 2>/dev/null)
fi

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  RESULT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  if [ -n "$WF_ID" ]; then
    echo -e "  ${GREEN}OK${NC} Yauno Bestellsystem (ID: $RESULT_ID) – aktualisiert"
  else
    echo -e "  ${GREEN}OK${NC} Yauno Bestellsystem (ID: $RESULT_ID) – neu erstellt"
  fi
else
  echo -e "  ${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  echo "  $(echo "$BODY" | head -3)"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Update abgeschlossen!${NC}"
echo "=========================================="
echo ""
echo -e "${YELLOW}HINWEIS:${NC} Stelle sicher, dass der Workflow aktiviert ist."
echo "  Oeffne: $N8N_URL"
echo ""
