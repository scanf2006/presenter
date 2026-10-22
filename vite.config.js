import { realpathSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Pin the root to the on-disk spelling of this folder. Windows paths are
// case-insensitive, but Vite's inline <style> cache in index.html is not:
// when Tauri launches the build as D:\AI\... while the folder is D:\ai\...,
// the build fails with "No matching HTML proxy module found".
const root = realpathSync.native(dirname(fileURLToPath(import.meta.url)));

// https://vitejs.dev/config/
export default defineConfig({
  root,
  plugins: [react()],
  base: './',
  server: {
    port: 5199,
    strictPort: true,
  },
});
