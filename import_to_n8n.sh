#!/bin/bash
# ============================================================
# n8n Workflow Import Script
# Importiert alle 5 Workflows in deine n8n-Instanz
#
# Nutzung:
#   1. API Key in n8n erstellen: Settings → API → Create API Key
#   2. Script ausführen:
#      ./import_to_n8n.sh DEIN_API_KEY
#
#   Optional: Andere n8n URL angeben:
#      ./import_to_n8n.sh DEIN_API_KEY http://localhost:5678
# ============================================================

set -e

API_KEY="${1:?Fehler: API Key als erstes Argument angeben. Erstelle ihn unter n8n Settings → API → Create API Key}"
N8N_URL="${2:-http://localhost:5678}"

echo "================================================"
echo "n8n Workflow Import"
echo "URL: $N8N_URL"
echo "================================================"
echo ""

# Verzeichnis mit den Workflow-Dateien (gleicher Ordner wie dieses Script)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

WORKFLOWS=(
  "workflow_01_excel_import.json"
  "workflow_02_artikel_api.json"
  "workflow_03_bestellung_v2.json"
  "workflow_04_abschluss.json"
  "workflow_05_get_order.json"
)

SUCCESS=0
FAILED=0

for WF_FILE in "${WORKFLOWS[@]}"; do
  FILEPATH="$SCRIPT_DIR/$WF_FILE"

  if [ ! -f "$FILEPATH" ]; then
    echo "FEHLER: $WF_FILE nicht gefunden in $SCRIPT_DIR"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Workflow-Name aus JSON lesen
  WF_NAME=$(python3 -c "import json; print(json.load(open('$FILEPATH'))['name'])" 2>/dev/null || echo "$WF_FILE")

  echo -n "Importiere: $WF_NAME ... "

  # tags-Feld entfernen (read-only in API)
  CLEAN_JSON=$(python3 -c "
import json, sys
wf = json.load(open('$FILEPATH'))
wf.pop('tags', None)
wf.pop('id', None)
json.dump(wf, sys.stdout)
")

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "$N8N_URL/api/v1/workflows" \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$CLEAN_JSON" 2>&1)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    # Workflow-ID extrahieren und aktivieren
    WF_ID=$(echo "$BODY" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")

    if [ -n "$WF_ID" ]; then
      # Workflow aktivieren
      ACTIVATE=$(curl -s -w "\n%{http_code}" \
        -X PATCH "$N8N_URL/api/v1/workflows/$WF_ID" \
        -H "X-N8N-API-KEY: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"active": true}' 2>&1)

      ACT_CODE=$(echo "$ACTIVATE" | tail -1)
      if [ "$ACT_CODE" = "200" ]; then
        echo "OK (ID: $WF_ID, aktiviert)"
      else
        echo "OK (ID: $WF_ID, Aktivierung fehlgeschlagen - manuell aktivieren)"
      fi
    else
      echo "OK (aber ID konnte nicht gelesen werden)"
    fi
    SUCCESS=$((SUCCESS + 1))
  else
    echo "FEHLER (HTTP $HTTP_CODE)"
    echo "  Response: $(echo "$BODY" | head -c 200)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "================================================"
echo "Ergebnis: $SUCCESS erfolgreich, $FAILED fehlgeschlagen"
echo "================================================"

if [ $SUCCESS -gt 0 ]; then
  echo ""
  echo "WICHTIG: Setze die Umgebungsvariable N8N_BASE_URL!"
  echo "  In n8n: Settings → Variables → Add Variable"
  echo "  Name:  N8N_BASE_URL"
  echo "  Value: https://tracker-rubber-animation-accommodations.trycloudflare.com"
  echo ""
  echo "Oder beim Docker-Start:"
  echo "  docker run -e N8N_BASE_URL=https://... ..."
fi
