# Updates EXPO_PUBLIC_* and API_URL in repo-root .env using the current Wi‑Fi IPv4.
# Run from repo root:
#   powershell -ExecutionPolicy Bypass -File scripts/update-expo-lan-env.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/update-expo-lan-env.ps1 -UpdateBackendEnv
#
# -UpdateBackendEnv  also sets BACKEND_URL / FRONTEND_URL in backend/.env (same LAN IP).

param(
  [switch]$UpdateBackendEnv
)

$ErrorActionPreference = 'Stop'
# Repo root = parent of scripts/
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $root '.env'

# Prefer Wi-Fi / WLAN (same IP Metro shows). Avoid matching "Ethernet" only (VirtualBox etc.).
$wifi = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -notmatch '^127\.' -and
    $_.IPAddress -notmatch '^169\.254\.' -and
    $_.PrefixOrigin -ne 'WellKnown' -and
    $_.IPAddress -notmatch '^192\.168\.56\.' -and
    $_.InterfaceAlias -match 'Wi-?Fi|WLAN|Wireless'
  } |
  Sort-Object InterfaceMetric |
  Select-Object -First 1

if (-not $wifi) {
  $wifi = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notmatch '^127\.' -and
      $_.IPAddress -notmatch '^169\.254\.' -and
      $_.PrefixOrigin -ne 'WellKnown' -and
      $_.IPAddress -notmatch '^192\.168\.56\.' -and
      $_.IPAddress -notmatch '^10\.0\.2\.' -and
      (($adpt = Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue) -and
        $adpt.Name -notmatch 'VirtualBox|VMware|Hyper-V|vEthernet|Loopback')
    } |
    Sort-Object InterfaceMetric |
    Select-Object -First 1
}

if (-not $wifi) {
  Write-Error 'Could not detect a LAN IPv4. Set EXPO_PUBLIC_* manually in .env'
}

$ip = $wifi.IPAddress
Write-Host "Using LAN IP: $ip"

$lines = @(
  '# =============================================================================',
  '# Mediva - local development (auto-updated by scripts/update-expo-lan-env.ps1)',
  "# LAN IP used: $ip",
  '# =============================================================================',
  '',
  "EXPO_PUBLIC_API_URL=http://${ip}:3000/api",
  "API_URL=http://${ip}:3000",
  '',
  '# Voice: use npm run dev:https in mediva-voice-doctor (HTTPS for phone mic)',
  "EXPO_PUBLIC_VOICE_WEB_URL=https://${ip}:5173",
  '# If you only use npm run dev (HTTP), switch back to http:// for this line:',
  "# EXPO_PUBLIC_VOICE_WEB_URL=http://${ip}:5173",
  '',
  '# Production:',
  '# EXPO_PUBLIC_API_URL=https://api.your-domain.com/api',
  '# API_URL=https://api.your-domain.com',
  '# EXPO_PUBLIC_VOICE_WEB_URL=https://voice.your-domain.com',
  ''
)

$lines | Set-Content -Path $envFile -Encoding utf8
Write-Host "Wrote $envFile"
Write-Host 'Restart Expo: npx expo start -c'

$backendEnv = Join-Path $root 'backend\.env'
if ($UpdateBackendEnv) {
  if (-not (Test-Path -LiteralPath $backendEnv)) {
    Write-Warning 'backend\.env not found - copy backend\.env.example first. Skipping BACKEND_URL.'
  }
  else {
    $beKeys = @('BACKEND_URL', 'FRONTEND_URL')
    $beLines = Get-Content -LiteralPath $backendEnv -Encoding utf8
    $beKept = foreach ($line in $beLines) {
      $skip = $false
      foreach ($k in $beKeys) {
        if ($line -match "^\s*$([regex]::Escape($k))\s*=") { $skip = $true; break }
      }
      if (-not $skip) { $line }
    }
    while ($beKept.Count -gt 0 -and [string]::IsNullOrWhiteSpace($beKept[-1])) {
      $beKept = $beKept[0..($beKept.Count - 2)]
    }
    $back = "http://${ip}:3000"
    $front = "http://${ip}:8081"
    @($beKept) + @('', '# LAN (scripts/update-expo-lan-env.ps1 -UpdateBackendEnv)', "BACKEND_URL=$back", "FRONTEND_URL=$front", '') |
      Set-Content -LiteralPath $backendEnv -Encoding utf8
    Write-Host "Updated backend\.env BACKEND_URL=$back FRONTEND_URL=$front" -ForegroundColor Green
  }
}
