#!/usr/bin/env bash
# GGoose UI — Offline install script
# For air-gapped servers. Expects a release archive: ggoose-ui-release.tar.gz
# that was built with `npm run build` on the target OS.
#
# Usage:
#   tar xzf ggoose-ui-release.tar.gz
#   cd ggoose-ui-release
#   bash install-offline.sh
set -euo pipefail

INSTALL_DIR="${GGOOSE_INSTALL_DIR:-/opt/ggoose-ui}"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
die()   { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "Node.js not found."

NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
[[ "$NODE_VER" -ge 20 ]] || die "Node.js 20+ required (found v${NODE_VER})."

# Ensure we're in the extracted directory
[[ -f "package.json" ]] || die "Run this script from the extracted release directory."
[[ -d ".next/standalone" ]] || die ".next/standalone not found. Ensure the archive was built with npm run build."

# ── Copy to install dir ───────────────────────────────────────────────────────
info "Installing to $INSTALL_DIR …"
mkdir -p "$INSTALL_DIR"
cp -r . "$INSTALL_DIR/"
cd "$INSTALL_DIR"

# ── Standalone server setup ───────────────────────────────────────────────────
# Copy static assets into standalone for self-contained run
cp -r .next/static .next/standalone/.next/static 2>/dev/null || true
cp -r public .next/standalone/public 2>/dev/null || true

# ── Environment ──────────────────────────────────────────────────────────────
if [[ ! -f ".env" ]]; then
  cp .env.example .env

  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -hex 32)
  else
    SECRET=$(cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64)
  fi
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=${SECRET}|" .env

  echo ""
  read -rp "Admin username [admin]: " ADMIN_USER
  ADMIN_USER="${ADMIN_USER:-admin}"
  read -rsp "Admin password: " ADMIN_PASS; echo
  [[ -z "$ADMIN_PASS" ]] && die "Password cannot be empty."

  sed -i "s|^ADMIN_USERNAME=.*|ADMIN_USERNAME=${ADMIN_USER}|" .env
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASS}|" .env
  ok ".env created"
else
  warn ".env already exists — skipping"
fi

# ── Database ─────────────────────────────────────────────────────────────────
mkdir -p data
info "Initializing database …"
# Use bundled prisma migrate if available
if [[ -f "node_modules/.bin/prisma" ]]; then
  node_modules/.bin/prisma migrate deploy
else
  warn "Prisma CLI not found in node_modules. DB init skipped — run 'npx prisma migrate deploy' manually."
fi

# ── Systemd ───────────────────────────────────────────────────────────────────
if command -v systemctl >/dev/null 2>&1 && [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  NODE_BIN=$(command -v node)
  cat > /etc/systemd/system/ggoose-ui.service <<EOF
[Unit]
Description=GGoose UI (offline install)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${NODE_BIN} .next/standalone/server.js
Restart=on-failure
RestartSec=5
EnvironmentFile=${INSTALL_DIR}/.env
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable ggoose-ui
  systemctl restart ggoose-ui
  ok "Service installed. Open http://localhost:3000"
else
  echo ""
  ok "Offline install complete!"
  echo -e "  Run: ${CYAN}cd ${INSTALL_DIR} && node .next/standalone/server.js${NC}"
  echo -e "  URL: http://localhost:3000"
fi
