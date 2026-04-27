# GGoose UI — Copilot Instructions

## Project Overview
GGoose UI is a professional web-based management platform for tunnel/VPN tools that route traffic
through Google Apps Script. It is built to be extensible: new projects similar to GooseRelayVPN
can be added without modifying the core UI infrastructure.

The reference core project is [GooseRelayVPN](https://github.com/Kianmhz/GooseRelayVPN).

---

## CRITICAL: Core / UI Separation

> **This is the most important architectural rule. Never violate it.**

- The binary executables (`goose-client`, `goose-server`, or any future tool) **MUST NEVER** be
  committed to this repository or bundled inside the application code.
- Binaries are stored exclusively in the `data/cores/` directory, which is git-ignored.
- The UI treats binaries as opaque executables — it only stores their filesystem path.
- Users must be able to drop **any version** of **any compatible binary** into `data/cores/` and
  select it from the UI without code changes.
- The default install script downloads the latest release binary automatically, but the UI itself
  has zero coupling to any specific binary version or build.
- When adding support for a new project type in the future, only add:
  1. A new config schema/type in `src/types/`
  2. A new set of pages under `src/app/(dashboard)/projects/[slug]/`
  3. A new config writer in `src/lib/`
  The process manager, auth, DB, and core infrastructure remain unchanged.

---

## Adding a New Project

To add a new tunneling/VPN project (similar to GooseRelayVPN):

1. Define its config interface in `src/types/index.ts`
2. Add a Prisma model for its config in `prisma/schema.prisma` (run `prisma migrate dev`)
3. Create a config writer in `src/lib/config-writer-[project].ts`
4. Add pages: `src/app/(dashboard)/projects/[slug]/page.tsx`
5. Add a project registry entry in `src/lib/projects.ts` (to be created when needed)
6. The process manager, auth, docker, and install scripts need **zero changes**

---

## Technology Stack

### Frontend
- **Next.js**: Always use the latest stable version (currently `16.x`)
- **React**: Always use the latest stable version bundled with Next.js (currently `19.x`)
- **TypeScript**: Always use the latest stable version (currently `6.x`)
- **Tailwind CSS**: Always use the latest stable version (currently `4.x`)
- **TanStack Query**: Always use the latest v5 (currently `5.x`)
- **lucide-react**: Always use the latest version

### Backend (API Routes)
- **Prisma**: Always use the latest version (currently `7.x`) with SQLite
- **jose**: For JWT session management
- **bcryptjs**: For password hashing (if needed)
- **Node.js child_process**: For spawning/managing core binaries

### Tooling
- **Node.js**: Minimum version 20.9 (Next.js 16 requirement)

---

## Dependency Policy

> **Always use the latest stable version of every dependency.**

- Before adding a new package, check npm for the latest version.
- Do not pin to old versions unless there is a documented incompatibility.
- Update `package.json` with exact latest versions.
- Run `npm install` after any dependency change.

---

## Code Architecture

### API Routes
- Live under `src/app/api/`
- Protected by JWT session cookie (checked in `proxy.ts`)
- Return JSON responses with consistent shape: `{ data?, error?, message? }`
- Use Zod for all input validation at the boundary

### Database
- SQLite via Prisma — single `data/goose.db` file
- All DB access goes through `src/lib/db.ts` singleton
- No raw SQL — always use the Prisma client

### Process Manager
- Singleton at `src/lib/process-manager.ts`
- Manages spawned child processes keyed by `coreId`
- Never import directly in client components — only in API routes

### Authentication
- Single admin user — credentials from environment variables
- JWT stored in `session` httpOnly cookie
- Route protection via `proxy.ts` (Next.js 16 Proxy API)
- Timing-safe credential comparison

### Real-time Logs
- SSE (Server-Sent Events) endpoint at `/api/cores/[id]/logs`
- In-memory ring buffer (500 lines max) per running process
- Persisted to DB (last 1000 lines per core) for stopped cores

---

## Next.js 16 Specific Rules

- **Always `await` dynamic APIs**: `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()`
- **Use `proxy.ts`** (not `middleware.ts`) for route-level request interception
- **Server Components** are the default — only add `"use client"` when needed
- **Server Actions** use `"use server"` and are imported by client components
- **`output: 'standalone'`** must remain in `next.config.ts` for Docker/offline deployment

---

## UI/UX Standards

- **Theme**: Dark cyberpunk with glassmorphism — primary accent `#22D3EE` (cyan), secondary `#A855F7` (purple)
- **Background**: Deep navy `#050B1F`
- All cards use the `.glass` class (backdrop blur + border)
- Status indicators: green=running, red=stopped/error, yellow=starting
- Quota warnings: orange at 80%, red at 95% of daily limit
- Mobile responsive — sidebar collapses to hamburger on small screens

---

## Security Rules

- Never log or display `tunnel_key` in the UI output
- All user input validated with Zod before use
- httpOnly + sameSite cookies for sessions
- No client-side secrets
- CORS is not needed (same-origin API)

---

## File Structure Reference

```
GGoose-ui/
├── src/
│   ├── app/
│   │   ├── (auth)/login/         # Login page + server action
│   │   ├── (dashboard)/          # Protected dashboard routes
│   │   │   ├── page.tsx          # Overview dashboard
│   │   │   └── cores/            # Core management
│   │   └── api/                  # API routes
│   ├── components/
│   │   ├── ui/                   # Base UI primitives
│   │   ├── layout/               # Sidebar, Header
│   │   └── cores/                # Core-specific components
│   ├── lib/
│   │   ├── db.ts                 # Prisma singleton
│   │   ├── auth.ts               # JWT utilities
│   │   ├── process-manager.ts    # Child process lifecycle
│   │   ├── config-writer.ts      # Write JSON config files
│   │   └── utils.ts              # Shared utilities (cn, etc.)
│   └── types/
│       └── index.ts              # All TypeScript types
├── prisma/
│   └── schema.prisma
├── data/                         # GITIGNORED — runtime data
│   ├── cores/                    # User-provided binaries go here
│   ├── configs/                  # Auto-generated core configs
│   └── goose.db                  # SQLite database
├── proxy.ts                      # Next.js 16 route protection
├── scripts/
│   ├── install.sh                # Online install (requires internet)
│   └── install-offline.sh        # Offline install from release archive
├── Dockerfile
└── docker-compose.yml
```
