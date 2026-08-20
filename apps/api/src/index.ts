import { buildApp } from './app';

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
}

main();
