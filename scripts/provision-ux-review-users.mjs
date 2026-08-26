/**
 * Provisions the Clerk users the autonomous UX reviewer signs in as.
 *
 * One user per persona rather than one shared account: the reviewer's whole
 * point is that a novice and a data-motivated lifter should meet *different*
 * products, and that only works if their histories differ. Sharing one login
 * would make every seeded state fight the last run's leftovers.
 *
 * Idempotent — re-running adopts the existing users instead of creating
 * duplicates, so this is safe to run whenever a machine needs the accounts.
 *
 * Development instance only. Refuses to run against a live key.
 */
import { createClerkClient } from '@clerk/backend';
import { readFileSync } from 'node:fs';

function envFrom(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const api = envFrom(new URL('../apps/api/.env', import.meta.url).pathname);
const secretKey = api.CLERK_SECRET_KEY;

if (!secretKey) throw new Error('CLERK_SECRET_KEY missing from apps/api/.env');
if (!secretKey.startsWith('sk_test_')) {
  // The only guard that matters here. Creating users on a live instance would
  // put synthetic accounts in front of real people.
  throw new Error('Refusing to run: CLERK_SECRET_KEY is not a development key.');
}

const password = process.env.UX_REVIEW_PASSWORD;
if (!password || password.length < 12) {
  throw new Error('Set UX_REVIEW_PASSWORD (12+ chars) before running.');
}

/**
 * `+clerk_test` addresses verify with the fixed code 424242 on a development
 * instance, so no mailbox is ever involved. See
 * docs/design/design-review-account.md.
 */
export const uxReviewPersonas = [
  { key: 'novice', email: 'setframe+clerk_test+ux-novice@example.com', firstName: 'Nova', lastName: 'Novice' },
  { key: 'lifter', email: 'setframe+clerk_test+ux-lifter@example.com', firstName: 'Lee', lastName: 'Lifter' },
  { key: 'analyst', email: 'setframe+clerk_test+ux-analyst@example.com', firstName: 'Dana', lastName: 'Data' },
];

const clerk = createClerkClient({ secretKey });
const results = [];

for (const persona of uxReviewPersonas) {
  const existing = await clerk.users.getUserList({ emailAddress: [persona.email] });
  let user = existing.data[0];

  if (user) {
    // Reset the password so a rotated UX_REVIEW_PASSWORD still signs in.
    user = await clerk.users.updateUser(user.id, { password, skipPasswordChecks: true });
    results.push({ ...persona, id: user.id, action: 'adopted' });
    continue;
  }

  user = await clerk.users.createUser({
    emailAddress: [persona.email],
    password,
    firstName: persona.firstName,
    lastName: persona.lastName,
    skipPasswordChecks: true,
    publicMetadata: { purpose: 'ux-review', persona: persona.key },
  });
  results.push({ ...persona, id: user.id, action: 'created' });
}

for (const r of results) console.log(`${r.action.padEnd(8)} ${r.key.padEnd(8)} ${r.id}  ${r.email}`);
