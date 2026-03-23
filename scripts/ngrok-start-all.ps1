# =============================================================================
# SCRIPT 2 of 2 — Launch backend + Vite voice + 2 ngrok tunnels, then update .env,
# run quick HTTPS reachability tests, and start Expo.
#
#   powershell -ExecutionPolicy Bypass -File scripts\ngrok-start-all.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\ngrok-start-all.ps1 -SkipExpo
#   powershell -ExecutionPolicy Bypass -File scripts\ngrok-start-all.ps1 -NgrokExe "D:\ngrok\ngrok.exe"
#
# Before first run: real authtoken (NOT the text YOUR_NGROK_TOKEN):
#   C:\ngrok\ngrok.exe config add-authtoken <from https://dashboard.ngrok.com/get-started/your-authtoken >
#
# Requires: mediva-voice-doctor\.env.local with GEMINI_API_KEY, backend\.env configured.
# =============================================================================

param(
  [string]$NgrokExe = 'C:\ngrok\ngrok.exe',
  [switch]$SkipExpo
)

$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ngrok = $NgrokExe

# Same placeholder check as ngrok-update-env.ps1
$cfg = Join-Path $env:LOCALAPPDATA 'ngrok\ngrok.yml'
if (Test-Path -LiteralPath $cfg) {
  $raw = Get-Content -LiteralPath $cfg -Raw -ErrorAction SilentlyContinue
  foreach ($bad in @('YOUR_NGROK_TOKEN', 'PASTE_REAL_TOKEN_HERE', 'PASTE_THE_REAL_LONG_TOKEN_HERE')) {
    if ($raw -match [regex]::Escape($bad)) {
      Write-Host 'ERROR: ngrok config still contains tutorial placeholder text.' -ForegroundColor Red
      Write-Host 'Open https://dashboard.ngrok.com/get-started/your-authtoken and paste the real token:' -ForegroundColor Yellow
      Write-Host '  C:\ngrok\ngrok.exe config add-authtoken <paste_token_here>' -ForegroundColor Cyan
      exit 1
    }
  }
}

if (-not (Test-Path -LiteralPath $ngrok)) {
  Write-Error "ngrok not found at $ngrok. Pass -NgrokExe."
}

function Start-DevWindow {
  param([string]$Title, [string]$Command)
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
  Start-Process powershell.exe -WorkingDirectory $repo -ArgumentList @(
    '-NoExit', '-NoProfile', '-Command',
    "chcp 65001 | Out-Null; `$host.ui.RawUI.WindowTitle = '$Title'; try { Invoke-Expression ([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('$encoded'))) } catch { Write-Host `$_ -ForegroundColor Red; pause }"
  )
}

Write-Host ""
Write-Host "=== Mediva ngrok: launching 4 windows ===" -ForegroundColor Cyan
Write-Host "Repo: $repo"
Write-Host ""

Start-DevWindow 'Mediva backend :3000' @"
Set-Location -LiteralPath '$repo\backend'
if (-not (Test-Path node_modules)) { npm install }
npm run start:dev
"@

Start-Sleep -Seconds 2

Start-DevWindow 'Mediva voice Vite :5173' @"
Set-Location -LiteralPath '$repo\mediva-voice-doctor'
if (-not (Test-Path node_modules)) { npm install }
if (-not (Test-Path .env.local)) {
  Write-Host 'MISSING .env.local — add GEMINI_API_KEY=...' -ForegroundColor Red
}
npm run dev
"@

Start-Sleep -Seconds 2

Start-DevWindow 'ngrok -> :3000' @"
Set-Location -LiteralPath '$repo'
Write-Host 'Forwarding https URL = API (paste into next prompt in main window)' -ForegroundColor Yellow
& '$ngrok' http 3000
"@

Start-Sleep -Seconds 1

Start-DevWindow 'ngrok -> :5173' @"
Set-Location -LiteralPath '$repo'
Write-Host 'Forwarding https URL = Voice (paste into next prompt in main window)' -ForegroundColor Yellow
& '$ngrok' http 5173
"@

Write-Host ""
Write-Host "Wait until:" -ForegroundColor Yellow
Write-Host "  - Backend shows Nest listening on 3000"
Write-Host "  - Vite shows Network URL on 5173"
Write-Host "  - BOTH ngrok windows show: Forwarding https://.... -> http://localhost:...."
Write-Host ""
Read-Host "Press Enter here when all four are ready"

Write-Host ""
Write-Host "=== Update .env (also sets backend BACKEND_URL) ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'ngrok-update-env.ps1') -UpdateBackendEnv

$envFile = Join-Path $repo '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
  Write-Error ".env was not created. Run ngrok-update-env.ps1 again."
}

# Read back API_URL and VOICE url for tests
$apiBase = ''
$voiceUrl = ''
Get-Content -LiteralPath $envFile -Encoding utf8 | ForEach-Object {
  if ($_ -match '^\s*API_URL=(.+)$') { $apiBase = $Matches[1].Trim() }
  if ($_ -match '^\s*EXPO_PUBLIC_VOICE_WEB_URL=(.+)$') { $voiceUrl = $Matches[1].Trim() }
}

if (-not $apiBase -or -not $voiceUrl) {
  Write-Warning "Could not read API_URL / EXPO_PUBLIC_VOICE_WEB_URL from .env — skip tests."
}
else {
  Write-Host ""
  Write-Host "=== Quick reachability tests (ngrok interstitial bypass) ===" -ForegroundColor Cyan
  $hdr = @{ 'ngrok-skip-browser-warning' = '69420' }

  $apiTest = "$apiBase/api"
  try {
    $r = Invoke-WebRequest -Uri $apiTest -Headers $hdr -UseBasicParsing -TimeoutSec 30
    Write-Host "API $apiTest -> HTTP $($r.StatusCode) OK" -ForegroundColor Green
  }
  catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code) {
      Write-Host "API $apiTest -> HTTP $code (reachable; 404 is OK if no root route)" -ForegroundColor Green
    }
    else {
      Write-Host "API test failed: $($_.Exception.Message)" -ForegroundColor Red
      Write-Host "  Is backend up? Is ngrok :3000 showing Forwarding?" -ForegroundColor Yellow
    }
  }

  try {
    $r2 = Invoke-WebRequest -Uri $voiceUrl -Headers $hdr -UseBasicParsing -TimeoutSec 30
    Write-Host "Voice $voiceUrl -> HTTP $($r2.StatusCode) OK" -ForegroundColor Green
  }
  catch {
    Write-Host "Voice test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Is Vite on 5173? Is ngrok :5173 showing Forwarding?" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "=== Phone test checklist ===" -ForegroundColor Cyan
Write-Host "  1) npx expo start -c  (scan QR)"
Write-Host "  2) Login -> Chat -> send message"
Write-Host "  3) Talk -> allow mic -> speak"
Write-Host ""

if (-not $SkipExpo) {
  Set-Location -LiteralPath $repo
  npx expo start -c
}
else {
  Write-Host "Skipped Expo (-SkipExpo). Run: cd `"$repo`"; npx expo start -c" -ForegroundColor Yellow
}
