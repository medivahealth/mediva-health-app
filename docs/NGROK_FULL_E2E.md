# Option B — ngrok end-to-end (two scripts)

Everything uses **`C:\ngrok\ngrok.exe`** by default (override with `-NgrokExe` on `ngrok-start-all.ps1`).

---

## Fix ERR_NGROK_105 / “YOUR_NGROK_TOKEN”

If you ran `config add-authtoken YOUR_NGROK_TOKEN` literally, ngrok saved the **placeholder**, not a real token.

1. Open **[your authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)** and copy the **long** token string.
2. Run (replace with that string):

```powershell
C:\ngrok\ngrok.exe config add-authtoken PASTE_REAL_TOKEN_HERE
```

The scripts **`ngrok-update-env.ps1`** and **`ngrok-start-all.ps1`** detect `YOUR_NGROK_TOKEN` in `%LOCALAPPDATA%\ngrok\ngrok.yml` and exit with this message so you don’t waste time.

---

## The two scripts

| Script | npm | What it does |
|--------|-----|----------------|
| **`scripts/ngrok-update-env.ps1`** | `npm run ngrok:env` | Writes **repo root `.env`** (`EXPO_PUBLIC_*`, `API_URL`). With **`-UpdateBackendEnv`**, also sets **`BACKEND_URL`** in **`backend/.env`**. Pass **`-ApiUrl`** / **`-VoiceUrl`** or run with **no args** to paste interactively. |
| **`scripts/ngrok-start-all.ps1`** | `npm run ngrok:go` | Opens **4 windows** (Nest :3000, Vite :5173, ngrok→3000, ngrok→5173) → you press Enter → runs **`ngrok-update-env.ps1 -UpdateBackendEnv`** (prompts for URLs) → **HTTP reachability tests** → **`npx expo start -c`**. Add **`-SkipExpo`** to stop before Expo. |

---

## Keys you must have on disk

| File | Keys |
|------|------|
| **`backend/.env`** | From `backend/.env.example`: MongoDB, JWT, OpenRouter, MSG91 (if OTP), etc. |
| **`mediva-voice-doctor/.env.local`** | `GEMINI_API_KEY=` ([AI Studio](https://aistudio.google.com/apikey)) |

---

## Full flow (one command)

From **repo root** (after `npm install` in root, `backend`, `mediva-voice-doctor`):

```powershell
cd C:\Users\LENOVO\Desktop\mediva_ai
npm run ngrok:go
```

1. Wait until all **four** windows are healthy (Nest listening, Vite ready, both ngrok lines show **Forwarding https://…**).
2. In this window, press **Enter**.
3. Paste **API** `https://…` (tunnel to **3000**), then **Voice** `https://…` (tunnel to **5173**).
4. Scripts update `.env` + `BACKEND_URL`, run quick tests, then start **Expo**.

---

## Update `.env` only (tunnels already running)

```powershell
npm run ngrok:env
```

Or with URLs in one line:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\ngrok-update-env.ps1 `
  -ApiUrl "https://YOUR_API.ngrok-free.app" `
  -VoiceUrl "https://YOUR_VOICE.ngrok-free.app" `
  -UpdateBackendEnv
```

Then: `npx expo start -c`

---

## Phone checklist

1. Scan QR from Expo.
2. **Login** → API via ngrok.
3. **Chat** → message streams.
4. **Talk** → mic → Gemini.

---

## Reference

| Item | Path |
|------|------|
| Expo env template | `.env.example` |
| Optional single tunnel | `scripts/ngrok-tunnel.ps1` |
| All ports | `LOCAL_FULL_STACK.md` |

---

## Security

ngrok URLs are **public**. Use dev credentials only. Release builds keep strict SSL on Android (see `patches/react-native-webview+*.patch`).
