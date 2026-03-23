import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load .env / .env.local from this package root (works when cwd is repo root too)
  const env = loadEnv(mode, __dirname, '');
  /** iOS WKWebView needs https (or localhost) for getUserMedia — use `npm run dev:https` */
  const useHttps =
    process.env.VITE_DEV_HTTPS === '1' ||
    process.env.VOICE_DEV_HTTPS === '1' ||
    env.VITE_DEV_HTTPS === '1';

  return {
    plugins: [react(), tailwindcss(), ...(useHttps ? [basicSsl()] : [])],
    // Expose GEMINI_API_KEY and VITE_* to client via import.meta.env (not process.env)
    envPrefix: ['VITE_', 'GEMINI_'],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      // boolean is valid at runtime with @vitejs/plugin-basic-ssl; types expect ServerOptions
      ...(useHttps ? { https: true as any } : {}),
      // Allow tunnel hostnames (e.g. *.ngrok-free.app) when using ngrok http 5173
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
