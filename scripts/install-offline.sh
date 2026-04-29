#!/bin/bash
# GGoose UI -- First-time setup for the offline release bundle (Linux / macOS)
# Run this once after extracting the release archive.
# Does NOT require internet, npm, git, or a system-wide Node.js installation.
#
# Usage:
#   tar xzf ggoose-ui-linux-x64.tar.gz
#   cd ggoose-ui-linux-x64
#   ./install-offline.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}[setup]${NC}  $*"; }
ok()   { echo -e "${GREEN}[ok]${NC}     $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}   $*"; }
die()  { echo -e "${RED}[error]${NC}  $*" >&2; exit 1; }

# Verify bundled node exists
[ -f "$DIR/node" ] || die "Bundled node binary not found. Did you extract the full archive?"

echo ""
echo "============================================================"
echo "  GGoose UI -- Setup"
echo "============================================================"
echo ""

# -- Create .env -------------------------------------------------------------
if [ -f "$DIR/.env" ]; then
  warn ".env already exists. Delete it and re-run to reconfigure."
else
  printf "  Admin username [admin]: "
  read -r ADMIN_USERNAME
  ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"

  while true; do
    printf "  Admin password: "
    read -rs ADMIN_PASSWORD; echo
    printf "  Confirm password: "
    read -rs ADMIN_PASSWORD2; echo
    [ "$ADMIN_PASSWORD" = "$ADMIN_PASSWORD2" ] && break
    echo "  Passwords do not match. Try again."
  done
  [ -z "$ADMIN_PASSWORD" ] && die "Password cannot be empty."

  printf "  Port [3000]: "
  read -r PORT
  PORT="${PORT:-3000}"

  AUTH_SECRET="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null | head -c 64 || echo 'CHANGE_THIS_SECRET')"

  cat > "$DIR/.env" <<ENV
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
AUTH_SECRET=${AUTH_SECRET}
COOKIE_SECURE=false
PORT=${PORT}
HOSTNAME=0.0.0.0
DATABASE_URL=file:${DIR}/data/goose.db
CORES_DIR=${DIR}/data/cores
NODE_ENV=production
ENV

  chmod 600 "$DIR/.env"
  ok "Created .env"
fi

# -- Directories -------------------------------------------------------------
mkdir -p "$DIR/data/cores" "$DIR/data/configs"
ok "Directories ready"

# -- Permissions -------------------------------------------------------------
chmod +x "$DIR/node" "$DIR/start.sh" 2>/dev/null || true
ok "Permissions set"

# -- Initialize database -----------------------------------------------------
set -a; source "$DIR/.env"; set +a
"$DIR/node" "$DIR/setup.js"
ok "Database initialized"

# -- Optional: systemd service -----------------------------------------------
if command -v systemctl &>/dev/null && [ "$(id -u)" -eq 0 ]; then
  echo ""
  printf "  Install as systemd service (auto-start on boot)? [y/N]: "
  read -r INSTALL_SVC
  if [[ "${INSTALL_SVC,,}" == "y" ]]; then
    cat > /etc/systemd/system/ggoose-ui.service <<UNIT
[Unit]
Description=GGoose UI
After=network.target

[Service]
Type=simple
WorkingDirectory=${DIR}
EnvironmentFile=${DIR}/.env
ExecStart=${DIR}/start.sh
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload
    systemctl enable ggoose-ui
    systemctl start ggoose-ui
    ok "Systemd service installed and started"
    echo ""
    echo "  Commands:"
    echo "    sudo systemctl status ggoose-ui"
    echo "    sudo journalctl -u ggoose-ui -f"
  fi
fi

echo ""
echo "============================================================"
echo "  Setup complete!"
echo ""

# Check if goose-client binary is already bundled
if [ -f "$DIR/data/cores/goose-client" ]; then
  echo "  goose-client binary is already bundled at data/cores/."
  chmod +x "$DIR/data/cores/goose-client"
else
  echo "  NOTE: goose-client binary not found at data/cores/."
  echo "  Download it from https://github.com/Kianmhz/GooseRelayVPN/releases"
  echo "  and place it at: $DIR/data/cores/goose-client"
  echo "  then run: chmod +x data/cores/goose-client"
fi

echo ""
echo "  1. Start GGoose UI:"
echo "       ./start.sh"
echo ""
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SERVER_IP')
echo "  2. Open in browser:"
echo "       http://${SERVER_IP}:${PORT:-3000}"
echo "============================================================"
echo ""