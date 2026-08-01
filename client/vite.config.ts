import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // Base configurável para hospedagem em subdiretório (ex.: GitHub Pages).
  // Local/dev continua em '/'.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@evoluze/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      // VITE_SINGLE_FILE=1 junta tudo num bundle só (preview single-file,
      // onde chunks carregados sob demanda não teriam de onde ser buscados).
      output: process.env.VITE_SINGLE_FILE ? { inlineDynamicImports: true } : {},
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
