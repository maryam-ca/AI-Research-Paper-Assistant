import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Optional: proxy /api to a locally running uvicorn during dev.
      // When VITE_API_URL is set, the client uses it directly instead.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
});
