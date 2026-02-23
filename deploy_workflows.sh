#!/bin/bash
# ============================================
# Yauno Bestellsystem – Workflow Deploy Script
# ============================================
# Importiert ALLE 5 Workflows in n8n und aktiviert sie.
#
# Voraussetzungen:
#   - n8n läuft und ist erreichbar
#   - API Key ist gültig (Settings → API → Create API Key)
#   - Telegram Credential "Telegram account" existiert in n8n
#
# Ausführen:
#   chmod +x deploy_workflows.sh
#   ./deploy_workflows.sh
# ============================================

# --- KONFIGURATION ---
N8N_URL="${N8N_BASE_URL:-https://yauno-n8n.duckdns.org}"
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDFlYjNkYi1mOGRkLTRhZmEtODEzZS1lYzRmNTBhZGZmN2MiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzgwYTE0YzItNmYyYi00MjI4LTgzN2YtYTdhMDc1MjI5NTM1IiwiaWF0IjoxNzcxNzUyOTg0LCJleHAiOjE3NzQzMDY4MDB9.7zyzXBWexrzZGy7Mj7eLwwbN6fuNBqck4M_W5Qz4FSo"

# Farben
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ERRORS=0

echo ""
echo "=========================================="
echo "  Yauno Bestellsystem – Full Deploy"
echo "=========================================="
echo ""
echo -e "n8n URL: ${CYAN}$N8N_URL${NC}"
echo ""

# ---- Schritt 1: API-Verbindung testen ----
echo -e "${YELLOW}[1/4]${NC} Teste n8n API-Verbindung..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "  ${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  echo ""
  echo "  Mögliche Ursachen:"
  echo "    - n8n läuft nicht"
  echo "    - API Key ist ungültig oder abgelaufen"
  echo "    - N8N_PUBLIC_API_DISABLED ist nicht auf false gesetzt"
  echo "    - URL ist falsch (aktuell: $N8N_URL)"
  echo ""
  echo "  Tipps:"
  echo "    - Prüfe: curl -s $N8N_URL/healthz"
  echo "    - Neuer API Key: n8n Settings → API → Create API Key"
  echo "    - URL überschreiben: N8N_BASE_URL=https://deine-url ./deploy_workflows.sh"
  exit 1
fi
echo -e "  ${GREEN}✓ Verbindung OK${NC}"

# ---- Schritt 2: Bestehende Workflows prüfen ----
echo ""
echo -e "${YELLOW}[2/4]${NC} Prüfe bestehende Workflows..."
EXISTING=$(curl -s \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

# Funktion: Workflow-ID anhand des Namens finden
find_workflow_id() {
  local name="$1"
  echo "$EXISTING" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for wf in data.get('data', []):
    if wf.get('name') == '$name':
        print(wf['id'])
        break
" 2>/dev/null
}

# ---- Schritt 3: Workflows importieren/aktualisieren ----
echo ""
echo -e "${YELLOW}[3/4]${NC} Importiere Workflows..."
echo ""

# Reihenfolge ist wichtig: WF 01 und 03 zuerst (stellen Admin-Webhooks bereit)
WORKFLOW_FILES=(
  "workflow_01_excel_import.json"
  "workflow_03_bestellung_v2.json"
  "workflow_02_artikel_api.json"
  "workflow_04_abschluss.json"
  "workflow_05_get_order.json"
)

WORKFLOW_NAMES=(
  "01 - Excel Import & Benachrichtigung"
  "03 - Bestellung speichern"
  "02 - Artikel API"
  "04 - Bestellschluss & Auswertung"
  "05 - Bestellung laden (Token)"
)

CREATED_IDS=()

for i in "${!WORKFLOW_FILES[@]}"; do
  WF_FILE="$SCRIPT_DIR/workflows/${WORKFLOW_FILES[$i]}"
  WF_NAME="${WORKFLOW_NAMES[$i]}"

  if [ ! -f "$WF_FILE" ]; then
    echo -e "  ${RED}✗${NC} $WF_NAME – Datei nicht gefunden: ${WORKFLOW_FILES[$i]}"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # Bestehende ID suchen
  WF_ID=$(find_workflow_id "$WF_NAME")

  # JSON vorbereiten: tags-Feld entfernen (API erlaubt es nicht)
  PAYLOAD=$(python3 -c "
import json, sys
with open('$WF_FILE') as f:
    wf = json.load(f)
wf.pop('tags', None)
wf.pop('id', None)
json.dump(wf, sys.stdout)
" 2>/dev/null)

  if [ -z "$PAYLOAD" ]; then
    echo -e "  ${RED}✗${NC} $WF_NAME – JSON konnte nicht gelesen werden"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  if [ -n "$WF_ID" ]; then
    # Bestehenden Workflow aktualisieren
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X PUT \
      -H "X-N8N-API-KEY: $API_KEY" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      "$N8N_URL/api/v1/workflows/$WF_ID" 2>/dev/null)
    ACTION="aktualisiert"
  else
    # Neuen Workflow erstellen
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X POST \
      -H "X-N8N-API-KEY: $API_KEY" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      "$N8N_URL/api/v1/workflows" 2>/dev/null)
    ACTION="erstellt"
  fi

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    RESULT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
    echo -e "  ${GREEN}✓${NC} $WF_NAME (ID: $RESULT_ID) – $ACTION"
    CREATED_IDS+=("$RESULT_ID")
  else
    echo -e "  ${RED}✗${NC} $WF_NAME – Fehler (HTTP $HTTP_CODE)"
    ERROR_MSG=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))" 2>/dev/null)
    [ -n "$ERROR_MSG" ] && echo "    $ERROR_MSG"
    ERRORS=$((ERRORS + 1))
  fi
done

# ---- Schritt 4: Workflows aktivieren ----
echo ""
echo -e "${YELLOW}[4/4]${NC} Aktiviere Workflows..."
echo ""

for WF_ID in "${CREATED_IDS[@]}"; do
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X PATCH \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"active": true}' \
    "$N8N_URL/api/v1/workflows/$WF_ID" 2>/dev/null)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    WF_NAME=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name','?'))" 2>/dev/null)
    echo -e "  ${GREEN}✓${NC} $WF_NAME (ID: $WF_ID) – aktiviert"
  else
    echo -e "  ${RED}✗${NC} Workflow $WF_ID – Aktivierung fehlgeschlagen (HTTP $HTTP_CODE)"
    ERRORS=$((ERRORS + 1))
  fi
done

# ---- Zusammenfassung ----
echo ""
echo "=========================================="
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}  Deploy erfolgreich! Alle Workflows aktiv.${NC}"
else
  echo -e "${YELLOW}  Deploy abgeschlossen mit $ERRORS Fehler(n).${NC}"
fi
echo "=========================================="
echo ""
echo "Nächste Schritte:"
echo "  1. Telegram Credential prüfen:"
echo "     n8n → Settings → Credentials → 'Telegram account'"
echo "     (Bot-Token von @BotFather eintragen)"
echo ""
echo "  2. Umgebungsvariable prüfen:"
echo "     docker exec <container> printenv N8N_BASE_URL"
echo "     (Muss auf $N8N_URL zeigen)"
echo ""
echo "  3. Testen:"
echo "     - Excel-Datei an den Bot senden"
echo "     - WebApp öffnen: https://jade-alfajores-4f3440.netlify.app"
echo "     - Bestellung aufgeben"
echo ""
