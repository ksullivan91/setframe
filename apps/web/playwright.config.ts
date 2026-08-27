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
  /* UX reviews walk whole flows against a real signed-in session, so they are
     slower than a component assertion and must not be cut off mid-journey. */
  timeout: 120_000,
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
    /* The autonomous UX reviewer. Two viewports, because the product's own
       Definition of Done names both: 390px is where it is actually used, and
       1440px is where it is usually built. A finding that only exists on one
       of them is still a finding, so they are separate projects rather than
       one run that quietly favours whichever ran last. */
    /* Chromium at phone size — mobile-web on Android, and the engine most
       development is done in. `browserName` is set explicitly because
       `devices['iPhone 13']` carries `defaultBrowserType: 'webkit'`: without
       this line the "mobile" and "webkit" projects were the same engine at the
       same width, silently overwriting each other's reports and adding no
       coverage at all. */
    {
      name: 'ux-mobile',
      testMatch: '**/ux/*.ux.spec.ts',
      use: { ...devices['iPhone 13'], browserName: 'chromium', baseURL: 'http://localhost:5199' },
    },
    /* Functional coverage: does the workflow still work? Asserts and fails,
       unlike the UX projects, which walk a flow and report. Chromium at phone
       size because that is the shape the product is used in. */
    {
      name: 'functional',
      testMatch: '**/functional/*.spec.ts',
      use: { ...devices['iPhone 13'], browserName: 'chromium', baseURL: 'http://localhost:5199' },
    },
    /* Phase 2's WebKit slice. Mobile Safari is where this repo's layout and
       input defects have actually shipped — `100vh` meaning something else,
       inputs zooming on focus, sticky chrome eating the bottom of the page —
       and none of it reproduces on Chromium. The same journeys run here so a
       WebKit-only regression cannot hide behind a green Chromium run. */
    {
      name: 'ux-webkit',
      testMatch: '**/ux/*.ux.spec.ts',
      use: { ...devices['iPhone 13'], baseURL: 'http://localhost:5199' },
    },
    {
      name: 'ux-desktop',
      testMatch: '**/ux/*.ux.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: 'http://localhost:5199' },
    },
  ],
  /* Two servers. The modal harness needs the plain dev server; the UX review
     needs `dev:mock`, because a review has to be reproducible — a journey
     whose findings change with whatever happens to be in the database is a
     report nobody can act on. MSW gives every run the same starting state. */
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173/e2e/harness.html',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev:mock -- --port 5199 --strictPort',
      url: 'http://localhost:5199/sign-in',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
