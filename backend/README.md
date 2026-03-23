# Mediva AI Backend (Railway)

## Run locally

```bash
npm install
npm run start:dev
```

Backend runs on `http://localhost:3000` with global prefix `/api`.

## Deploy on Railway

- Use the `backend/` folder as the service root.
- Railway will build using `backend/Dockerfile` (see `backend/railway.toml`).

### Required env vars (minimum)

- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `OPENROUTER_API_KEY` (or whichever LLM provider you’re using)
- `GEMINI_API_KEY` (for live voice)
- `GEMINI_VOICE_MODEL` (optional; defaults to `gemini-2.5-flash-native-audio-preview-12-2025`. Older `gemini-2.0-flash-exp` often disconnects immediately on current APIs.)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`, `S3_FOLDER_PREFIX` (uploads)
- `BACKEND_URL` (e.g. `https://api.mediva-health.com`)

### Domain suggestion

- `api.mediva-health.com` → Railway backend

