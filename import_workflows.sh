#!/bin/bash
# ============================================
# Yauno Bestellsystem – n8n Workflow Import
# ============================================
# Importiert alle 5 Workflows einzeln in n8n.
# Bestehende Workflows werden aktualisiert.
#
# Ausführen auf dem n8n-Server:
#   chmod +x import_workflows.sh
#   ./import_workflows.sh
# ============================================

N8N_URL="https://beginner-specialists-mac-helmet.trycloudflare.com"
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDFlYjNkYi1mOGRkLTRhZmEtODEzZS1lYzRmNTBhZGZmN2MiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzgwYTE0YzItNmYyYi00MjI4LTgzN2YtYTdhMDc1MjI5NTM1IiwiaWF0IjoxNzcxNzUyOTg0LCJleHAiOjE3NzQzMDY4MDB9.7zyzXBWexrzZGy7Mj7eLwwbN6fuNBqck4M_W5Qz4FSo"

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
echo ""

# Bestehende Workflows abrufen
echo "Lade bestehende Workflows..."
EXISTING=$(curl -s \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

# Funktion: Workflow-ID anhand des Namens finden
find_workflow_id() {
  local name="$1"
  echo "$EXISTING" | grep -o "\"id\":\"[^\"]*\",\"name\":\"$name\"" | grep -o '"id":"[^"]*"' | cut -d'"' -f4
}

# Die 5 Workflows
WORKFLOWS=(
  "workflow_01_excel_import.json|01 - Excel Import & Benachrichtigung"
  "workflow_02_artikel_api.json|02 - Artikel API"
  "workflow_03_bestellung_v2.json|03 - Bestellung speichern"
  "workflow_04_abschluss.json|04 - Tagesabschluss"
  "workflow_05_get_order.json|05 - Bestellung laden (Token)"
)

SUCCESS=0
FAILED=0

for entry in "${WORKFLOWS[@]}"; do
  FILE="${entry%%|*}"
  NAME="${entry##*|}"
  FILEPATH="$SCRIPT_DIR/workflows/$FILE"

  if [ ! -f "$FILEPATH" ]; then
    echo -e "  ${RED}✗${NC} $NAME – Datei nicht gefunden: $FILE"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Prüfe ob Workflow schon existiert
  WF_ID=$(find_workflow_id "$NAME")

  if [ -n "$WF_ID" ]; then
    # Update bestehenden Workflow
    echo -n "  Aktualisiere: $NAME (ID: $WF_ID)... "
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X PUT \
      -H "X-N8N-API-KEY: $API_KEY" \
      -H "Content-Type: application/json" \
      -d @"$FILEPATH" \
      "$N8N_URL/api/v1/workflows/$WF_ID" 2>/dev/null)
  else
    # Neuen Workflow erstellen
    echo -n "  Importiere: $NAME... "
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X POST \
      -H "X-N8N-API-KEY: $API_KEY" \
      -H "Content-Type: application/json" \
      -d @"$FILEPATH" \
      "$N8N_URL/api/v1/workflows" 2>/dev/null)
  fi

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    NEW_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo -e "${GREEN}OK${NC} (ID: $NEW_ID)"

    # Workflow aktivieren
    curl -s -o /dev/null \
      -X PATCH \
      -H "X-N8N-API-KEY: $API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"active": true}' \
      "$N8N_URL/api/v1/workflows/$NEW_ID" 2>/dev/null

    SUCCESS=$((SUCCESS + 1))
  else
    echo -e "${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
    echo "    $(echo "$BODY" | head -1)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "=========================================="
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}Alle $SUCCESS Workflows importiert und aktiviert!${NC}"
else
  echo -e "${YELLOW}$SUCCESS OK, $FAILED fehlgeschlagen${NC}"
fi
echo "=========================================="
echo ""
echo "Nächste Schritte:"
echo "  1. Öffne n8n: $N8N_URL"
echo "  2. Prüfe dass 'Telegram account' Credentials existieren"
echo "  3. Prüfe N8N_BASE_URL Umgebungsvariable ist gesetzt"
echo "  4. Teste: Sende eine Excel-Datei an den Bot"
echo ""
