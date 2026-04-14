# AGENTS.md

## Cursor Cloud specific instructions

### Overview

SBN (Cycle State) is a real-time cryptocurrency market analysis SPA built with React 19, Vite 8, TypeScript 6, and Tailwind CSS 4. It connects to Binance WebSocket/REST for live BTC price data, runs a DSP pipeline in a Web Worker, and persists state to Supabase (cloud-hosted Postgres). There is no local database.

### Environment variables

A `.env` file is required in the project root with:

```
VITE_SUPABASE_URL=https://exlifmihtsikwyzokong.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_NLALKqvvfAm4jPNDhEhuBw_2GHcJztu
```

These values come from the workspace rules (`.cursor/rules/supabase.mdc`). The `.env` file is gitignored.

### Standard commands

All standard commands are in `package.json` scripts:

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (Vite on port 5173 with Binance WS/REST proxy) |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Tests | `npm run test` (Vitest, 62 tests across 9 files) |
| Build | `npm run build` |

### Notes and caveats

- **Pre-existing lint errors**: The codebase has ~39 ESLint errors and 6 warnings (mostly `react-hooks` rules and `no-explicit-any`). These are pre-existing and not blocking.
- **No Docker or local DB**: The app is a pure client-side SPA with a lightweight Node.js production server. All persistence goes to Supabase cloud.
- **Binance proxy**: The Vite dev server proxies `/ws-binance` and `/api-binance` to Binance endpoints to avoid CORS. The production `server.js` does the same.
- **Web Worker**: The heavy DSP pipeline runs in `src/workers/dsp.worker.ts`. Hot reload does not apply to the worker — a full page refresh is needed after editing worker code.
- **Node.js v22**: The environment uses Node.js v22 with npm as the package manager (`package-lock.json`).
