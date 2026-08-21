import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../server-laravel/public/app', import.meta.url)),
    emptyOutDir: true,
  },
})
