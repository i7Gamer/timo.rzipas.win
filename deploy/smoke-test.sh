#!/usr/bin/env bash
# Smoke-tests a running website container: the nginx behaviour the unit tests
# cannot see (language negotiation, redirects, the headers on every kind of
# response, the health check baked into the image). CI runs it against the
# freshly built image before the multi-arch publish. Locally:
#
#   docker build -t timo-website:smoke .
#   docker run -d --rm --name smoke --health-interval=2s -p 127.0.0.1:18093:80 timo-website:smoke
#   bash deploy/smoke-test.sh http://127.0.0.1:18093 smoke
#
# The container name is optional; with it the script also waits for Docker to
# report the container healthy, which proves the image's HEALTHCHECK works.
set -euo pipefail

base="${1:?usage: smoke-test.sh <base-url> [container-name]}"
container="${2:-}"

# Must match deploy/security-headers.conf and deploy/nginx.conf.
HSTS='max-age=31536000; includeSubDomains'
HEALTHZ_EN='ok — served from the living room'
HEALTHZ_DE='ok — ausgeliefert aus dem Wohnzimmer'
IMMUTABLE='public, max-age=31536000, immutable'

READY_ATTEMPTS=20
READY_PAUSE_SECONDS=0.5
HEALTHY_ATTEMPTS=30
HEALTHY_PAUSE_SECONDS=1

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

status=''
# request <path> [curl options...]: sets $status; headers and body land in $tmp.
request() {
  local path="$1"
  shift
  status="$(curl -sS -o "$tmp/body" -D "$tmp/headers" -w '%{http_code}' "$@" "$base$path")"
}

# header <name>: the first value of that response header, CR stripped.
header() {
  grep -i "^$1:" "$tmp/headers" | head -n 1 | sed 's/^[^:]*: *//' | tr -d '\r'
}

expect_status() {
  [[ "$status" == "$1" ]] || {
    echo "    expected status $1, got $status"
    return 1
  }
}

expect_header() {
  local actual
  actual="$(header "$1")"
  [[ "$actual" == "$2" ]] || {
    echo "    expected $1: '$2', got '$actual'"
    return 1
  }
}

expect_header_present() {
  [[ -n "$(header "$1")" ]] || {
    echo "    missing header $1"
    return 1
  }
}

expect_body() {
  grep -qF -- "$1" "$tmp/body" || {
    echo "    body lacks: $1"
    return 1
  }
}

# The set every response must carry — including the ones produced by
# locations that add headers of their own, where nginx drops inherited ones.
expect_shared_headers() {
  expect_header Strict-Transport-Security "$HSTS" &&
    expect_header X-Content-Type-Options nosniff &&
    expect_header X-Frame-Options DENY &&
    expect_header Referrer-Policy strict-origin-when-cross-origin &&
    expect_header_present Content-Security-Policy
}

check_home_is_english_by_default() {
  request /
  expect_status 200 && expect_body '<html lang="en"' && expect_shared_headers &&
    expect_header Cache-Control no-cache && expect_header Vary 'Cookie, Accept-Language'
}

check_accept_language_picks_german() {
  request / -H 'Accept-Language: de-CH,de;q=0.9,en;q=0.8'
  expect_status 200 && expect_body '<html lang="de"'
}

check_cookie_beats_accept_language() {
  request / -H 'Accept-Language: en' -H 'Cookie: lang=de'
  expect_status 200 && expect_body '<html lang="de"'
}

check_unknown_cookie_falls_back_to_accept_language() {
  request / -H 'Accept-Language: de' -H 'Cookie: lang=fr'
  expect_status 200 && expect_body '<html lang="de"'
}

check_healthz_speaks_both_languages() {
  request /healthz
  expect_status 200 && expect_body "$HEALTHZ_EN" && expect_shared_headers &&
    expect_header Cache-Control no-store || return 1
  request /healthz -H 'Accept-Language: de'
  expect_status 200 && expect_body "$HEALTHZ_DE"
}

# nginx sees plain HTTP behind the tunnel; an absolute Location would send
# HTTPS visitors through an http:// hop.
check_directory_redirect_is_relative() {
  request /projects
  expect_status 301 && expect_header Location '/projects/' && expect_shared_headers
}

check_missing_page_is_a_localized_404() {
  request /nope -H 'Accept-Language: de'
  expect_status 404 && expect_body '<html lang="de"' && expect_shared_headers
}

check_status_json_is_404_without_the_mount() {
  request /status.json
  expect_status 404 && expect_shared_headers
}

check_hashed_assets_are_immutable() {
  request /
  local css
  css="$(grep -o '/_astro/[^"]*\.css' "$tmp/body" | head -n 1)"
  [[ -n "$css" ]] || {
    echo '    no /_astro stylesheet linked from /'
    return 1
  }
  request "$css"
  expect_status 200 && expect_header Cache-Control "$IMMUTABLE"
}

# server_tokens off: the LAN sees this header directly (Cloudflare replaces
# it publicly).
check_server_header_hides_the_version() {
  request /
  expect_status 200 && expect_header Server nginx
}

# access_log off on /healthz: the readiness loop, the checks above and the
# health check have all hit it by now, while / was fetched several times.
check_health_probes_are_not_logged() {
  local logs
  logs="$(docker logs "$container" 2>&1)"
  grep -q '"GET / HTTP' <<<"$logs" || {
    echo '    expected page requests in the access log'
    return 1
  }
  ! grep -q '/healthz HTTP' <<<"$logs" || {
    echo '    /healthz requests appear in the access log'
    return 1
  }
}

check_container_reports_healthy() {
  local i state=''
  for ((i = 0; i < HEALTHY_ATTEMPTS; i++)); do
    state="$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || true)"
    [[ -n "$state" ]] || {
      echo "    $container has no health check configured"
      return 1
    }
    [[ "$state" == healthy ]] && return 0
    sleep "$HEALTHY_PAUSE_SECONDS"
  done
  echo "    $container is '$state' after $HEALTHY_ATTEMPTS attempts"
  return 1
}

failures=0
run() {
  local name="$1"
  shift
  if "$@"; then
    echo "ok    $name"
  else
    echo "FAIL  $name"
    failures=$((failures + 1))
  fi
}

echo "smoke-testing $base"
for ((i = 0; i < READY_ATTEMPTS; i++)); do
  curl -sf -o /dev/null "$base/healthz" && break
  sleep "$READY_PAUSE_SECONDS"
done

run 'home page is English by default and carries every header' check_home_is_english_by_default
run 'Accept-Language picks German' check_accept_language_picks_german
run 'lang cookie beats Accept-Language' check_cookie_beats_accept_language
run 'unknown lang cookie falls back to Accept-Language' check_unknown_cookie_falls_back_to_accept_language
run '/healthz speaks both languages with the shared headers' check_healthz_speaks_both_languages
run 'directory redirect is relative' check_directory_redirect_is_relative
run 'missing page is a localized 404 with the shared headers' check_missing_page_is_a_localized_404
run '/status.json is a 404 without the mount' check_status_json_is_404_without_the_mount
run 'hashed assets are immutable' check_hashed_assets_are_immutable
run 'Server header hides the nginx version' check_server_header_hides_the_version
if [[ -n "$container" ]]; then
  run "docker reports $container healthy" check_container_reports_healthy
  run 'health probes are not logged' check_health_probes_are_not_logged
fi

if ((failures > 0)); then
  echo "$failures check(s) failed"
  exit 1
fi
echo 'all checks passed'
