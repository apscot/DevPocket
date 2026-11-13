import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// Relative base ("./") + HashRouter makes the build work from any GitHub Pages
// repository subpath (e.g. /DevPocket/) and keeps deep links directly accessible.
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'], globals: true },
})
