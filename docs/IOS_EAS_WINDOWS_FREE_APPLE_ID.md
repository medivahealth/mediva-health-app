# Install Mediva on a **real iPhone** from **Windows** (EAS) — **free Apple ID** vs **paid**

You **cannot run Xcode on Windows**. Use **Expo Application Services (EAS)** to build the iOS app in the cloud, then install the `.ipa` on your phone.

## Free Apple ID (no $99/year) — what you *can* do

- ✅ Build a **development** or **preview** IPA with **EAS** and install it on **your own iPhone** (device must be **registered**).
- ✅ Use **HealthKit**, mic, WebView voice — same as any dev build, as long as the app is signed with a valid **development** profile for your device.
- ⚠️ Provisioning for a **free (personal) Apple team** often means the app **expires after ~7 days**; you reinstall or rebuild.
- ❌ **TestFlight** and **App Store** distribution require the **paid Apple Developer Program** ($99/year).

> Apple’s rules change; if EAS reports your free team can’t enable a capability, you’ll need the paid program.

## Paid Apple Developer ($99/year) — what you get

- TestFlight for testers, App Store release, longer-lived distribution, fewer signing headaches.

---

## What to run on your **laptop** (Windows)

1. **Backend API** (so login, chat, `/chat/voice-brief`, health sync work):
   ```bash
   cd backend
   npm install
   npm run start:dev
   ```
   Use your LAN IP or Railway URL in the app env (below).

2. **Voice web** (for Talk / WebView on a real phone you need **HTTPS**):
   ```bash
   cd mediva-voice-doctor
   npm install
   npm run dev:https
   ```
   Or deploy voice to **ngrok** / a hosted HTTPS URL.

3. **Expo / Metro** (after the dev client is installed on the phone):
   ```bash
   cd mediva_ai   # repo root
   npx expo start --dev-client
   ```
   Scan the QR code **with the dev client app** (not Expo Go), same Wi‑Fi as the PC.

4. **Repo root `.env`** (examples):
   ```env
   EXPO_PUBLIC_API_URL=http://YOUR_WIFI_IP:3000/api
   EXPO_PUBLIC_VOICE_WEB_URL=https://YOUR_WIFI_IP:5173
   ```
   Restart Metro after changes (`npx expo start -c`).

---

## What to do on your **iPhone**

1. Install the **development build** EAS gives you (link or QR from the build page).
2. **Settings → General → VPN & Device Management** → trust the developer if iOS asks.
3. **Settings → Health → Data Access & Devices → Mediva** → turn on categories you want.
4. Open **Mediva** → **Menu → Devices** → allow **Apple Health** → **Sync**.
5. Open **Chat → Talk** for voice (voice page must load over **HTTPS**).

---

## EAS setup (first time)

1. Install CLI: `npm i -g eas-cli`
2. Log in: `eas login` (Expo account — free tier is enough to try builds).
3. Link project (once): `eas build:configure`
4. **Register your iPhone** so the IPA can install:
   ```bash
   eas device:create
   ```
   Follow the link on the phone to install the Apple profile / capture UDID.
5. **iOS build** (dev client — matches `eas.json` `development` profile):
   ```bash
   eas build --profile development --platform ios
   ```
6. When the build finishes, open the **Expo dashboard** link → **Install** on the device (or download IPA).

Apple signing: EAS will prompt you to log in with your **Apple ID** the first time and create certificates/profiles.

---

## Voice agent testing checklist

| Where | What |
|--------|------|
| **PC** | Backend running, `mediva-voice-doctor` on `dev:https`, firewall allows **3000** and **5173**. |
| **Phone** | Dev client installed, same Wi‑Fi, `.env` URLs point to PC IP or ngrok. |
| **App** | Log in → Chat → Talk → allow mic. |

If the voice page shows an **SSL certificate** error on iOS, use a **dev client** built after `npm install` (WebView SSL patch) or an **ngrok HTTPS** URL for `EXPO_PUBLIC_VOICE_WEB_URL`.

---

## See also

- [`EXPO_VOICE_WEB.md`](./EXPO_VOICE_WEB.md) — LAN HTTPS, ngrok, WebView.
- [`DEPLOY_MEDIVA_HEALTH.md`](./DEPLOY_MEDIVA_HEALTH.md) — Railway + production domains.
