import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Port 5174 — do not use 5173 (reserved for mediva-voice-doctor).
 * Proxy /api → backend (default http://127.0.0.1:3000).
 * Override: create .env with VITE_API_PROXY_TARGET=http://192.168.x.x:3000
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiTarget = (env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000').replace(/\/$/, '');

  return {
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      host: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
