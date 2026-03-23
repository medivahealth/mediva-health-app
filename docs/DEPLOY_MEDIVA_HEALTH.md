# Deploy Mediva for **www.mediva-health.com** (Railway + Expo + Apple Health)

This is the **end-to-end checklist** after the codebase changes (AI chat titles, voice brief, unified monitoring in chat stream, legacy voice UI removed).

## 1. Architecture (recommended)

| Piece | Where | Notes |
|--------|--------|--------|
| **API** (NestJS) | **Railway** | Node service, MongoDB Atlas connection string |
| **Web voice** (`mediva-voice-doctor`) | **Vercel / Netlify / Railway static** or same domain subpath | HTTPS required for mic |
| **Marketing site** | **www.mediva-health.com** | DNS to your host |
| **iOS app** | **EAS Build** or local `expo run:ios` | Apple Health via **dev client** / App Store build |

You do **not** need **Google Cloud Vision** for the current app: document images are handled by your backend **OCR + multimodal models via OpenRouter** (`records` + `ocr.service`). Add GCP Vision only if you want a dedicated OCR pipeline.

## 2. Railway (backend)

1. Create a **Railway** project → **Deploy from GitHub** (this repo, `backend/` as root or monorepo command).
2. Set **Start command** e.g. `npm run start:prod` (match your `backend/package.json`).
3. **Variables** (minimum):  
   - `MONGODB_URI`  
   - `JWT_SECRET` / refresh secret (if used)  
   - `OPENROUTER_API_KEY`  
   - `FRONTEND_URL` = `https://www.mediva-health.com`  
   - `BACKEND_URL` = your public API URL, e.g. `https://api.mediva-health.com`  
   - Any **S3**, **Pinecone**, **Groq**, **Gemini** keys you use in production  
4. Custom domain: attach **`api.mediva-health.com`** (or similar) → Railway provides TLS.
5. CORS: ensure Nest allows `https://www.mediva-health.com` and your Expo origins if needed.

## 3. Expo app (production)

1. In **EAS** (or build env), set:  
   - `EXPO_PUBLIC_API_URL=https://api.mediva-health.com/api`  
   - `EXPO_PUBLIC_VOICE_WEB_URL=https://voice.mediva-health.com` (or your deployed Vite URL)  
2. Build: `eas build --platform ios` (and Android if needed).  
3. **Apple Health**: requires **native** build with HealthKit entitlements (already in `app.json`). Use **`expo run:ios`** or EAS with credentials; **Expo Go** does not ship your HealthKit config.

## 4. Apple Health (fully working)

1. Open **`ios/Mediva.xcworkspace`** (after `npx expo prebuild` if needed).  
2. **Signing & Capabilities** → enable **HealthKit** (read/write as your app needs).  
3. Confirm `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` in `app.json` match App Store review.  
4. On device: **Settings → Health → Data Access** → enable Mediva.  
5. Test **Devices** / sync flow against **production API** so data lands in Mongo and appears in chat context.

## 5. Domain DNS (www.mediva-health.com)

- **A/AAAA** or **CNAME** for `www` → marketing host.  
- **CNAME** `api` → Railway edge hostname.  
- Optional **`voice`** subdomain → static host for `mediva-voice-doctor` build (`npm run build` → upload `dist/`).

## 6. Security & compliance

- Rotate any keys that were ever pasted in chat or committed.  
- Use **HTTPS everywhere** in production env vars.  
- Voice WebView: production must use a **trusted** certificate (not self-signed).

## 7. What we removed (production cleanup)

- **Legacy native voice UIs** (`VoiceBotScreen`, old `VoiceAgentScreen*`, `VoiceTestScreen`) — **deleted**.  
- **Talk** uses **`VoiceWebScreen`** + **`mediva-voice-doctor`** only.  
- **Rook** integration — **fully removed** (backend module + `/rook/*` + app `rook` service). Dashboard **“connected sources”** come from **`/health/summary`** (`sources` array: HealthKit, Health Connect, manual, etc.).

## 8. Next actions (your order)

1. Deploy **backend** to Railway + set env vars.  
2. Deploy **mediva-voice-doctor** to HTTPS URL; set `EXPO_PUBLIC_VOICE_WEB_URL`.  
3. Run **EAS iOS build** or **`npx expo run:ios`** with production API.  
4. Verify **Chat** (AI titles in history), **Records** (AI titles when description empty), **Talk** (voice loads with brief).  
5. Submit **TestFlight** → then App Store when ready.
