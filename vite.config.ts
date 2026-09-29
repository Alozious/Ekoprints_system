import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createMarketingApi } from './server/marketing.mjs';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        fs: { deny: ['**/.marketing.local/**', '**/.env*', '**/*.{crt,pem}', '**/.git/**'] },
      },
      plugins: [react(), {
        name: 'marketing-api',
        configureServer(server) { server.middlewares.use(createMarketingApi()); },
        configurePreviewServer(server) { server.middlewares.use(createMarketingApi()); }
      }],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
