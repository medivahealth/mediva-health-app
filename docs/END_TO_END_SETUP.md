# Mediva — end-to-end local setup (backend `.env` + app + voice web)

## Default: same Wi‑Fi, **no ngrok**

**→ [`EXPO_FULL_TEST_LOCAL.md`](./EXPO_FULL_TEST_LOCAL.md)** — LAN IP, `npm run dev:https` for **`mediva-voice-doctor`**, dev client, full app test.

Quick commands:

```powershell
npm run env:lan          # root .env + backend BACKEND_URL / FRONTEND_URL
npm run e2e:local        # opens backend + voice (dev:https), then Expo
```

---

## Option B — ngrok (phone on any network, Expo Go)

**Full runbook (keys, scripts, test checklist):** [`NGROK_FULL_E2E.md`](./NGROK_FULL_E2E.md)

**Short version:**

1. **Real** token (once): `C:\ngrok\ngrok.exe config add-authtoken <paste from https://dashboard.ngrok.com/get-started/your-authtoken>` — **not** the literal `YOUR_NGROK_TOKEN`.
2. `mediva-voice-doctor\.env.local` → `GEMINI_API_KEY=...` · `backend\.env` from `backend\.env.example`
3. Repo root: **`npm run ngrok:go`** — opens backend + Vite + 2× ngrok, prompts for both **https** URLs, updates `.env` + `BACKEND_URL`, runs quick tests, starts Expo.

**Update `.env` only (URLs already copied):** `npm run ngrok:env` or `scripts\ngrok-update-env.ps1`

**→ Ports + start order + one-pass test (app, doctor, admin, voice):** [`LOCAL_FULL_STACK.md`](./LOCAL_FULL_STACK.md)

You use **three separate environment files**. They do **not** merge: each process only reads its own file.

| File | Who reads it | Purpose |
|------|----------------|---------|
| **`backend/.env`** | NestJS (`npm run start:dev` in `backend/`) | Database, JWT, OpenRouter, S3, **GEMINI_API_KEY** (native `/voice` socket if you use it), Pinecone, Redis, etc. |
| **`.env`** (repo root, next to `App.tsx`) | Expo / Metro | **`EXPO_PUBLIC_*`** only → mobile app API base URL + embedded voice WebView URL |
| **`mediva-voice-doctor/.env.local`** | Vite (`npm run dev` in `mediva-voice-doctor/`) | **`GEMINI_API_KEY`** for **browser** Gemini Live (Talk button → WebView) |

---

## 1. One-time: same LAN IP everywhere

On your PC, find **Wi‑Fi IPv4** (e.g. `192.168.1.5`). Phone and PC must be on the **same Wi‑Fi**.

Use that IP in:

- **Root `.env`**: `EXPO_PUBLIC_API_URL`, `API_URL`, `EXPO_PUBLIC_VOICE_WEB_URL`
- **`backend/.env`**: `BACKEND_URL` (and `FRONTEND_URL` if you use email/deep links in dev)

Example (replace with your IP):

```env
# backend/.env
BACKEND_URL=http://192.168.1.5:3000
FRONTEND_URL=http://192.168.1.5:8081
```

```env
# repo root .env
EXPO_PUBLIC_API_URL=http://192.168.1.5:3000/api
API_URL=http://192.168.1.5:3000
EXPO_PUBLIC_VOICE_WEB_URL=https://192.168.1.5:5173
```

**Physical iPhone:** WKWebView needs **HTTPS** for the microphone. Run **`mediva-voice-doctor`** with **`npm run dev:https`** and use an **`https://…:5173`** URL above. See [`EXPO_VOICE_WEB.md`](./EXPO_VOICE_WEB.md).

Windows helper (repo root):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/update-expo-lan-env.ps1
```

Then set **`BACKEND_URL` / `FRONTEND_URL`** in `backend/.env` manually to the same IP.

---

## 2. `backend/.env` — required for “everything” on the API

Nest loads **`backend/.env`** automatically (working directory = `backend/`).

### Must-have for core product

| Variable | Role |
|----------|------|
| `PORT` | Default `3000` |
| `MONGODB_URI` | MongoDB (Atlas or local) |
| `JWT_SECRET` | Access token signing |
| `JWT_REFRESH_SECRET` | Refresh token signing |
| `JWT_EXPIRES_IN` | Access token TTL (e.g. `7d`) — **use this name** (not only `JWT_EXPIRATION_TIME`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh TTL (e.g. `30d`) |
| `OPENROUTER_API_KEY` | Chat / RAG LLM |
| `REDIS_URL` | If your stack uses Redis features |

### RAG / vectors

| Variable | Role |
|----------|------|
| `PINECONE_API_KEY` | Pinecone client |
| `PINECONE_INDEX` **or** `PINECONE_INDEX_NAME` | Index name (code accepts **either**) |

### Voice (native Socket.IO gateway — optional if you only use WebView voice)

| Variable | Role |
|----------|------|
| `GEMINI_API_KEY` | Gemini Live on server |
| `GEMINI_VOICE_MODEL` | Optional override |

### URLs

| Variable | Role |
|----------|------|
| `BACKEND_URL` | Public base URL of API (no `/api` suffix) — use **LAN IP** in dev for phone |
| `FRONTEND_URL` | Web / Expo origin if used for redirects or emails |

### Dev listen address

`backend/src/main.ts` uses **`HOST=0.0.0.0`** by default so phones can reach port **3000**. Do not bind only to `127.0.0.1` on the machine that serves the app.

---

## 3. Root `.env` — Expo app only

Expo embeds **`EXPO_PUBLIC_*`** at bundle time.

- After any change: **`npx expo start -c`**
- **`EXPO_PUBLIC_API_URL`** must end with **`/api`** (or base without `/api` — `api.ts` normalizes)
- **`EXPO_PUBLIC_VOICE_WEB_URL`** = Vite voice app — use **`https://<LAN_IP>:5173`** with **`npm run dev:https`** on a real iPhone (mic); **`http://`** is ok for some Android setups

---

## 4. `mediva-voice-doctor/.env.local` — browser voice

```env
GEMINI_API_KEY=your_google_ai_studio_key
```

Can be the **same key** as `backend/.env` `GEMINI_API_KEY` for local dev. Restart Vite after edits.

Voice dev server (listens on all interfaces, port **5173**):

```bash
cd mediva-voice-doctor
npm install
npm run dev
```

---

## 5. Run order (four terminals)

1. **MongoDB / Redis** — running and reachable from env URIs.
2. **Backend**  
   ```bash
   cd backend
   npm install
   npm run start:dev
   ```  
   Check: `http://<LAN_IP>:3000/api` responds (health or any route).
3. **Voice web**  
   ```bash
   cd mediva-voice-doctor
   npm run dev
   ```  
   Check: phone browser opens `http://<LAN_IP>:5173`.
4. **Expo**  
   ```bash
   cd ..   # repo root
   npx expo start -c
   ```

---

## 6. Quick verification checklist

- [ ] Backend logs: Nest started, DB connected.
- [ ] Phone browser: `http://<LAN_IP>:3000/api` (not blank error).
- [ ] Phone browser: `http://<LAN_IP>:5173` loads Mediva Voice.
- [ ] Expo app: login / OTP works → API URL correct.
- [ ] Chat: send message → OpenRouter + RAG (check Pinecone vars if RAG fails).
- [ ] Chat → **Talk** → WebView loads → **Talk** in web → mic → Gemini (check `mediva-voice-doctor/.env.local`).

---

## 7. Common mistakes

| Symptom | Fix |
|---------|-----|
| App can’t login / network error | Root `.env` `EXPO_PUBLIC_API_URL` = `http://<LAN_IP>:3000/api`; firewall allow **3000**. |
| Chat works, voice WebView blank | `EXPO_PUBLIC_VOICE_WEB_URL`; Vite running; firewall **5173**. |
| RAG / search errors | `PINECONE_API_KEY` + `PINECONE_INDEX` or `PINECONE_INDEX_NAME`. |
| Token expires oddly | Set **`JWT_EXPIRES_IN`** in `backend/.env` (auth module reads this). |
| Android HTTP blocked | `app.json` already has `usesCleartextTraffic` for dev. |

---

## 8. Production

- Deploy backend → set `backend/.env` on the host (secrets via platform env, not git).
- Build Expo with EAS → set `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_VOICE_WEB_URL` to **https** production URLs.
- Deploy `mediva-voice-doctor` build to HTTPS; **do not** ship a long-lived Gemini key in the client bundle for public apps (use a backend proxy for production voice if possible).

---

*For voice WebView details only, see `docs/EXPO_VOICE_WEB.md`.*
