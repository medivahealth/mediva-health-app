# Mediva AI

## Local full stack (ports, start order, testing)

**→ Test Expo on your phone (same Wi‑Fi, no ngrok): [`docs/EXPO_FULL_TEST_LOCAL.md`](docs/EXPO_FULL_TEST_LOCAL.md)** · `npm run env:lan` · `npm run e2e:local`

**→ [`docs/LOCAL_FULL_STACK.md`](docs/LOCAL_FULL_STACK.md)** — backend **3000**, voice web **5173**, doctor+admin **5174**, Expo Metro **~8081**.

**→ [`docs/YOUR_PC_IP.md`](docs/YOUR_PC_IP.md)** — which `ipconfig` address to use (Wi‑Fi vs VirtualBox).

**→ [`docs/IOS_EAS_WINDOWS_FREE_APPLE_ID.md`](docs/IOS_EAS_WINDOWS_FREE_APPLE_ID.md)** — build on **EAS** from **Windows**, test on a **physical iPhone** (free vs paid Apple account).

**→ [`docs/DEPLOYMENT_READINESS.md`](docs/DEPLOYMENT_READINESS.md)** — TypeScript/build audit, Expo Go vs dev client, manual QA checklist.

## Env & API

- **Backend:** `backend/.env` — see [`docs/END_TO_END_SETUP.md`](docs/END_TO_END_SETUP.md)
- **Expo app:** repo root `.env` — `EXPO_PUBLIC_*`
- **Voice web:** `mediva-voice-doctor/.env.local` — `GEMINI_API_KEY`
- **Talk (WebView) on real phones:** HTTPS + [`docs/EXPO_VOICE_WEB.md`](docs/EXPO_VOICE_WEB.md). After `npm install`, **`patch-package`** applies `patches/react-native-webview+*.patch` so **Android and iOS debug** accept the Vite dev HTTPS certificate. Use a **dev client** (`expo run:ios` / `expo run:android`) or **ngrok** for Expo Go.
- **Option B — ngrok:** [`docs/NGROK_FULL_E2E.md`](docs/NGROK_FULL_E2E.md) · **`npm run ngrok:go`** (launch 4 windows → prompt URLs → update `.env` → quick tests → Expo) · **`npm run ngrok:env`** (update `.env` only) · [`.env.example`](.env.example). **Real** ngrok token from [dashboard](https://dashboard.ngrok.com/get-started/your-authtoken) — not the text `YOUR_NGROK_TOKEN`.
