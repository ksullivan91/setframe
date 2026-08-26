import { defineConfig, devices } from '@playwright/test';

/**
 * Story 67 — mobile-web modal regression coverage.
 *
 * WebKit specifically, and at a phone viewport. The defect this pack exists
 * to fix is one a Chromium desktop run would not reproduce: mobile Safari's
 * browser chrome changes the usable height, `100vh` means something different
 * there, and the resulting surface was visually split. Treating WebKit as a
 * first-class runtime is the point, not an extra.
 */
export default defineConfig({
  testDir: './e2e',
  // Only the specs; the harness .tsx next to them is not a test.
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  /* Two runtimes, because the contract genuinely splits. Viewport, scrolling
     and overflow are phone concerns and are asserted on a real iPhone WebKit
     profile. Keyboard focus trapping is a desktop concern — a phone has no
     Tab key, and mobile Safari deliberately does not tab through every
     control — so asserting it on a phone profile would be testing the
     browser's input model, not the dialog. */
  projects: [
    {
      name: 'mobile-webkit',
      testMatch: '**/modal-mobile.spec.ts',
      use: { ...devices['iPhone 13'] },
    },
    {
      /* Chromium, deliberately. macOS Safari ships with "Press Tab to
         highlight each item" off, so Tab moves focus to <body> rather than
         cycling buttons — verified, not assumed. Asserting a focus trap in a
         browser configured not to Tab would be testing the browser's input
         model rather than the dialog. The mobile-web contract that this pack
         exists for is still WebKit above; this project covers the keyboard
         behaviour a keyboard user actually gets. */
      name: 'desktop-keyboard',
      testMatch: '**/modal-keyboard.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173/e2e/harness.html',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
