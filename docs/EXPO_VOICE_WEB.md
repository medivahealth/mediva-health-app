# Mediva Voice (web) inside the Expo app

The in-app **Talk** button opens **`mediva-voice-doctor`** in a **WebView** (Gemini Live in the browser). The native `VoiceAgentScreen` (Socket.IO + backend voice) is no longer used for that flow.

## 0. Android + iOS: one HTTPS setup (mic needs a secure context)

Browsers and **WebView** only expose the microphone in a **secure context** (`https:` or `localhost`). Plain **`http://192.168.x.x:5173`** on a **real phone** usually shows the UI but **blocks the mic**.

**Use the same flow on both platforms:**

1. **`mediva-voice-doctor`**: `npm run dev:https` (Vite + `@vitejs/plugin-basic-ssl` self-signed cert).
2. **Repo root `.env`**: `EXPO_PUBLIC_VOICE_WEB_URL=https://YOUR_LAN_IP:5173`
3. **`npm install`** at repo root (applies **`patch-package`**) so **Android and iOS debug** WebViews **accept the self-signed LAN cert** (Vite `dev:https`). **Release** builds still use strict SSL.
4. **Run a dev client**, not Expo Go: `npx expo run:ios` / `npx expo run:android` (or EAS dev build). **Expo Go** ships its own native WebView and **does not** include this patch—use **ngrok HTTPS** (below) if you must stay on Expo Go.
5. Restart Metro: `npx expo start -c`.

**If the page or mic still fails:** open `https://YOUR_LAN_IP:5173` once in **Safari** (iOS) and accept the cert, or use a **trusted** tunnel:

```bash
ngrok http 5173
```

Set `EXPO_PUBLIC_VOICE_WEB_URL` to the **https** URL ngrok prints (works with **Expo Go** too).

**Step-by-step (Windows, `C:\ngrok\ngrok.exe`, API + voice):** [`NGROK_FULL_E2E.md`](./NGROK_FULL_E2E.md).

## 1. Configure the URL

In the **project root** `.env`, **`EXPO_PUBLIC_VOICE_WEB_URL`** is your PC’s **Wi‑Fi IPv4** on port **5173**.

**Recommended for real iPhone + Android:** `https://192.168.1.5:5173` + `npm run dev:https` + dev client + `patch-package` (see §0).

**Auto-update LAN IP on Windows** (rewrites `.env` API + voice URLs — voice line uses **https** by default):

```powershell
cd mediva_ai
powershell -ExecutionPolicy Bypass -File scripts/update-expo-lan-env.ps1
npx expo start -c
```

Or set manually:

```env
EXPO_PUBLIC_VOICE_WEB_URL=https://YOUR_COMPUTER_LAN_IP:5173
```

Examples:

- **Physical iPhone + Android + Wi‑Fi:** `https://192.168.1.5:5173` + `npm run dev:https` + dev client.
- **Android emulator:** `https://10.0.2.2:5173` with `dev:https` on the host, or `http://10.0.2.2:5173` if your WebView still allows mic on loopback alias (prefer HTTPS for parity).
- **iOS Simulator:** `https://127.0.0.1:5173` with `dev:https`, or `http://127.0.0.1:5173` when testing on simulator only.

**Restart Expo** after changing `.env` (`npx expo start -c` is safest).

Optional: you can also set `expo.extra.voiceWebUrl` in `app.json` instead of env.

## 2. Run the voice web app

From repo root:

```bash
cd mediva-voice-doctor
npm install
# Create .env.local with GEMINI_API_KEY=... (see mediva-voice-doctor/README.md)
npm run dev:https   # iPhone WebView / mic — use this
# or
npm run dev         # HTTP — Android / browser when HTTP is enough
```

Default dev server listens on **`0.0.0.0:5173`**. Port **5173** avoids clashing with the Nest API on **3000**.

Firewall: allow **inbound TCP 5173** on your PC if you test from a real device.

## 3. Run the Expo app

```bash
cd ..   # repo root
npx expo start
```

Then open your **dev client** (recommended for LAN HTTPS voice) or **Expo Go** (use **ngrok** HTTPS for voice URL). Scan the QR code.

## 4. Test Talk

1. Log in and open **Chat**.
2. Tap **Talk** → full-screen WebView with Mediva Voice.
3. If **`EXPO_PUBLIC_VOICE_WEB_URL`** is **http://**, a yellow banner explains switching to HTTPS.
4. Tap **Talk** in the web UI → allow **microphone** when prompted.
5. You should hear Gemini Live after the session connects.

## 5. Troubleshooting

| Issue | What to try |
|--------|-------------|
| Opens but **not listening** (phone) | **`dev:https`** + **`https://…`** in `.env`; **dev client** or **ngrok** (see §0). |
| **Android / iPhone** “invalid certificate” on `https://LAN` | Run **`npm install`** (applies **`patches/react-native-webview+*.patch`**); rebuild **debug** dev client (`expo run:ios` / `run:android`). **Expo Go** cannot use this patch—use **ngrok** HTTPS for voice. |
| **Expo Go** + self-signed LAN HTTPS | Use **ngrok** (or Cloudflare Tunnel) **https** URL for voice, or install **dev client**. |
| Blank / error overlay | Confirm the URL opens in the phone’s **Safari/Chrome** (same Wi‑Fi). |
| Works in browser, not in app | Match **http vs https** between Vite mode and `.env`. |
| Mic denied | iOS: `NSMicrophoneUsageDescription` in `app.json`. Reinstall dev build after native changes. Android: `RECORD_AUDIO`. |
| Still see old native voice | `App.tsx` maps `voice-agent` → `VoiceWebScreen`; restart Metro with cache clear. |

## 6. Production

- Deploy **`mediva-voice-doctor`** (e.g. Vite build → static host or CDN).
- Set `EXPO_PUBLIC_VOICE_WEB_URL` to the **https** production URL.
- Remove or set `usesCleartextTraffic` appropriately for release builds.
