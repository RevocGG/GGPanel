# GGoose UI

[![GitHub Release](https://img.shields.io/github/v/release/RevocGG/GGoose-ui?logo=github)](https://github.com/RevocGG/GGoose-ui/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[راهنمای فارسی](README_FA.md)**

A self-hosted web dashboard to manage [GooseRelayVPN](https://github.com/Kianmhz/GooseRelayVPN) client cores. Create, configure, start/stop, and monitor multiple VPN cores from one browser tab — no terminal required.

> GooseRelayVPN is a SOCKS5 VPN that tunnels TCP through Google Apps Script to your own VPS, inspired by [MasterHttpRelayVPN](https://github.com/masterking32/MasterHttpRelayVPN).

---

## Features

- 🖥️ **Web UI** — manage all cores from a browser
- ▶️ **Start / Stop / Restart** cores with one click
- 📋 **Live log streaming** — real-time output via SSE
- 📊 **Usage statistics** — per-core daily & total request counters
- 🔑 **Multiple script keys** per core with round-robin load balancing
- 🔒 **Secure login** — JWT session, bcrypt-style timing-safe credential check
- 📦 **Offline bundles** — pre-built archives with embedded Node.js (no dependencies needed)
- 🐳 **Docker support** — one-command deployment with Docker Compose
- 🤖 **Auto-downloads** `goose-client` binary from GooseRelayVPN releases at build time

---

## Quick Start — Offline Bundle (Recommended)

No Node.js, npm, or internet connection required on the target machine.

### Linux / macOS

```bash
# Download the bundle for your platform from the Releases page
tar xzf ggoose-ui-vX.Y.Z-linux-x64.tar.gz
cd ggoose-ui-vX.Y.Z-linux-x64

./install-offline.sh   # first-time setup (sets credentials, initialises DB)
./start.sh             # start the server
```

Open `http://SERVER_IP:3000` in your browser.

### Windows

1. Download and extract the `.zip` bundle from the [Releases page](https://github.com/RevocGG/GGoose-ui/releases/latest)
2. Double-click **`install.bat`** (first-time setup)
3. Double-click **`start.bat`** to start the server

Open `http://localhost:3000` in your browser.

> The bundle already includes the `goose-client` binary — no manual download needed.

---

## Quick Start — Docker Compose

Requires Docker and Docker Compose (internet access for the initial pull).

```bash
git clone https://github.com/RevocGG/GGoose-ui.git
cd GGoose-ui
cp .env.example .env
# Edit .env — set ADMIN_USERNAME, ADMIN_PASSWORD, AUTH_SECRET
docker compose up -d
```

Open `http://localhost:3000`.

To update:

```bash
docker compose pull
docker compose up -d
```

---

## Quick Start — From Source

Requires Node.js 20+ and npm.

```bash
git clone https://github.com/RevocGG/GGoose-ui.git
cd GGoose-ui
npm install
npx prisma generate
cp .env.example .env   # edit credentials
node scripts/setup.js  # initialise DB
npm run build
node .next/standalone/server.js
```

---

## Configuration

Copy `.env.example` to `.env` and set:

| Variable | Required | Description |
|---|---|---|
| `ADMIN_USERNAME` | ✅ | Login username |
| `ADMIN_PASSWORD` | ✅ | Login password |
| `AUTH_SECRET` | ✅ | 64-char random hex — signs JWT sessions. Generate with `openssl rand -hex 32` |
| `PORT` | — | HTTP port (default `3000`) |
| `DATABASE_URL` | — | SQLite path (default `file:./data/goose.db`) |
| `CORES_DIR` | — | Directory for core binaries (default `data/cores`) |

---

## Adding a Core

1. Open the dashboard → **Cores** → **New Core**
2. Fill in:
   - **Name** — display name
   - **Binary** — filename of the `goose-client` binary in `data/cores/` (included in the bundle)
   - **SOCKS port** — local port for this core (e.g. `1080`)
   - **Script keys** — your Google Apps Script deployment IDs
   - **Tunnel key** — 64-char hex AES key (must match your VPS server config)
3. Click **Create**, then **Start**

---

## Platforms

| Platform | Offline Bundle | Docker |
|---|---|---|
| Linux x64 | ✅ | ✅ |
| Linux arm64 | ✅ | ✅ |
| macOS x64 (Intel) | ✅ | — |
| macOS arm64 (Apple Silicon) | ✅ | — |
| Windows x64 | ✅ | — |

---

## Building from GitHub Actions

Push a tag `vX.Y.Z` to trigger the release workflow:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow:
1. Builds the Next.js standalone bundle
2. Downloads `goose-client` for each target platform from [GooseRelayVPN releases](https://github.com/Kianmhz/GooseRelayVPN/releases/latest)
3. Embeds Node.js 22 binary
4. Creates platform archives and publishes a GitHub Release

---

## Project Structure

```
GGoose-ui/
├── src/
│   ├── app/               # Next.js App Router pages & API routes
│   ├── components/        # UI components (cores, dashboard, auth)
│   └── lib/               # process-manager, db, config-writer, auth
├── scripts/
│   ├── setup.js           # Idempotent DB initialiser (no Prisma CLI needed)
│   ├── install-offline.sh # First-time setup for offline bundles
│   ├── start.sh           # Launcher script (Linux/macOS)
│   ├── install.bat        # First-time setup (Windows)
│   └── start.bat          # Launcher script (Windows)
├── data/
│   ├── cores/             # Place goose-client binary here
│   └── configs/           # Auto-generated per-core JSON configs
├── prisma/                # Prisma schema + migrations
├── Dockerfile
├── docker-compose.yml
└── .github/workflows/
    └── release.yml        # Build & release workflow
```

---

## Support the Project

If you find this project useful, consider supporting its development:

| Network | Address |
|---|---|
| TON | `UQBW_LoEhcYPIzZL_dzp-OMsqI5uAwv8p6dXy8wzzkPU-CQQ` |
| BNB / USDT (BEP-20) | `0x951acaf8d4b61a000d3b5c697abcabf52973d0cf` |
| TRX | `TL4Kej6DjJmT9gQ5ghmQcvsEUHPdnNNPyj` |
| SOL | `45kAfGyh13bcyYTdbNLkVfBGtMgq4WMijLgdBK9G9ugN` |

---

## Related

- [GooseRelayVPN](https://github.com/Kianmhz/GooseRelayVPN) — the VPN engine (client + server binaries, Apps Script)
- [MasterHttpRelayVPN](https://github.com/masterking32/MasterHttpRelayVPN) — the project that inspired GooseRelayVPN

---

## License

MIT
