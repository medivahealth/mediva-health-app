# Mediva Voice Doctor (AI Studio export)

Web demo: **Talk** opens a **Gemini Live** voice session in the browser (mic → Gemini → speaker).

View / remix in **Google AI Studio**: https://ai.studio/apps/cc3262ae-df05-4d1e-9c2f-3fcddb8e3ecd

---

## Run locally

**Prerequisites:** Node.js 18+

1. **Go into this folder**

   ```bash
   cd mediva-voice-doctor
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Add your Gemini API key**

   Create **`.env.local`** in **`mediva-voice-doctor/`** (next to `package.json`):

   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

   Or use **`VITE_GEMINI_API_KEY`** (same value) — both work.

   - Get a key: [Google AI Studio](https://aistudio.google.com/apikey).
   - **Restart `npm run dev`** after creating or changing `.env.local`.

   Vite exposes vars prefixed with `GEMINI_` or `VITE_` to the app via **`import.meta.env`** (not `process.env`).

4. **Start the dev server**

   ```bash
   npm run dev
   ```

   **Embedding in the Expo app on a physical iPhone:** use HTTPS so WKWebView can use the microphone:

   ```bash
   npm run dev:https
   ```

   Then set **`EXPO_PUBLIC_VOICE_WEB_URL=https://<YOUR_LAN_IP>:5173`** in the repo root `.env`. See **`docs/EXPO_VOICE_WEB.md`** in the monorepo.

   Default URL: **http://localhost:5173** with `dev`, or **https://localhost:5173** with `dev:https` (`--port=5173 --host=0.0.0.0` so it does not clash with the Mediva API on port 3000).

   To use another port:

   ```bash
   npx vite --port 3000 --host 0.0.0.0
   ```

5. **Test in the browser**

   - Open the URL, click **Talk**.
   - Allow **microphone** when the browser asks.
   - You should see connecting → then speak; the model should answer with audio (and subtitles if enabled).

---

## Security note (important)

This app is a **frontend-only** Vite bundle: the API key ends up **in the browser** after build. That is **OK for your own machine / quick demos**, but **not** for a public production app. For production, proxy Gemini Live through your **backend** (like the main Mediva `backend` voice gateway) and **never** ship a full API key to clients.

---

## Talk bubble graphic & favicon

Both the **in-app orb** and the **tab favicon** use the same SVG asset:

- **`public/favicon.svg`** — copy of the Talk bubble artwork (served at `/favicon.svg`).
- To update the graphic, copy your new artwork over this file:

```bash
# macOS/Linux
cp "src/components/Talk bubble.svg" public/favicon.svg

# Windows PowerShell
Copy-Item -Force "src\components\Talk bubble.svg" "public\favicon.svg"
```

## Build / preview

```bash
npm run build    # output in dist/
npm run preview  # serve production build locally
```

## Lint (TypeScript)

```bash
npm run lint
```
