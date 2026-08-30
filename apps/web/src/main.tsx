import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/clerk-react';
import { App } from './App';
import { GlobalStyle } from './theme/GlobalStyle';
import { getTheme } from './theme/getTheme';
import { ToastProvider } from './components/Toast';
import { env } from './lib/env';

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

/**
 * `npm run dev:mock` sets VITE_USE_MOCKS=true so design/feature iteration
 * can happen against MSW-mocked responses (src/mocks/handlers.ts) without
 * a running apps/api backend or live DB. `npm run dev` (the default)
 * leaves this off and talks to the real API.
 */
async function prepare() {
  if (env.useMocks) {
    /* Read `?ux-persona=` now, while it is still on the URL. The app navigates
       client-side immediately after sign-in, so a param read lazily by the
       first API handler arrives too late (see mocks/persona-state.ts). */
    const { capturePersonaFromUrl } = await import('./mocks/persona-state');
    capturePersonaFromUrl();
    /* Story 42.7 — lets a regression scenario pin a session shape or make a
       save slow/fail. Behind `useMocks`, so it never exists in production. */
    const { exposeMockControl } = await import('./mocks/mock-control');
    exposeMockControl();
    const { worker } = await import('./mocks/browser');
    await worker.start({
      /*
       * Our own API must be fully mocked; everything else passes through.
       *
       * A blanket 'bypass' silently let an unhandled `/v1/` call fall through
       * to the network, so an endpoint with NO handler looked identical to a
       * working one in every test. That is how "add an exercise to a workout"
       * shipped 400ing in production with a green suite: there was no handler
       * for it at all, and nothing said so.
       */
      onUnhandledRequest: (request, print) => {
        /* Scoped to OUR api origin, not any `/v1/` path — Clerk's API also
           lives under `/v1/`, and matching on the path alone broke sign-in
           for every test. */
        const url = new URL(request.url);
        const api = new URL(env.apiBaseUrl, window.location.origin);
        if (url.origin === api.origin && url.pathname.startsWith(api.pathname)) {
          print.error();
        }
      },
    });
  }
}

prepare().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <ClerkProvider publishableKey={env.clerkPublishableKey}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={getTheme('light')}>
            <GlobalStyle />
            <ToastProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </StrictMode>,
  );
});
