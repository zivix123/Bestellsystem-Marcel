#!/bin/bash
# ============================================
# Yauno Bestellsystem – n8n Workflow Import
# ============================================
# Dieses Script importiert alle 5 Workflows
# in deine n8n-Instanz und aktiviert sie.
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

# Funktion: Workflow importieren
import_workflow() {
  local FILE="$1"
  local NAME="$2"

  if [ ! -f "$FILE" ]; then
    echo -e "  ${RED}✗${NC} Datei nicht gefunden: $FILE"
    return 1
  fi

  # Workflow erstellen via API
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$FILE" \
    "$N8N_URL/api/v1/workflows" 2>/dev/null)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    # Workflow-ID extrahieren
    WF_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -n "$WF_ID" ]; then
      # Workflow aktivieren
      ACTIVATE_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X PATCH \
        -H "X-N8N-API-KEY: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"active": true}' \
        "$N8N_URL/api/v1/workflows/$WF_ID" 2>/dev/null)

      if [ "$ACTIVATE_CODE" = "200" ]; then
        echo -e "  ${GREEN}✓${NC} $NAME (ID: $WF_ID) – importiert & aktiviert"
      else
        echo -e "  ${YELLOW}⚠${NC} $NAME (ID: $WF_ID) – importiert, aber Aktivierung fehlgeschlagen (HTTP $ACTIVATE_CODE)"
      fi
    else
      echo -e "  ${GREEN}✓${NC} $NAME – importiert"
    fi
    return 0
  else
    echo -e "  ${RED}✗${NC} $NAME – Fehler (HTTP $HTTP_CODE)"
    echo "    $BODY" | head -3
    return 1
  fi
}

# Workflows importieren
echo ""
echo "Importiere Workflows..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF_DIR="$SCRIPT_DIR/workflows"

if [ ! -d "$WF_DIR" ]; then
  echo -e "${RED}FEHLER:${NC} Ordner 'workflows/' nicht gefunden!"
  echo "Stelle sicher, dass das Script im Projektverzeichnis liegt."
  exit 1
fi

ERRORS=0

import_workflow "$WF_DIR/workflow_01_excel_import.json"    "01 - Excel Import & Benachrichtigung" || ((ERRORS++))
import_workflow "$WF_DIR/workflow_02_artikel_api.json"      "02 - Artikel API"                      || ((ERRORS++))
import_workflow "$WF_DIR/workflow_03_bestellung_v2.json"    "03 - Bestellung speichern"              || ((ERRORS++))
import_workflow "$WF_DIR/workflow_04_abschluss.json"        "04 - Bestellschluss & Auswertung"       || ((ERRORS++))
import_workflow "$WF_DIR/workflow_05_get_order.json"        "05 - Bestellung laden (Token)"          || ((ERRORS++))

echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}Alle 5 Workflows erfolgreich importiert!${NC}"
else
  echo -e "${YELLOW}$ERRORS Workflow(s) fehlgeschlagen.${NC}"
fi
echo "=========================================="
echo ""
echo "Nächste Schritte:"
echo "  1. Öffne n8n: http://46.225.80.178:5678"
echo "  2. Prüfe ob alle Workflows aktiv sind"
echo "  3. Stelle sicher dass 'Telegram account' Credentials existieren"
echo "  4. Teste: Sende eine Excel-Datei an den Bot"
echo ""
