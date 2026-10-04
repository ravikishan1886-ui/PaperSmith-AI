import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const imgbbKey = env.IMGBB_API_KEY || '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Note: GROQ_API_KEY is deliberately omitted from client bundle to protect credentials.
      // All AI generation and OCR requests are handled server-side via Express proxy routes.
      'process.env.IMGBB_API_KEY': JSON.stringify(imgbbKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
