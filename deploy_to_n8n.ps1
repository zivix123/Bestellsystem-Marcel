# Deploy-Script: Alle Workflows zu n8n hochladen
# Ausfuehren: PowerShell -ExecutionPolicy Bypass -File deploy_to_n8n.ps1

$N8N_HOST = "http://46.225.80.178:5678"
$API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDFlYjNkYi1mOGRkLTRhZmEtODEzZS1lYzRmNTBhZGZmN2MiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzgwYTE0YzItNmYyYi00MjI4LTgzN2YtYTdhMDc1MjI5NTM1IiwiaWF0IjoxNzcxNzUyOTg0LCJleHAiOjE3NzQzMDY4MDB9.7zyzXBWexrzZGy7Mj7eLwwbN6fuNBqck4M_W5Qz4FSo"

$headers = @{
    "X-N8N-API-KEY" = $API_KEY
    "Content-Type"  = "application/json"
    "Accept"        = "application/json"
}

$workflows = @(
    "workflow_01_excel_import.json",
    "workflow_02_artikel_api.json",
    "workflow_03_bestellung_v2.json",
    "workflow_04_abschluss.json",
    "workflow_05_get_order.json"
)

Write-Host "=== n8n Workflow Deploy ===" -ForegroundColor Cyan
Write-Host "Server: $N8N_HOST" -ForegroundColor Gray
Write-Host ""

# Existierende Workflows pruefen
Write-Host "Pruefe existierende Workflows..." -ForegroundColor Yellow
try {
    $existing = Invoke-RestMethod -Uri "$N8N_HOST/api/v1/workflows" -Headers $headers -Method GET
    $existingNames = @{}
    foreach ($wf in $existing.data) {
        $existingNames[$wf.name] = $wf.id
    }
    Write-Host "  $($existing.data.Count) Workflows gefunden" -ForegroundColor Gray
} catch {
    Write-Host "  Fehler beim Abrufen: $_" -ForegroundColor Red
    $existingNames = @{}
}

Write-Host ""

foreach ($file in $workflows) {
    $path = Join-Path $PSScriptRoot $file
    if (-not (Test-Path $path)) {
        Write-Host "SKIP $file - Datei nicht gefunden" -ForegroundColor Red
        continue
    }

    $json = Get-Content $path -Raw -Encoding UTF8
    $workflow = $json | ConvertFrom-Json
    $name = $workflow.name

    Write-Host "Deploying: $name" -ForegroundColor Yellow

    # Pruefen ob Workflow schon existiert
    if ($existingNames.ContainsKey($name)) {
        $wfId = $existingNames[$name]
        Write-Host "  Existiert bereits (ID: $wfId) - Update..." -ForegroundColor Gray
        try {
            $result = Invoke-RestMethod -Uri "$N8N_HOST/api/v1/workflows/$wfId" -Headers $headers -Method PUT -Body $json
            Write-Host "  Aktualisiert!" -ForegroundColor Green
        } catch {
            Write-Host "  Fehler beim Update: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  Neu erstellen..." -ForegroundColor Gray
        try {
            $result = Invoke-RestMethod -Uri "$N8N_HOST/api/v1/workflows" -Headers $headers -Method POST -Body $json
            $newId = $result.id
            Write-Host "  Erstellt (ID: $newId)" -ForegroundColor Green

            # Workflow aktivieren
            $activateBody = '{"active": true}'
            try {
                Invoke-RestMethod -Uri "$N8N_HOST/api/v1/workflows/$newId/activate" -Headers $headers -Method POST | Out-Null
                Write-Host "  Aktiviert!" -ForegroundColor Green
            } catch {
                # Fallback: Per PUT aktivieren
                try {
                    Invoke-RestMethod -Uri "$N8N_HOST/api/v1/workflows/$newId" -Headers $headers -Method PUT -Body $activateBody | Out-Null
                    Write-Host "  Aktiviert!" -ForegroundColor Green
                } catch {
                    Write-Host "  Hinweis: Bitte manuell in n8n aktivieren" -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host "  Fehler beim Erstellen: $_" -ForegroundColor Red
        }
    }
    Write-Host ""
}

Write-Host "=== Deploy abgeschlossen ===" -ForegroundColor Cyan
Write-Host "Oeffne n8n: $N8N_HOST" -ForegroundColor Gray
Write-Host ""
Read-Host "Druecke Enter zum Beenden"
