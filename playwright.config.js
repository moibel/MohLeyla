import { defineConfig } from '@playwright/test';

const ENV = 'VITE_SUPABASE_URL=https://mohleyla-test.supabase.co VITE_SUPABASE_ANON_KEY=test-anon-key';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'off', serviceWorkers: 'allow' },
  webServer: [
    {
      // normal build: accounts optional
      command: `${ENV} npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort`,
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      // same app with VITE_REQUIRE_SIGN_IN=true: every learner must sign in first (tests/e2e/gate.spec.js)
      command: `${ENV} VITE_REQUIRE_SIGN_IN=true npx vite build --outDir dist-gate && npx vite preview --outDir dist-gate --host 127.0.0.1 --port 4174 --strictPort`,
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
