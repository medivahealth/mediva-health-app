# Your PC’s IP — which number to use?

From **`ipconfig`**, you will see **several** IPv4 addresses. For **Expo on your phone** and **Mediva on the same Wi‑Fi**, use **only** the address on your **Wi‑Fi** adapter.

## Your machine (example)

| Adapter | IPv4 | Use for Mediva? |
|---------|------|------------------|
| **Wi‑Fi** | **`192.168.1.x`** (e.g. `.3`, `.5`) | **Yes** — your PC on home/office Wi‑Fi (same network as your phone). DHCP can change the last number. |
| Ethernet 2 | `192.168.56.1` | **No** — almost always **VirtualBox / host-only**. Your phone is **not** on this network. |
| Loopback | `127.0.0.1` | Only on the **PC itself** (simulators sometimes); not for a **physical phone**. |

So your **LAN IP for Mediva** = whatever **Wi‑Fi → IPv4** shows today.

**Metro** shows `exp://192.168.1.3:8081` (example) — that **192.168.1.3** must be the **same** IP as in repo root **`.env`** (`EXPO_PUBLIC_API_URL`, `API_URL`, voice URL). If they differ (e.g. Metro `.3` but `.env` still `.5`), chat/API will break. Fix:

```powershell
cd C:\Users\LENOVO\Desktop\mediva_ai
npm run env:lan
```

(`env:lan` = `update-expo-lan-env.ps1 -UpdateBackendEnv` — refreshes root `.env` and `backend/.env` URLs.)

---

## Where your Wi‑Fi IP must appear (same last octet everywhere)

| File | Variables |
|------|-----------|
| **Repo root `.env`** | `EXPO_PUBLIC_API_URL=http://YOUR_WIFI_IP:3000/api`, `API_URL=http://YOUR_WIFI_IP:3000`, `EXPO_PUBLIC_VOICE_WEB_URL=https://YOUR_WIFI_IP:5173` (`npm run dev:https` in `mediva-voice-doctor`) |
| **`backend/.env`** | `BACKEND_URL=http://YOUR_WIFI_IP:3000`, `FRONTEND_URL=http://YOUR_WIFI_IP:8081` |

Replace **`YOUR_WIFI_IP`** with the **Wi‑Fi** IPv4 from `ipconfig` (must match Metro’s `exp://…:8081` host).

---

## Run the full application (4 terminals)

1. **`backend`** — `cd backend` → `npm run start:dev` → API **`http://192.168.1.5:3000`**
2. **`mediva-voice-doctor`** — `cd mediva-voice-doctor` → `GEMINI_API_KEY` in `.env.local` → **`npm run dev:https`** → **`https://192.168.1.5:5173`** (iPhone WebView mic)
3. **`doctor-dashboard`** — `cd doctor-dashboard` → `npm run dev` → **`http://192.168.1.5:5174`** (doctor + admin)
4. **Expo** — repo root → `npx expo start -c` → open app on phone (same Wi‑Fi)

**Firewall (Windows):** allow inbound **TCP 3000**, **5173**, **5174** for Node/Vite if the phone cannot connect.

---

## Quick checks from your **phone** (Safari/Chrome)

- `http://192.168.1.5:3000/api` — should not be “connection refused” (exact path may vary).
- `https://192.168.1.5:5173` — Mediva Voice page (with `dev:https`).
- `http://192.168.1.5:5174` — Doctor dashboard.

If these fail on the phone but work on the PC, it’s almost always **Wi‑Fi / firewall / wrong IP (e.g. 192.168.56.1)**.

---

Full port map + checklist: **`docs/LOCAL_FULL_STACK.md`**.
