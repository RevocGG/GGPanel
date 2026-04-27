#!/usr/bin/env bash
# GGoose UI — Online install script
# Requires: Node.js 20+, npm, git, curl
# Usage: curl -fsSL https://raw.githubusercontent.com/RevocGG/GGoose-ui/main/scripts/install.sh | bash
set -euo pipefail

REPO="https://github.com/RevocGG/GGoose-ui.git"
INSTALL_DIR="${GGOOSE_INSTALL_DIR:-$HOME/ggoose-ui}"
NODE_MIN_VERSION=20

# ── Color helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
die()   { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

# ── Checks ───────────────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || die "Node.js not found. Install Node.js ${NODE_MIN_VERSION}+ first."
command -v npm  >/dev/null 2>&1 || die "npm not found."
command -v git  >/dev/null 2>&1 || die "git not found."

NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
[[ "$NODE_VER" -ge "$NODE_MIN_VERSION" ]] || die "Node.js ${NODE_MIN_VERSION}+ required (found v${NODE_VER})."

ok "Node.js v$(node --version | tr -d v) detected"

# ── Clone or update ──────────────────────────────────────────────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Updating existing installation at $INSTALL_DIR …"
  git -C "$INSTALL_DIR" pull --ff-only
else
  info "Cloning into $INSTALL_DIR …"
  git clone "$REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ── Environment ──────────────────────────────────────────────────────────────
if [[ ! -f ".env" ]]; then
  cp .env.example .env

  # Generate a random 64-char hex secret
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -hex 32)
  else
    SECRET=$(cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64)
  fi

  # Set AUTH_SECRET
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=${SECRET}|" .env

  # Prompt for credentials
  echo ""
  read -rp "Admin username [admin]: " ADMIN_USER
  ADMIN_USER="${ADMIN_USER:-admin}"
  read -rsp "Admin password: " ADMIN_PASS; echo
  [[ -z "$ADMIN_PASS" ]] && die "Password cannot be empty."

  sed -i "s|^ADMIN_USERNAME=.*|ADMIN_USERNAME=${ADMIN_USER}|" .env
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASS}|" .env

  ok ".env created"
else
  warn ".env already exists — skipping credential setup"
fi

# ── Install deps ─────────────────────────────────────────────────────────────
info "Installing dependencies …"
npm install --prefer-offline

# ── Prisma ───────────────────────────────────────────────────────────────────
info "Generating Prisma client …"
npx prisma generate

info "Running database migrations …"
npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init --skip-seed

# ── Build ────────────────────────────────────────────────────────────────────
info "Building production bundle …"
npm run build

# ── Systemd service (optional) ───────────────────────────────────────────────
if command -v systemctl >/dev/null 2>&1 && [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  info "Installing systemd service …"
  NODE_BIN=$(command -v node)
  cat > /etc/systemd/system/ggoose-ui.service <<EOF
[Unit]
Description=GGoose UI
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
  ok "Service installed and started. Open http://localhost:3000"
else
  echo ""
  ok "Installation complete!"
  echo -e "  Run: ${CYAN}cd ${INSTALL_DIR} && npm start${NC}"
  echo -e "  Or:  ${CYAN}cd ${INSTALL_DIR} && node .next/standalone/server.js${NC}"
  echo -e "  URL: http://localhost:3000"
fi
