#!/usr/bin/env node
/**
 * Fails when a workspace depends on a package whose **required** peer
 * dependencies are not installed.
 *
 * Story 56. `@clerk/clerk-expo` declares `expo-web-browser` and
 * `expo-auth-session` as required peers and neither was in
 * `apps/mobile/package.json`. Nothing caught it: no app file imports them
 * (Clerk does, internally), so typecheck passed; the mobile suite mocks the
 * api client and never mounts `ClerkProvider`'s real import graph, so tests
 * passed; the production build passed. `npm install` prints a peer warning,
 * but it scrolls past among the existing vulnerability warnings and is not an
 * error. The gap surfaced only when the app was first launched on a simulator
 * and crashed with `Cannot find native module 'ExpoWebBrowser'` — it had been
 * broken for as long as mobile auth had existed, because nobody had run it.
 *
 * The point is not that one package: an audit found no other missing required
 * peer, so it is currently a class of one. The point is that nothing would
 * detect the second instance either.
 *
 * Deliberately ~a hundred lines of Node with no dependencies rather than a
 * dependency-checking framework. `npm ls` is not sufficient: it conflates
 * optional and required peers, and its exit code is noisy in a workspace repo.
 *
 * Optional peers are ignored. `@clerk/clerk-expo` legitimately lists five
 * (`expo-crypto`, `expo-apple-authentication`, `expo-local-authentication`,
 * `expo-secure-store`, `@clerk/expo-passkeys`); flagging those would train
 * everyone to ignore the check, which is worse than not having it.
 *
 * A missing peer is only an **error** when the dependency imports it as a
 * value somewhere in its shipped JavaScript, because that is the case that
 * crashes at launch. A peer referenced only from `.d.ts` files cannot, and is
 * reported as a warning instead.
 *
 * That distinction is drawn automatically rather than through an allowlist,
 * and the reason is the story's own warning: a hand-maintained list of
 * exceptions is how a check gets quietly neutered. It is also not
 * hypothetical here — `fastify-type-provider-zod` declares `@fastify/swagger`
 * and `openapi-types` as required peers, marks neither optional, and imports
 * neither at runtime. Failing on those would have made this check's first run
 * a false alarm.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Every workspace package.json, from the root manifest's `workspaces` globs. */
function workspacePackages() {
  const root = readJson(join(repoRoot, 'package.json'));
  const patterns = root?.workspaces ?? [];
  const found = [];
  for (const pattern of patterns) {
    // Only the `dir/*` form this repo uses; a literal path also works.
    if (pattern.endsWith('/*')) {
      const base = join(repoRoot, pattern.slice(0, -2));
      if (!existsSync(base)) continue;
      for (const entry of readdirSync(base)) {
        const manifest = join(base, entry, 'package.json');
        if (existsSync(manifest)) found.push(manifest);
      }
    } else {
      const manifest = join(repoRoot, pattern, 'package.json');
      if (existsSync(manifest)) found.push(manifest);
    }
  }
  return found;
}

/**
 * Resolves a package's own manifest, checking the workspace's `node_modules`
 * before the hoisted root — the same order Node's resolver uses, so a locally
 * installed copy is not reported as missing.
 */
function resolveManifest(name, workspaceDir) {
  for (const base of [join(workspaceDir, 'node_modules'), join(repoRoot, 'node_modules')]) {
    const manifest = join(base, ...name.split('/'), 'package.json');
    if (existsSync(manifest)) return manifest;
  }
  return null;
}

function isInstalled(name, workspaceDir) {
  return resolveManifest(name, workspaceDir) !== null;
}

/**
 * Whether `depDir`'s shipped JavaScript imports `peerName` as a value.
 *
 * Scans `.js`/`.cjs`/`.mjs` only — never `.d.ts` — so a peer that exists
 * purely in type declarations is not treated as able to crash the app.
 * Bounded to a few thousand files so a pathological package cannot make the
 * check slow.
 */
function importsAtRuntime(depDir, peerName) {
  const needle = new RegExp(
    `(?:require\\(|from\\s*)['"\`]${peerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/[^'"\`]*)?['"\`]`,
  );
  let budget = 4000;
  const walk = (dir) => {
    if (budget <= 0) return false;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (budget <= 0) return false;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        if (walk(full)) return true;
        continue;
      }
      if (!/\.(?:js|cjs|mjs)$/.test(entry.name)) continue;
      budget -= 1;
      try {
        if (needle.test(readFileSync(full, 'utf8'))) return true;
      } catch {
        /* unreadable file is not evidence either way */
      }
    }
    return false;
  };
  return walk(depDir);
}

const problems = [];

for (const manifestPath of workspacePackages()) {
  const workspaceDir = dirname(manifestPath);
  const manifest = readJson(manifestPath);
  if (!manifest) continue;

  const declared = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };

  for (const depName of Object.keys(declared)) {
    const depManifestPath = resolveManifest(depName, workspaceDir);
    if (!depManifestPath) continue; // Not installed at all; npm install reports that.
    const depManifest = readJson(depManifestPath);
    const peers = depManifest?.peerDependencies ?? {};
    const meta = depManifest?.peerDependenciesMeta ?? {};

    for (const [peerName, range] of Object.entries(peers)) {
      if (meta[peerName]?.optional) continue;
      // A package may satisfy its own peer from its own tree.
      if (isInstalled(peerName, workspaceDir)) continue;
      problems.push({
        workspace: manifest.name ?? workspaceDir,
        missing: peerName,
        range,
        requiredBy: `${depName}@${depManifest?.version ?? '?'}`,
        runtime: importsAtRuntime(dirname(depManifestPath), peerName),
      });
    }
  }
}

const errors = problems.filter((problem) => problem.runtime);
const warnings = problems.filter((problem) => !problem.runtime);

function describe(problem) {
  return [
    `  ${problem.workspace}`,
    `    missing:     ${problem.missing}@${problem.range}`,
    `    required by: ${problem.requiredBy}`,
  ].join('\n');
}

if (warnings.length) {
  console.warn(
    `Type-only peers not installed (${warnings.length}) — cannot crash at ` +
      'runtime, so not a failure:\n',
  );
  for (const problem of warnings) console.warn(`${describe(problem)}\n`);
}

if (errors.length === 0) {
  console.log('peer dependencies: OK — every runtime-required peer is installed');
  process.exit(0);
}

console.error(`Missing required peer dependencies (${errors.length}):\n`);
for (const problem of errors) console.error(`${describe(problem)}\n`);
console.error('Install them in the workspace that owns the dependency, then re-run.');
process.exit(1);
