import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** MSW browser worker started only when VITE_USE_MOCKS=true (see
 * main.tsx and `npm run dev:mock`). */
export const worker = setupWorker(...handlers);
