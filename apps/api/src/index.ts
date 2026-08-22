import { buildApp } from './app.js';
import { seedSystemExercises } from '@setframe/database';
import { getDb } from './lib/db.js';

async function main() {
  const app = buildApp();

  // Port resolution intentionally does not require the full env schema
  // (DATABASE_URL/Clerk keys) to be valid — only DB/Clerk-backed routes
  // trigger that validation lazily (see src/lib/env.ts). This lets
  // /v1/health respond even with placeholder .env values.
  const port = Number(process.env.PORT ?? 3000);

  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Idempotently ensure the system exercise catalog exists (Story 02) —
  // previously this required a developer to remember to run
  // packages/database/src/seed-exercises.ts by hand, so a fresh/rotated
  // database (e.g. after recreating the Neon project) silently shipped
  // with zero system exercises and no error anywhere in the stack.
  // onConflictDoNothing makes repeat calls a no-op. Deliberately fired
  // *after* listen() and not awaited here so a slow/unreachable DB can
  // never delay opening the port or fail a /v1/health check — this
  // mirrors the lazy-DB-validation design already used elsewhere in
  // this file (see the comment above about /v1/health).
  //
  // getDb() calls getEnv(), which can throw *synchronously* (ZodError)
  // if env vars are invalid/placeholder — wrapping in
  // Promise.resolve().then() routes that through the same .catch()
  // path as the async seed call, instead of becoming an unhandled
  // promise rejection that would crash the process right after boot.
  Promise.resolve()
    .then(() => seedSystemExercises(getDb()))
    .then(({ insertedCount }) => {
      if (insertedCount > 0) {
        app.log.info(`Seeded ${insertedCount} system exercise(s) on boot.`);
      }
    })
    .catch((err) => {
      app.log.error({ err }, 'Failed to seed system exercises on boot');
    });
}

main();
