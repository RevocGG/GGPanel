# GGPanel

![GGPanel Dashboard](./docs/images/dashboard-preview.png)

[![GitHub Release](https://img.shields.io/github/v/release/RevocGG/GGoose-ui?logo=github)](https://github.com/RevocGG/GGoose-ui/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[راهنمای فارسی](README_FA.md)**

A self-hosted web dashboard to manage [GooseRelayVPN](https://github.com/Kianmhz/GooseRelayVPN) and [FlowDriver](https://github.com/NullLatency/FlowDriver) client cores. Create, configure, start/stop, and monitor multiple tunnel cores from one browser tab — no terminal required.

> **Supported engines:**
> - [GooseRelayVPN](https://github.com/Kianmhz/GooseRelayVPN) — SOCKS5 VPN tunneling via Google Apps Script
> - [FlowDriver](https://github.com/NullLatency/FlowDriver) — SOCKS5 VPN tunneling via Google Drive API (OAuth2 flow built-in)

---

## Features

- 🖥️ **Web UI** — manage all cores from a browser
- ▶️ **Start / Stop / Restart** cores with one click
- 📋 **Live log streaming** — real-time output via SSE
- 📊 **Usage statistics** — per-core daily & total request counters
- 🔑 **Multiple script keys** per core with round-robin load balancing (GooseRelayVPN)
- 🌊 **FlowDriver support** — OAuth2 browser flow built-in, credentials.json upload, Google Drive API tunneling ([FlowDriver](https://github.com/NullLatency/FlowDriver))
- 🔒 **Secure login** — JWT session, bcrypt-style timing-safe credential check
- 📦 **Offline bundles** — pre-built archives with embedded Node.js (no dependencies needed)
- 🐳 **Docker support** — one-command deployment with Docker Compose

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

### GooseRelayVPN Core 🪿

1. Dashboard → **Cores** → **New Core** → **GooseRelayVPN**
2. Fill in:
   - **Name** — display name
   - **Binary** — `goose-client` binary filename in `data/cores/`
   - **SOCKS port** — local port (e.g. `1080`)
   - **Script keys** — your Google Apps Script deployment IDs
   - **Tunnel key** — 64-char hex AES key (must match your VPS server config)
3. Click **Create**, then **Start**

### FlowDriver Core 🌊 ([FlowDriver](https://github.com/NullLatency/FlowDriver))

1. Dashboard → **Cores** → **New Core** → **FlowDriver**
2. Fill in:
   - **Name** — display name
   - **Binary** — FlowDriver client binary filename in `data/cores/`
   - **Listen Address** — local SOCKS5 address (e.g. `127.0.0.1:1080`)
   - **credentials.json** — upload your Google OAuth2 credentials file (from Google Cloud Console) or enter the absolute path
3. Click **Create**, then **Start**
4. On first start, an OAuth2 authentication dialog appears — complete the browser auth flow in the Logs tab
5. After first auth, a `.token` file is saved — future starts are silent

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

- [GooseRelayVPN](https://github.com/Kianmhz/GooseRelayVPN) — SOCKS5 VPN via Google Apps Script (client + server + Apps Script)
- [FlowDriver](https://github.com/NullLatency/FlowDriver) — SOCKS5 VPN via Google Drive API
- [MasterHttpRelayVPN](https://github.com/masterking32/MasterHttpRelayVPN) — the project that inspired GooseRelayVPN

---

## License

MIT
