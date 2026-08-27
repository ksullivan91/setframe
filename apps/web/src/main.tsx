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
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
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
