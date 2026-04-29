#!/usr/bin/env bash
# GGoose UI — Uninstall script (Linux / macOS)
# Removes the installed service, data directory, and optionally all files.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}[info]${NC}  $*"; }
ok()   { echo -e "${GREEN}[ok]${NC}    $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $*"; }
die()  { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

echo ""
echo "============================================================"
echo "  GGoose UI -- Uninstall"
echo "============================================================"
echo ""
warn "This will stop and remove the GGoose UI service and all its data."
printf "  Are you sure you want to continue? [y/N]: "
read -r CONFIRM
[[ "${CONFIRM,,}" == "y" ]] || { info "Aborted."; exit 0; }

# ── Stop and remove systemd service ─────────────────────────────────────────
if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files ggoose-ui.service &>/dev/null; then
    info "Stopping and disabling systemd service …"
    systemctl stop  ggoose-ui.service 2>/dev/null || true
    systemctl disable ggoose-ui.service 2>/dev/null || true
    rm -f /etc/systemd/system/ggoose-ui.service
    systemctl daemon-reload
    ok "Service removed"
  fi
fi

# ── Remove data directory ────────────────────────────────────────────────────
if [ -d "$DIR/data" ]; then
  printf "  Remove data directory (database, cores, configs)? [y/N]: "
  read -r REMOVE_DATA
  if [[ "${REMOVE_DATA,,}" == "y" ]]; then
    rm -rf "$DIR/data"
    ok "Data directory removed"
  else
    warn "Data directory kept at $DIR/data"
  fi
fi

# ── Remove .env ──────────────────────────────────────────────────────────────
if [ -f "$DIR/.env" ]; then
  rm -f "$DIR/.env"
  ok "Removed .env"
fi

# ── Remove the installation directory itself ─────────────────────────────────
PARENT="$(dirname "$DIR")"
printf "  Remove the entire installation directory (%s)? [y/N]: " "$DIR"
read -r REMOVE_DIR
if [[ "${REMOVE_DIR,,}" == "y" ]]; then
  cd "$PARENT"
  rm -rf "$DIR"
  ok "Installation directory removed"
  echo ""
  ok "GGoose UI has been completely uninstalled."
else
  echo ""
  ok "GGoose UI service and configuration removed. Files remain at $DIR"
fi
