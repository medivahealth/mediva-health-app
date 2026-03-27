# LAN full stack for Expo (no ngrok): refresh root .env + optional backend URLs, open backend + voice (HTTPS).
#
#   powershell -ExecutionPolicy Bypass -File scripts\e2e-local.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\e2e-local.ps1 -SkipExpo
#
# Then: npx expo start -c  (same PC, or use -SkipExpo and run Expo yourself)

param(
  [switch]$SkipExpo
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

Write-Host ''
Write-Host '=== Mediva LAN (no ngrok) ===' -ForegroundColor Cyan
Write-Host 'Updating repo root .env + backend BACKEND_URL / FRONTEND_URL...' -ForegroundColor Yellow
& (Join-Path $PSScriptRoot 'update-expo-lan-env.ps1') -UpdateBackendEnv

function Start-DevWindow {
  param([string]$Title, [string]$Command)
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
  Start-Process powershell.exe -WorkingDirectory $repo -ArgumentList @(
    '-NoExit', '-NoProfile', '-Command',
    "chcp 65001 | Out-Null; `$host.ui.RawUI.WindowTitle = '$Title'; try { Invoke-Expression ([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('$encoded'))) } catch { Write-Host `$_ -ForegroundColor Red; pause }"
  )
}

Write-Host ''
Write-Host 'Opening: Nest :3000 and Vite voice :5173 (HTTPS)...' -ForegroundColor Cyan

Start-DevWindow 'Mediva backend :3000' @"
Set-Location -LiteralPath '$repo\backend'
if (-not (Test-Path node_modules)) { npm install }
npm run start:dev
"@

Start-Sleep -Seconds 2

Start-DevWindow 'Mediva voice dev:https :5173' @"
Set-Location -LiteralPath '$repo\mediva-voice-doctor'
if (-not (Test-Path node_modules)) { npm install }
if (-not (Test-Path .env.local)) {
  Write-Host 'Add mediva-voice-doctor\.env.local with GEMINI_API_KEY=' -ForegroundColor Red
}
npm run dev:https
"@

Write-Host ''
Write-Host "Next:" -ForegroundColor Green
Write-Host "  1) Wait for Nest + Vite ready (HTTPS on 5173)." -ForegroundColor White
Write-Host "  2) Phone same Wi-Fi. Use dev build (expo run:ios / run:android) for best WebView SSL." -ForegroundColor White
Write-Host "  3) Start Metro:" -ForegroundColor White
Write-Host "     cd `"$repo`"" -ForegroundColor Gray
Write-Host "     npx expo start -c" -ForegroundColor Gray
Write-Host ''
Write-Host "Guide: docs\EXPO_FULL_TEST_LOCAL.md" -ForegroundColor Cyan

if (-not $SkipExpo) {
  Set-Location -LiteralPath $repo
  npx expo start -c
}
