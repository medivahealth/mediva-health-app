# Deployment readiness (automated audit)

**Last audit:** static/type checks across the monorepo. Runtime E2E (real devices, production env) must still be run by you before go-live.

## Automated checks (passing)

| Package | Command | Notes |
|---------|---------|--------|
| **Expo app** (repo root) | `npx tsc --noEmit` | `mediva-voice-doctor` is **excluded** from root `tsconfig.json` (separate project). |
| **Backend** (`backend/`) | `npx tsc --noEmit` | NestJS |
| **Doctor + admin UI** (`doctor-dashboard/`) | `npm run build` | Vite + `tsc -b` |
| **Mediva Voice web** (`mediva-voice-doctor/`) | `npm run lint` + `npm run build` | Vite 6; chunk size warning only |

### Fixes applied for clean typecheck

- Root **`tsconfig.json`**: exclude **`mediva-voice-doctor`** (avoids pulling Vite/React DOM into Expo’s checker).
- **`src/svg.d.ts`**: SVG components typed as `ComponentType<SvgProps>` (fixes width/height on transformed SVGs).
- **`src/services/voice-conversation-service.ts`**: timer fields use `ReturnType<typeof setInterval | setTimeout>` (RN/Expo vs Node typings).
- **`mediva-voice-doctor`**: safe `atob` on audio data, `main.tsx` import path, `vite.config` `https` typing, **`@types/react` / `@types/react-dom`**.

## Feature matrix (where it runs)

| Feature | Expo Go | Dev / store build |
|---------|---------|-------------------|
| Auth, chat, stream, records upload, ABHA screens, menu | ✅ (with hosted API + HTTPS voice URL) | ✅ |
| **Talk** (WebView → `mediva-voice-doctor`) | ✅ if `EXPO_PUBLIC_VOICE_WEB_URL` is **public HTTPS** | ✅ |
| **Apple Health / HealthKit** sync (`Devices`) | ❌ not in Expo Go binary | ✅ |
| **WebView SSL patch** (self-signed LAN HTTPS) | ❌ not in Expo Go | ✅ debug dev client |

## Backend TODOs (non-blocking)

These are **enhancements**, not compile errors:

- `patient-context.service.ts` — prescription-related TODO  
- `doctor.service.ts` — push notification TODO  
- `prescription.*` — role check / websocket / push TODOs  

## Manual pre-production checklist

1. **Env:** production `MONGODB_URI`, `JWT_*`, `OPENROUTER_API_KEY`, `S3_*`, `FRONTEND_URL` / `BACKEND_URL`, `GEMINI_*` if used.  
2. **CORS** on API for your web + Expo origins.  
3. **Expo:** `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_VOICE_WEB_URL` (HTTPS).  
4. **Voice static host:** deploy `mediva-voice-doctor/dist` with **HTTPS** and valid `GEMINI_API_KEY` at build/runtime per your setup.  
5. **Doctor dashboard:** point Vite env at production API; verify admin/doctor login flows.  
6. **Smoke test:** OTP login → chat → attachment → history → records → ABHA flow → Talk → Devices (on real build for HealthKit).

## Honest statement

**“No errors anywhere”** is true for **TypeScript compile + production builds** above. It does **not** guarantee zero runtime bugs, misconfiguration, or third-party outages — always run a full manual QA on staging URLs before launch.
