import { defineConfig, devices } from '@playwright/test';

const sharedEnv = 'VITE_SUPABASE_URL=http://127.0.0.1:43210 VITE_SUPABASE_ANON_KEY=test-key VITE_PASSKEYS_ENABLED=true';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `${sharedEnv} VITE_PREVIEW_TEST_MODE=false VITE_CACHE_DIR=node_modules/.vite-e2e-default npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`,
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `${sharedEnv} VITE_PREVIEW_TEST_MODE=true VITE_CACHE_DIR=node_modules/.vite-e2e-preview npm run dev -- --host 127.0.0.1 --port 5175 --strictPort`,
      url: 'http://127.0.0.1:5175',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5174' },
      testIgnore: /preview-test-mode\.spec\.js$/,
    },
    {
      name: 'preview-test-mode',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5175' },
      testMatch: /preview-test-mode\.spec\.js$/,
    },
  ],
});
