# =============================================================================
# SCRIPT 1 of 2 — Update repo root .env (and optional backend/.env) for ngrok.
#
# Usage (paste REAL https URLs from each ngrok "Forwarding" line):
#   powershell -ExecutionPolicy Bypass -File scripts\ngrok-update-env.ps1 `
#     -ApiUrl "https://abc.ngrok-free.app" -VoiceUrl "https://xyz.ngrok-free.app"
#
# Interactive (prompts for both URLs):
#   powershell -ExecutionPolicy Bypass -File scripts\ngrok-update-env.ps1
#
# -UpdateBackendEnv  → also sets BACKEND_URL in backend\.env (recommended)
#
# NGROK AUTH (ERR_NGROK_105): use the REAL token from
#   https://dashboard.ngrok.com/get-started/your-authtoken
# NOT the literal text YOUR_NGROK_TOKEN from tutorials. Fix:
#   C:\ngrok\ngrok.exe config add-authtoken PASTE_REAL_TOKEN_HERE
# =============================================================================

param(
  [string]$ApiUrl = '',
  [string]$VoiceUrl = '',
  [string]$EnvPath = '',
  [switch]$UpdateBackendEnv
)

$ErrorActionPreference = 'Stop'

function Test-NgrokConfigTokenPlaceholder {
  $cfg = Join-Path $env:LOCALAPPDATA 'ngrok\ngrok.yml'
  if (-not (Test-Path -LiteralPath $cfg)) { return }
  $raw = Get-Content -LiteralPath $cfg -Raw -ErrorAction SilentlyContinue
  $bad = @(
    'YOUR_NGROK_TOKEN',
    'PASTE_REAL_TOKEN_HERE',
    'PASTE_THE_REAL_LONG_TOKEN_HERE'
  )
  $isBad = $false
  foreach ($b in $bad) {
    if ($raw -match [regex]::Escape($b)) { $isBad = $true; break }
  }
  if ($isBad -or $raw -match 'authtoken:\s*YOUR_') {
    Write-Host ''
    Write-Host "INVALID NGROK TOKEN in $cfg" -ForegroundColor Red
    Write-Host 'Do not use tutorial placeholder text. Copy your real token from:' -ForegroundColor Yellow
    Write-Host '  https://dashboard.ngrok.com/get-started/your-authtoken' -ForegroundColor Cyan
    Write-Host 'Then run (paste the long token, not these words):' -ForegroundColor Yellow
    Write-Host '  C:\ngrok\ngrok.exe config add-authtoken <your_token>' -ForegroundColor White
    Write-Host ''
    exit 1
  }
}

Test-NgrokConfigTokenPlaceholder

if (-not $ApiUrl) {
  $ApiUrl = Read-Host 'Paste API tunnel URL (ngrok http 3000), e.g. https://....ngrok-free.app'
}
if (-not $VoiceUrl) {
  $VoiceUrl = Read-Host 'Paste Voice tunnel URL (ngrok http 5173), e.g. https://....ngrok-free.app'
}

function Normalize-Base([string]$u) {
  $u = $u.Trim().TrimEnd('/')
  if ($u -match '(?i)/api$') {
    $u = $u.Substring(0, $u.Length - 4).TrimEnd('/')
  }
  return $u
}

$apiBase = Normalize-Base $ApiUrl
$voiceBase = Normalize-Base $VoiceUrl

if ($apiBase -notmatch '^https://') {
  Write-Error "ApiUrl must be https:// (ngrok Forwarding URL). Got: $ApiUrl"
}
if ($voiceBase -notmatch '^https://') {
  Write-Error "VoiceUrl must be https:// (ngrok Forwarding URL). Got: $VoiceUrl"
}

$expoApi = "$apiBase/api"
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $EnvPath) {
  $EnvPath = Join-Path $root '.env'
}

$newLines = @(
  '# =============================================================================',
  '# Mediva - Option B (ngrok) - updated by scripts/ngrok-update-env.ps1',
  "# $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
  '# =============================================================================',
  '',
  "EXPO_PUBLIC_API_URL=$expoApi",
  "API_URL=$apiBase",
  "EXPO_PUBLIC_VOICE_WEB_URL=$voiceBase",
  ''
)

$keys = @('EXPO_PUBLIC_API_URL', 'API_URL', 'EXPO_PUBLIC_VOICE_WEB_URL')

if (Test-Path -LiteralPath $EnvPath) {
  $existing = Get-Content -LiteralPath $EnvPath -Encoding utf8
  $kept = foreach ($line in $existing) {
    $skip = $false
    foreach ($k in $keys) {
      if ($line -match "^\s*$([regex]::Escape($k))\s*=") {
        $skip = $true
        break
      }
    }
    if (-not $skip) { $line }
  }
  while ($kept.Count -gt 0 -and [string]::IsNullOrWhiteSpace($kept[-1])) {
    $kept = $kept[0..($kept.Count - 2)]
  }
  @($kept) + @('') + $newLines | Set-Content -LiteralPath $EnvPath -Encoding utf8
}
else {
  $newLines | Set-Content -LiteralPath $EnvPath -Encoding utf8
}

Write-Host "Updated: $EnvPath" -ForegroundColor Green
Write-Host "  EXPO_PUBLIC_API_URL=$expoApi"
Write-Host "  API_URL=$apiBase"
Write-Host "  EXPO_PUBLIC_VOICE_WEB_URL=$voiceBase"
Write-Host ""

$backendEnv = Join-Path $root 'backend\.env'
if ($UpdateBackendEnv) {
  if (-not (Test-Path -LiteralPath $backendEnv)) {
    Write-Warning 'backend\.env not found - copy backend\.env.example first. Skipping BACKEND_URL.'
  }
  else {
    $beLines = Get-Content -LiteralPath $backendEnv -Encoding utf8
    $beKey = 'BACKEND_URL'
    $beKept = foreach ($line in $beLines) {
      if ($line -match "^\s*$([regex]::Escape($beKey))\s*=") { continue }
      $line
    }
    while ($beKept.Count -gt 0 -and [string]::IsNullOrWhiteSpace($beKept[-1])) {
      $beKept = $beKept[0..($beKept.Count - 2)]
    }
    @($beKept) + @('', "# ngrok (scripts/ngrok-update-env.ps1 -UpdateBackendEnv)", "$beKey=$apiBase", '') |
      Set-Content -LiteralPath $backendEnv -Encoding utf8
    Write-Host "Updated backend\.env BACKEND_URL=$apiBase" -ForegroundColor Green
  }
}

if (-not $UpdateBackendEnv) {
  Write-Host 'Tip: next time add -UpdateBackendEnv to also set BACKEND_URL in backend\.env' -ForegroundColor DarkGray
}
Write-Host ''
Write-Host 'Done. Start Expo: npx expo start -c' -ForegroundColor Cyan
