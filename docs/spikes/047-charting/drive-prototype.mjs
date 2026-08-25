/**
 * Story 47 spike — drives the incumbent-architecture prototype in real
 * Chrome and asserts the interactions the pack requires. jsdom cannot
 * compute layout or dispatch real pointer sequences, so scrub quality
 * claims are only meaningful from a real browser.
 *
 * Run: node docs/spikes/047-charting/drive-prototype.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, 'evidence');
mkdirSync(shots, { recursive: true });

/**
 * Playwright's bundled Chromium is not downloaded in this workspace, so a
 * local Chrome is used instead. `print-chrome-path` is the same helper the
 * README points at; the hardcoded macOS path is only a last resort.
 */
function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    return execFileSync(join(process.cwd(), 'node_modules/.bin/print-chrome-path'), { encoding: 'utf8' }).trim();
  } catch {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
}
const CHROME = resolveChrome();
const url = pathToFileURL(join(here, 'prototype-incumbent.html')).href;

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await chromium.launch({ executablePath: CHROME });
try {

/* ---------- desktop pass ---------- */
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
await page.goto(url);
await page.waitForSelector('#w-svg');

const counts = await page.evaluate(() => window.__pointCounts);
console.log('point counts per range:', JSON.stringify(counts));
/**
 * The aggregation gap, stated so it can actually fail. `filterByRange`
 * trims a window but never re-buckets, so mark count grows without bound
 * with history length — a year renders ~one mark per logged day. A correct
 * implementation would cap long ranges by switching to weekly/monthly
 * buckets, keeping the count roughly constant across ranges.
 */
const LEGIBLE_MAX_MARKS = 80;
check(
  'long ranges are NOT aggregated (mark count grows with history)',
  counts['ALL'] > LEGIBLE_MAX_MARKS && counts['1Y'] > LEGIBLE_MAX_MARKS,
  `1W=${counts['1W']} 1M=${counts['1M']} 3M=${counts['3M']} 6M=${counts['6M']} 1Y=${counts['1Y']} ALL=${counts['ALL']} — ALL draws one mark per logged day`,
);

// --- scrub: drag across the plot, assert the readout tracks continuously ---
const box = await page.locator('#w-hit').boundingBox();
const y = box.y + box.height / 2;
const seen = new Set();
await page.mouse.move(box.x + 10, y);
await page.mouse.down();
for (let i = 0; i <= 20; i += 1) {
  await page.mouse.move(box.x + 10 + (box.width - 20) * (i / 20), y);
  seen.add(await page.locator('#w-val').textContent());
}
await page.mouse.up();
check('scrub produces many distinct readout values', seen.size >= 10, `${seen.size} distinct values across one drag`);

// --- readout is stationary: its box must not move while scrubbing ---
const readoutBefore = await page.locator('#w-val').boundingBox();
await page.mouse.move(box.x + 30, y);
await page.mouse.down();
await page.mouse.move(box.x + box.width - 30, y);
await page.mouse.up();
const readoutAfter = await page.locator('#w-val').boundingBox();
check(
  'readout stays stationary during scrub',
  Math.abs(readoutBefore.x - readoutAfter.x) < 1 && Math.abs(readoutBefore.y - readoutAfter.y) < 1,
  `moved ${Math.abs(readoutBefore.x - readoutAfter.x).toFixed(1)}x/${Math.abs(readoutBefore.y - readoutAfter.y).toFixed(1)}y px`,
);
await page.screenshot({ path: join(shots, '01-desktop-scrub.png') });

// --- keyboard selection ---
await page.locator('#w-svg').focus();
const kbBefore = await page.locator('#w-val').textContent();
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('ArrowLeft');
const kbAfter = await page.locator('#w-val').textContent();
check('keyboard arrows move selection', kbBefore !== kbAfter, `${kbBefore} -> ${kbAfter}`);

// --- range swap actually changes the plot ---
await page.locator('#w-ranges button[data-range="1W"]').click();
await page.waitForTimeout(60);
const wkPts = await page.locator('#w-svg circle').count();
await page.locator('#w-ranges button[data-range="ALL"]').click();
await page.waitForTimeout(60);
const allPts = await page.locator('#w-svg circle').count();
check('range swap changes rendered mark count', wkPts !== allPts, `1W=${wkPts} marks, ALL=${allPts} marks`);
await page.screenshot({ path: join(shots, '02-desktop-range-all.png') });

// --- bar chart tap ---
await page.locator('.bhit').nth(6).dispatchEvent('pointerdown');
await page.waitForTimeout(50);
const barVal = await page.locator('#s-val').textContent();
check('bar tap updates readout', barVal.trim() !== '—', `readout="${barVal.trim()}"`);
await page.screenshot({ path: join(shots, '03-desktop-bar-selected.png') });

/* ---------- narrow mobile pass ---------- */
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await m.goto(url);
await m.waitForSelector('#w-svg');
await m.waitForTimeout(100);

const overflow = await m.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}));
check('no horizontal overflow at 390px', overflow.scroll <= overflow.client, `scrollWidth=${overflow.scroll} clientWidth=${overflow.client}`);

/**
 * A genuine touch drag, dispatched through CDP so the events carry
 * `pointerType: "touch"`. Playwright's `mouse.*` API emits mouse pointers
 * even on a `hasTouch` context, which would leave `touch-action: pan-y`
 * and the `pointercancel` path — the two things most likely to break a
 * real touch scrub, since the browser can steal the gesture for scrolling —
 * completely untested.
 */
const mbox = await m.locator('#w-hit').boundingBox();
const my = mbox.y + mbox.height / 2;
const cdp = await m.context().newCDPSession(m);
const mseen = new Set();

async function touch(type, x) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y: my, radiusX: 12, radiusY: 12, force: 1 }],
  });
}

await touch('touchStart', mbox.x + 6);
for (let i = 0; i <= 12; i += 1) {
  await touch('touchMove', mbox.x + 6 + (mbox.width - 12) * (i / 12));
  mseen.add(await m.locator('#w-val').textContent());
}
await touch('touchEnd', 0);
check('real touch drag scrubs (pointerType: touch via CDP)', mseen.size >= 6, `${mseen.size} distinct values`);

// The page must still scroll vertically — `touch-action: pan-y` exists so
// scrub does not hijack the whole gesture surface.
const scrolled = await m.evaluate(async () => {
  window.scrollTo(0, 200);
  await new Promise((r) => requestAnimationFrame(r));
  return window.scrollY;
});
check('vertical page scroll still works', scrolled > 0, `scrollY=${scrolled}`);
await m.evaluate(() => window.scrollTo(0, 0));

await m.screenshot({ path: join(shots, '04-mobile-scrub.png'), fullPage: true });

} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`screenshots: ${shots}`);
process.exit(failed.length ? 1 : 0);
