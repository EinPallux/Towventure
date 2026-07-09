#!/usr/bin/env bash
#
# Towventure — one-command deploy for a fresh Ubuntu 22.04 / 24.04 VPS.
# It installs Docker, opens the firewall, generates your secrets, and brings the
# whole game online behind automatic HTTPS. Safe to re-run.
#
#   sudo bash ops/deploy.sh              # install / update everything and go live
#   sudo bash ops/deploy.sh admin NAME   # make an account an admin (after you register)
#   sudo bash ops/deploy.sh logs         # watch the live logs
#   sudo bash ops/deploy.sh status       # show what's running
#   sudo bash ops/deploy.sh update       # pull the latest code + rebuild
#   sudo bash ops/deploy.sh stop | start # pause / resume
#   sudo bash ops/deploy.sh backup       # take a database backup right now
#
# One-liner on a brand-new box (no repo yet):
#   curl -fsSL https://raw.githubusercontent.com/EinPallux/Towventure/claude/phase-1-vzddey/ops/deploy.sh | sudo bash
#
set -euo pipefail

REPO_URL="${TOWVENTURE_REPO:-https://github.com/EinPallux/Towventure.git}"
BRANCH="${TOWVENTURE_BRANCH:-claude/phase-1-vzddey}"
CLONE_DIR="/opt/towventure"

c_cyan=$'\033[1;36m'; c_green=$'\033[1;32m'; c_yellow=$'\033[1;33m'; c_red=$'\033[1;31m'; c_reset=$'\033[0m'
log()  { printf '\n%s▸ %s%s\n' "$c_cyan"   "$*" "$c_reset"; }
ok()   { printf '%s✓ %s%s\n'   "$c_green"  "$*" "$c_reset"; }
warn() { printf '%s! %s%s\n'   "$c_yellow" "$*" "$c_reset"; }
die()  { printf '%s✗ %s%s\n'   "$c_red"    "$*" "$c_reset" >&2; exit 1; }

need_root() { [ "$(id -u)" = "0" ] || die "Please run with sudo:  sudo bash ops/deploy.sh"; }

# Find the repo root: the current dir, or this script's parent, or clone it.
locate_repo() {
  if [ -f "$PWD/docker-compose.yml" ] && [ -d "$PWD/packages" ]; then echo "$PWD"; return; fi
  local here=""
  here="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." 2>/dev/null && pwd || true)"
  if [ -n "$here" ] && [ -f "$here/docker-compose.yml" ]; then echo "$here"; return; fi
  echo ""
}

detect_ip() {
  curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null \
    || curl -fsS --max-time 8 https://ifconfig.me 2>/dev/null \
    || curl -fsS --max-time 8 https://icanhazip.com 2>/dev/null | tr -d '[:space:]'
}

install_prereqs() {
  log "Installing prerequisites (curl, openssl, git, ufw)…"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y -qq
  apt-get install -y -qq ca-certificates curl openssl git ufw >/dev/null
  ok "Prerequisites ready"
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    ok "Docker already installed"
    return
  fi
  log "Installing Docker…"
  curl -fsSL https://get.docker.com | sh >/dev/null
  systemctl enable --now docker >/dev/null 2>&1 || true
  ok "Docker installed"
}

setup_firewall() {
  log "Opening the firewall (SSH, HTTP, HTTPS)…"
  ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
  ok "Firewall configured (22, 80, 443 open)"
}

write_env() {
  local app_dir="$1"
  if [ -f "$app_dir/.env" ]; then
    ok "Keeping your existing $app_dir/.env (delete it to reconfigure)"
    return
  fi
  log "Configuring the site address…"
  printf '\n  Enter the domain or subdomain you pointed at THIS server (e.g. play.example.com).\n' >&2
  printf '  Leave blank to use this server'\''s IP with automatic HTTPS (via sslip.io).\n\n  Domain: ' >&2
  local domain=""
  read -r domain < /dev/tty || domain=""
  domain="$(printf '%s' "$domain" | tr -d '[:space:]' | sed 's#^https\?://##; s#/.*##')"
  if [ -z "$domain" ]; then
    local ip=""; ip="$(detect_ip || true)"
    [ -n "$ip" ] || die "Could not detect this server's public IP. Re-run and enter a domain."
    domain="${ip}.sslip.io"
    warn "No domain given — using $domain (resolves to $ip, automatic HTTPS)"
  fi
  local secret pgpass
  secret="$(openssl rand -hex 32)"
  pgpass="$(openssl rand -hex 24)"
  umask 077
  cat > "$app_dir/.env" <<ENV
# Towventure production config — generated $(date -u +%Y-%m-%dT%H:%M:%SZ). Keep this secret.
POSTGRES_USER=towventure
POSTGRES_PASSWORD=$pgpass
POSTGRES_DB=towventure
SESSION_SECRET=$secret
SITE_ADDRESS=$domain
PUBLIC_ORIGIN=https://$domain
NODE_ENV=production
LOG_LEVEL=info
HONOR_SEASON=1
# Off-box backup target for rclone (e.g. b2:my-bucket). Empty = local backups only.
RCLONE_REMOTE=
ENV
  chmod 600 "$app_dir/.env"
  ok "Wrote $app_dir/.env  (site: https://$domain, secrets auto-generated)"
}

compose_up() {
  local app_dir="$1"
  log "Building and starting Towventure (the first build compiles the game — a few minutes)…"
  ( cd "$app_dir" && docker compose --env-file .env up -d --build )
  ok "Containers started"
}

wait_healthy() {
  local app_dir="$1" domain
  domain="$(grep -E '^SITE_ADDRESS=' "$app_dir/.env" | cut -d= -f2-)"
  log "Waiting for the game to come online (and for its HTTPS certificate)…"
  local i code
  for i in $(seq 1 72); do
    code="$(curl -fsS -k --max-time 8 -o /dev/null -w '%{http_code}' "https://$domain/healthz" 2>/dev/null || echo 000)"
    if [ "$code" = "200" ]; then ok "Towventure is healthy"; return 0; fi
    sleep 5
  done
  warn "Not answering yet. The first HTTPS certificate can take a minute or two."
  warn "Check logs with:  sudo bash ops/deploy.sh logs"
  return 0
}

print_success() {
  local app_dir="$1" domain
  domain="$(grep -E '^SITE_ADDRESS=' "$app_dir/.env" | cut -d= -f2-)"
  printf '\n%s════════════════════════════════════════════════════════════%s\n' "$c_green" "$c_reset"
  ok "Towventure is live at:  https://$domain"
  cat <<TXT

  Next steps:
    1. Open  https://$domain  in a browser and register your account.
    2. Make yourself an admin:   sudo bash ops/deploy.sh admin YOUR_NAME
    3. Send the link to your friends.

  Handy commands (run from ${app_dir}):
    sudo bash ops/deploy.sh logs      # watch live logs
    sudo bash ops/deploy.sh status    # what's running
    sudo bash ops/deploy.sh update    # pull latest code + rebuild
    sudo bash ops/deploy.sh backup    # database backup right now
    sudo bash ops/deploy.sh stop      # pause    (start = resume)

  Backups run automatically every day inside the 'backup' container.
TXT
  printf '%s════════════════════════════════════════════════════════════%s\n\n' "$c_green" "$c_reset"
}

cmd_install() {
  need_root
  install_prereqs
  install_docker
  setup_firewall
  local app_dir
  app_dir="$(locate_repo)"
  if [ -z "$app_dir" ]; then
    log "Downloading Towventure to $CLONE_DIR…"
    if [ -d "$CLONE_DIR/.git" ]; then
      ( cd "$CLONE_DIR" && git fetch --depth 1 origin "$BRANCH" && git checkout -f FETCH_HEAD )
    else
      git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$CLONE_DIR"
    fi
    app_dir="$CLONE_DIR"
  fi
  ok "Using project at $app_dir"
  write_env "$app_dir"
  compose_up "$app_dir"
  wait_healthy "$app_dir"
  print_success "$app_dir"
}

require_repo() {
  local app_dir; app_dir="$(locate_repo)"
  [ -z "$app_dir" ] && [ -d "$CLONE_DIR" ] && app_dir="$CLONE_DIR"
  [ -n "$app_dir" ] || die "Project not found — run 'sudo bash ops/deploy.sh' first."
  echo "$app_dir"
}

cmd_admin() {
  need_root
  local name="${1:-}"
  [ -n "$name" ] || die "Usage: sudo bash ops/deploy.sh admin ACCOUNT_NAME"
  printf '%s' "$name" | grep -Eq '^[A-Za-z0-9_.-]+$' || die "Account names are letters/numbers/_-. only."
  local app_dir; app_dir="$(require_repo)"
  ( cd "$app_dir" && docker compose --env-file .env exec -T postgres \
      psql -U towventure -d towventure -v ON_ERROR_STOP=1 -c \
      "UPDATE accounts SET flags = jsonb_set(coalesce(flags,'{}'::jsonb),'{admin}','true'::jsonb) WHERE lower(name) = lower('$name')" ) \
    | grep -q 'UPDATE 1' \
    && ok "'$name' is now an admin. Refresh the page — the ⚔ Admin button will appear." \
    || die "No account named '$name' found. Register it in the browser first."
}

cmd_simple() { # logs|status|stop|start|update|backup
  need_root
  local app_dir; app_dir="$(require_repo)"
  cd "$app_dir"
  case "$1" in
    logs)   docker compose --env-file .env logs -f --tail=120 ;;
    status) docker compose --env-file .env ps ;;
    stop)   docker compose --env-file .env stop && ok "Stopped." ;;
    start)  docker compose --env-file .env start && ok "Started." ;;
    update)
      git pull --ff-only 2>/dev/null || warn "git pull skipped (local changes or detached)"
      docker compose --env-file .env up -d --build && ok "Updated."
      ;;
    backup)
      docker compose --env-file .env exec -T backup sh -c \
        'pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="/backups/manual-$(date -u +%Y%m%dT%H%M%SZ).dump" && echo saved' \
        && ok "Backup saved to the 'backups' volume." \
        || die "Backup failed — is the stack running? (sudo bash ops/deploy.sh status)"
      ;;
  esac
}

case "${1:-install}" in
  install|"")            cmd_install ;;
  admin)                 shift; cmd_admin "${1:-}" ;;
  logs|status|stop|start|update|backup) cmd_simple "$1" ;;
  -h|--help|help)        sed -n '2,20p' "$0" ;;
  *)                     die "Unknown command: $1  (try: install, admin, logs, status, update, stop, start, backup)" ;;
esac
