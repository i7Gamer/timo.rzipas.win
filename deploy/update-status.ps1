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
  } catch [System.Net.WebException] {
    # Windows PowerShell throws on 4xx/5xx. A 4xx (e.g. 401 from an
    # auth-protected UI) still means the service answered; only 5xx and
    # no-response at all count as offline.
    $status = $_.Exception.Response.StatusCode
    $online = ($null -ne $status) -and ([int]$status -lt 500)
  } catch {
    $online = $false
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

# Write atomically so nginx never serves a half-written file.
$json = $payload | ConvertTo-Json
$tmp = Join-Path $OutDir 'status.json.tmp'
[System.IO.File]::WriteAllText($tmp, $json, [System.Text.UTF8Encoding]::new($false))
Move-Item -Path $tmp -Destination (Join-Path $OutDir 'status.json') -Force
