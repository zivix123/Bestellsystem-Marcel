#!/bin/bash
# ============================================
# Yauno Bestellsystem – n8n Workflow Import
# ============================================
# Importiert den kompletten Workflow (alles in einem)
# in deine n8n-Instanz.
#
# Ausführen auf dem n8n-Server:
#   chmod +x import_workflows.sh
#   ./import_workflows.sh
# ============================================

N8N_URL="http://localhost:5678"
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDFlYjNkYi1mOGRkLTRhZmEtODEzZS1lYzRmNTBhZGZmN2MiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzgwYTE0YzItNmYyYi00MjI4LTgzN2YtYTdhMDc1MjI5NTM1IiwiaWF0IjoxNzcxNzUyOTg0LCJleHAiOjE3NzQzMDY4MDB9.7zyzXBWexrzZGy7Mj7eLwwbN6fuNBqck4M_W5Qz4FSo"

# Farben
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  Yauno Bestellsystem – Workflow Import"
echo "=========================================="
echo ""

# API-Verbindung testen
echo -n "Teste n8n API-Verbindung... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  echo ""
  echo "Mögliche Ursachen:"
  echo "  - n8n läuft nicht (starte mit: n8n start)"
  echo "  - API Key ist ungültig"
  echo "  - API ist deaktiviert (N8N_PUBLIC_API_DISABLED=false)"
  exit 1
fi
echo -e "${GREEN}OK${NC}"

# Workflow-Datei
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF_FILE="$SCRIPT_DIR/workflows/workflow_komplett.json"

if [ ! -f "$WF_FILE" ]; then
  echo -e "${RED}FEHLER:${NC} workflow_komplett.json nicht gefunden!"
  exit 1
fi

echo ""
echo "Importiere Yauno Bestellsystem (Komplett-Workflow)..."
echo ""

# Workflow erstellen via API
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "X-N8N-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$WF_FILE" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  WF_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo -e "  ${GREEN}✓${NC} Yauno Bestellsystem (ID: $WF_ID) – importiert"
  echo ""
  echo "=========================================="
  echo -e "${GREEN}Import erfolgreich!${NC}"
  echo "=========================================="
  echo ""
  echo "Nächste Schritte:"
  echo "  1. Öffne n8n: http://46.225.80.178:5678"
  echo "  2. Öffne den Workflow 'Yauno Bestellsystem'"
  echo "  3. Aktiviere den Workflow (Toggle oben rechts)"
  echo "  4. Stelle sicher dass 'Telegram account' Credentials existieren"
  echo "  5. Teste: Sende eine Excel-Datei an den Bot"
else
  echo -e "  ${RED}✗${NC} Import fehlgeschlagen (HTTP $HTTP_CODE)"
  echo "  $BODY" | head -5
  echo ""
  echo "=========================================="
  echo -e "${RED}Import fehlgeschlagen.${NC}"
  echo "=========================================="
fi
echo ""
