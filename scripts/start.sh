#!/bin/bash
# GGoose UI — Launcher (Linux / macOS)
# Place this file next to server.js in the release bundle.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Load .env ──────────────────────────────────────────────────────────
if [ -f "$DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$DIR/.env"
  set +a
fi

# ── Validate required config ──────────────────────────────────────────
if [ -z "${ADMIN_USERNAME:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo ""
  echo "  ERROR: ADMIN_USERNAME and ADMIN_PASSWORD are not set."
  echo "  Copy .env.example to .env and fill in the values, then run:"
  echo ""
  echo "    ./install.sh   (first-time interactive setup)"
  echo "    ./start.sh     (subsequent starts)"
  echo ""
  exit 1
fi

# ── Defaults ──────────────────────────────────────────────────────────
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export DATABASE_URL="${DATABASE_URL:-file:$DIR/data/goose.db}"
export CORES_DIR="${CORES_DIR:-$DIR/data/cores}"
export AUTH_SECRET="${AUTH_SECRET:-}"
export ADMIN_USERNAME="${ADMIN_USERNAME}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD}"

if [ -z "${AUTH_SECRET:-}" ]; then
  echo "[warn] AUTH_SECRET not set — sessions will not survive restart. Set it in .env"
  export AUTH_SECRET
  AUTH_SECRET="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null | head -c 64 || echo 'fallback-secret-please-change')"
fi

# ── Ensure directories and initialize DB ──────────────────────────────
mkdir -p "$DIR/data/cores" "$DIR/data/configs"
DATABASE_URL="$DATABASE_URL" "$DIR/node" "$DIR/setup.js"

# ── Start server ──────────────────────────────────────────────────────
echo "[ggoose] Starting on http://${HOSTNAME}:${PORT}"
cd "$DIR"
exec "$DIR/node" server.js
