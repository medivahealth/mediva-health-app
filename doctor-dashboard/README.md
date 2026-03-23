# Mediva Doctor + Admin dashboard

Single Vite app: **doctor** routes under `/`, **admin** after login via the hidden admin path (see `src/App.tsx`).

## Dev server

- **Port `5174`** (not 5173 — that is `mediva-voice-doctor`).
- **`npm run dev`** → open `http://localhost:5174`
- API: requests to `/api/*` are proxied to **`VITE_API_PROXY_TARGET`** (default `http://127.0.0.1:3000`). Copy `.env.example` → `.env` to override.

## Full stack

See repo **`docs/LOCAL_FULL_STACK.md`**.
