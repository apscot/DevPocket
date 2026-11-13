import { defineConfig } from '@playwright/test'

// The app is built and served under a repository-style subpath (/DevPocket/) to mirror GitHub Pages.
export default defineConfig({
  testDir: 'e2e',
  timeout: 45000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173/DevPocket/', headless: true, viewport: { width: 1280, height: 800 } },
  webServer: {
    command: 'VITE_BASE=/DevPocket/ npm run build && VITE_BASE=/DevPocket/ npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/DevPocket/',
    reuseExistingServer: false,
    timeout: 240000,
  },
})
