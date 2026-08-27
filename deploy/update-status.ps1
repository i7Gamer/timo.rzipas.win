# Generates status.json for the live service indicators on /homelab.
#
# Run this on the Docker host on a schedule (see README "Live service
# status"). It checks each service and writes <OutDir>\status.json, which
# docker-compose.example.yml mounts read-only into the website container,
# where nginx serves it at /status.json.
#

param(
  # Must match the host side of the ./status volume in docker-compose.
  [string]$OutDir = (Join-Path $PSScriptRoot 'status')
)

$ErrorActionPreference = 'Stop'

# Site service name (must match `name` in src/data/services.ts) -> the
# endpoint that must answer HTTP below 500 for it to count as online
# (a 401/403 login wall still proves the service is up).
# Services not listed here (e.g. "Bulk storage") keep their static label.
$Checks = [ordered]@{
  # --- Docker containers, probed on their published host port ---
  "What's up Docker"    = 'http://127.0.0.1:3210/'
  'Open WebUI'          = 'http://127.0.0.1:88/'
  'Seerr'               = 'http://127.0.0.1:5055/'
  'Tautulli'            = 'http://127.0.0.1:8181/'
  'Agregarr'            = 'http://127.0.0.1:7171/'
  'Mealie'              = 'http://127.0.0.1:9000/'
  # --- Direct installs / Windows services ---
  'timo.rzipas.win'     = 'http://127.0.0.1:8093/healthz'
  'Cloudflare Tunnel'   = 'http://127.0.0.1:20241/ready' # cloudflared metrics
  'Grafana'             = 'http://127.0.0.1:3333/api/health'
  'MySpeed'             = 'http://127.0.0.1:5216/'
  'Local LLM'           = 'http://127.0.0.1:11434/' # Ollama
  'Plex'                = 'http://127.0.0.1:32400/identity'
  'Sonarr'              = 'http://127.0.0.1:8989/ping'
  'Radarr'              = 'http://127.0.0.1:7878/ping'
  'Bazarr'              = 'http://127.0.0.1:6767/'
  'Jackett'             = 'http://127.0.0.1:9117/'
  'FlareSolverr'        = 'http://127.0.0.1:8191/'
  'qBittorrent'         = 'http://127.0.0.1:8080/'
  'Tutto'               = 'http://127.0.0.1:3001/'
  'SpotifyStatsTracker' = 'http://127.0.0.1:5000/'
}


$RequestTimeoutSeconds = 5

$services = [ordered]@{}
foreach ($entry in $Checks.GetEnumerator()) {
  $online = $false
  try {
    Invoke-WebRequest -Uri $entry.Value -Method Get `
      -TimeoutSec $RequestTimeoutSeconds -UseBasicParsing | Out-Null
    $online = $true
  } catch {
    # Both shells throw on 4xx/5xx, but not the same exception: Windows
    # PowerShell 5.1 raises WebException while PowerShell 7 raises
    # HttpResponseException, so catching either by type silently misses the
    # other and marks answering services offline. Go by the response
    # instead — a 4xx (e.g. 401 from an auth-protected UI) still means the
    # service answered; only 5xx and no response at all count as offline.
    $response = $_.Exception.Response
    $online = ($null -ne $response) -and ([int]$response.StatusCode -lt 500)
  }
  $services[$entry.Key] = if ($online) { 'online' } else { 'offline' }
}

$payload = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  services    = $services
}

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}

# Write atomically so nginx never serves a half-written or missing file.
# (Move-Item -Force would delete + rename, leaving a gap; File.Replace is a
# true same-volume swap. It requires an existing target, hence the fallback
# plain move on the very first run.)
$json = $payload | ConvertTo-Json
$tmp = Join-Path $OutDir 'status.json.tmp'
$target = Join-Path $OutDir 'status.json'
[System.IO.File]::WriteAllText($tmp, $json, [System.Text.UTF8Encoding]::new($false))
if (Test-Path $target) {
  # [NullString]::Value, because PowerShell turns $null into "" for .NET
  # string parameters — Replace then rejects the empty backup path.
  [System.IO.File]::Replace($tmp, $target, [NullString]::Value)
} else {
  Move-Item -Path $tmp -Destination $target
}
