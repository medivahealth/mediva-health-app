# Full Expo test **without ngrok** (same Wi‑Fi)

Phone and PC on the **same Wi‑Fi**. No tunnels — use your PC **LAN IP** (e.g. `192.168.1.5`).

---

## 1. One-time

- **Node** installed; **MongoDB** (Atlas OK) in `backend/.env`.
- **`backend/.env`** — copy from `backend/.env.example` and fill secrets.
- **`mediva-voice-doctor/.env.local`** — `GEMINI_API_KEY=` ([AI Studio](https://aistudio.google.com/apikey)).
- Repo root: **`npm install`** · **`backend`**: **`npm install`** · **`mediva-voice-doctor`**: **`npm install`**.

---

## 2. Set Expo + backend URLs from your LAN IP (Windows)

From **repo root**:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\update-expo-lan-env.ps1 -UpdateBackendEnv
```

This writes **repo root `.env`** (`http://YOUR_IP:3000/api`, **`https://YOUR_IP:5173`** for voice) and sets **`BACKEND_URL`** / **`FRONTEND_URL`** in **`backend/.env`**.

Manual alternative: edit root `.env` yourself — see **`.env.example`** (LAN block).

---

## 3. Run three things (three terminals)

| # | Folder | Command | Port |
|---|--------|---------|------|
| **1** | `backend/` | `npm run start:dev` | **3000** |
| **2** | `mediva-voice-doctor/` | **`npm run dev:https`** | **5173** |
| **3** | repo root | **`npx expo start -c`** | **~8081** |

**Why `dev:https` for voice?** Real **iPhone** WebView only allows the mic on **HTTPS** (or localhost). `dev:https` uses a local self-signed cert; **`npm install`** at repo root applies the Android **debug** WebView patch so **Android** can load that HTTPS page.

---

## 4. On the phone

- Use a **development build**: **`npx expo run:ios`** or **`npx expo run:android`** once, then open that app and connect to Metro.  
  **Expo Go** often **cannot** use the LAN SSL patch → if Talk fails on Android in Expo Go, use a **dev build** or temporarily use **ngrok** for the voice URL only (`docs/NGROK_FULL_E2E.md`).

---

## 5. What to test in the app

1. **Login** (OTP / your flow) → API on `http://LAN:3000`.
2. **Chat** → send a message → streaming reply.
3. **Talk** → WebView opens `https://LAN:5173` → allow **microphone** → speak → Gemini responds.

**PC sanity check:** browser open `https://YOUR_IP:5173` (accept cert warning) and `http://YOUR_IP:3000/api`.

---

## 6. Firewall (Windows)

Allow inbound **TCP 3000**, **5173**, **8081** if the phone cannot connect.

---

## 7. Optional: one script opens backend + voice + updates env

```powershell
cd C:\Users\LENOVO\Desktop\mediva_ai
npm run e2e:local
```

Then in the same folder, after the two service windows are up: **`npx expo start -c`** (the script prints this if `-SkipExpo`).

---

## 8. When you **do** want ngrok (different network / Expo Go)

Short path: **`npm run ngrok:go`** or **`docs/NGROK_FULL_E2E.md`**. Use a **real** dashboard token, not placeholder text.
