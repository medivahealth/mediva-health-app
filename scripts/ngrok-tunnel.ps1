# Start an ngrok HTTP tunnel. Default binary: C:\ngrok\ngrok.exe
#
# One-time (anywhere):
#   C:\ngrok\ngrok.exe config add-authtoken <YOUR_TOKEN>
#   Token: https://dashboard.ngrok.com/get-started/your-authtoken
#
# Examples:
#   powershell -ExecutionPolicy Bypass -File scripts/ngrok-tunnel.ps1 -Port 5173
#   powershell -ExecutionPolicy Bypass -File scripts/ngrok-tunnel.ps1 -Port 3000 -NgrokExe "D:\ngrok\ngrok.exe"

param(
  [Parameter(Mandatory = $true)]
  [int]$Port,

  [string]$NgrokExe = 'C:\ngrok\ngrok.exe'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $NgrokExe)) {
  Write-Error @"
ngrok not found at: $NgrokExe

Install ngrok or pass -NgrokExe 'full\path\ngrok.exe'
"@
}

Write-Host "Starting ngrok: $NgrokExe http $Port" -ForegroundColor Cyan
Write-Host "Copy the printed https://.... URL into repo root .env (see docs/NGROK_FULL_E2E.md)" -ForegroundColor Yellow
& $NgrokExe http $Port
