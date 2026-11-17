import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoName = process.env.GITHUB_PAGES_REPO || 'npv-calculator'
const isGithubPages = process.env.GITHUB_PAGES === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: isGithubPages ? `/${repoName}/` : '/',
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
})
