# Mediva — full local stack: ports, start order, one-pass testing

**Option B — ngrok:** **[`NGROK_FULL_E2E.md`](./NGROK_FULL_E2E.md)** · **`npm run ngrok:go`** · **`npm run ngrok:env`** · voice: **`npm run dev`** (ngrok adds HTTPS).

**Which IP from `ipconfig`?** See **[`YOUR_PC_IP.md`](./YOUR_PC_IP.md)** (use **Wi‑Fi** IPv4, e.g. `192.168.1.5` — **not** `192.168.56.1`).

Use this so **nothing shares a port** and you can verify **app · doctor · admin · voice** in one session.

## Port map (do not change casually)

| Port | Service | Folder | Command |
|------|---------|--------|---------|
| **3000** | Nest API + `/voice` WebSocket | `backend/` | `npm run start:dev` |
| **5173** | Mediva Voice (Gemini Live web) | `mediva-voice-doctor/` | `npm run dev:https` (iPhone mic) or `npm run dev` |
| **5174** | Doctor + **Admin** dashboard (one Vite app) | `doctor-dashboard/` | `npm run dev` |
| **8081** (typical) | Expo Metro | repo root | `npx expo start` |

**Doctor and Admin** are the **same** app (`doctor-dashboard`): doctor login vs hidden admin route — not two servers.

---

## 0. Env files (three places)

| File | Purpose |
|------|---------|
| **`backend/.env`** | MongoDB, Redis, JWT, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `BACKEND_URL`, S3, Pinecone, `ADMIN_EMAIL` / `ADMIN_PASSWORD`, … |
| **Repo root `.env`** | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_VOICE_WEB_URL`, `API_URL` — **your PC LAN IP** + ports **3000** / **5173** |
| **`mediva-voice-doctor/.env.local`** | `GEMINI_API_KEY` for browser voice |
| **`doctor-dashboard/.env`** (optional) | `VITE_API_PROXY_TARGET=http://127.0.0.1:3000` or `http://<LAN_IP>:3000` |

Align **LAN IP** across root `.env` and `backend/.env` `BACKEND_URL` when testing on a **physical phone**.

---

## 1. Start everything (4 terminals)

Run in this order:

### Terminal A — Backend (port 3000)

```bash
cd backend
npm install
npm run start:dev
```

- Listen address is **0.0.0.0:3000** (phones on Wi‑Fi can reach it).
- Quick check: open `http://<YOUR_LAN_IP>:3000/api` in a browser (expect JSON or route, not connection refused).

### Terminal B — Voice web (port 5173, HTTPS for iPhone)

```bash
cd mediva-voice-doctor
npm install
# .env.local must contain: GEMINI_API_KEY=...
npm run dev:https   # required for iPhone WebView microphone
# npm run dev       # HTTP only — ok for some Android / desktop tests
```

- Check: `https://<LAN_IP>:5173` on the **phone browser** first (accept cert warning if self-signed).

### Terminal C — Doctor + Admin dashboard (port 5174)

```bash
cd doctor-dashboard
npm install
# Optional: copy .env.example → .env and set VITE_API_PROXY_TARGET if needed
npm run dev
```

- Open **`http://localhost:5174`** (or `http://<LAN_IP>:5174` from another device).
- API calls go to **`/api`** → Vite proxies to **`VITE_API_PROXY_TARGET`** (default `http://127.0.0.1:3000`).

### Terminal D — Expo app

```bash
cd ..   # repo root (mediva_ai)
npx expo start -c
```

- Root `.env` must include:
  - `EXPO_PUBLIC_API_URL=http://<LAN_IP>:3000/api`
  - `EXPO_PUBLIC_VOICE_WEB_URL=https://<LAN_IP>:5173` (match `dev:https`; see [`EXPO_VOICE_WEB.md`](./EXPO_VOICE_WEB.md))

---

## 2. One-pass test checklist

Do these **after all four** processes are running.

### Mobile app (Expo)

1. Log in (OTP / phone).
2. **Chat** — send a message → backend + OpenRouter + RAG.
3. **Talk** — opens WebView → should load **`EXPO_PUBLIC_VOICE_WEB_URL`** → tap Talk → allow mic → hear Gemini.

### Mediva Voice (browser, optional sanity)

4. On PC: `https://localhost:5173` (with `dev:https`) — same as inside WebView.

### Doctor dashboard

5. `http://localhost:5174/login` — doctor account (JWT from your auth flow / seeded doctor user per your DB).
6. Prescriptions / cases / AI Scribe as you use them.

### Admin (same Vite app, different entry)

7. Admin login route (hidden path in app):  
   **`http://localhost:5174/hfufibfuvive/ffie@`**  
   Use credentials from **`backend/.env`**: `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
8. After login, admin nav: doctors, applications, articles, feedback.

---

## 3. If something fails

| Symptom | Check |
|---------|--------|
| **Port already in use** | Kill the other process or change **only** the conflicting app’s config (keep table above). |
| **5173 vs 5174 conflict** | Voice = **5173** only. Dashboard = **5174** only. |
| **Doctor UI 401 / network** | Backend on **3000**; `doctor-dashboard` proxy target; browser URL must be **5174** so `/api` proxies correctly. |
| **Expo can’t reach API** | `EXPO_PUBLIC_API_URL`, firewall **3000**, same Wi‑Fi. |
| **Expo Talk blank** | `EXPO_PUBLIC_VOICE_WEB_URL`, Vite voice on **5173**, firewall **5173**. |
| **Talk opens, mic dead (iPhone)** | Use **`dev:https`** + **`https://<LAN_IP>:5173`** in `.env`. |
| **Admin login fails** | `ADMIN_EMAIL` / `ADMIN_PASSWORD` in **`backend/.env`**; backend restarted after edits. |

---

## 4. Production note

- Replace LAN URLs with **https** deployment URLs in root `.env` / EAS secrets.
- Do not rely on `usesCleartextTraffic` for release Android builds without TLS.

---

## Related

- Deeper env explanation: `docs/END_TO_END_SETUP.md`
- Voice WebView only: `docs/EXPO_VOICE_WEB.md`
