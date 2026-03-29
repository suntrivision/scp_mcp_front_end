import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Vite defaults `root` and env loading to process.cwd(). If you run `vite` from a
// parent folder, `.env` next to this file would be ignored — breaking VITE_* vars.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_FREPPLE_MCP_URL = 'https://agenticshop-frepple-numm.onrender.com';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  // One backend base for both /api/frepple/* proxy and Anthropic remote MCP URL:
  // prefer explicit VITE_FREPPLE_MCP_URL, else FREPPLE_BACKEND_URL (same as server).
  const mcpUrl =
    (env.VITE_FREPPLE_MCP_URL || env.FREPPLE_BACKEND_URL || '').trim() ||
    DEFAULT_FREPPLE_MCP_URL;

  return {
    root: __dirname,
    envDir: __dirname,
    define: {
      'import.meta.env.VITE_FREPPLE_MCP_URL': JSON.stringify(mcpUrl),
    },
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
  };
});
