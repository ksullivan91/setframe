import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // No live DATABASE_URL exists yet (per task scope) — a placeholder
  // satisfies drizzle-kit's config typing for `db:generate`. `db:migrate`
  // must not be run until a real Neon connection string is provided via
  // env at Phase 1+ deployment time.
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
});
