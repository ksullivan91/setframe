/**
 * Opens the most recent UX review report.
 *
 * The reports are Markdown beside their screenshots, which is the right format
 * to commit-diff and the wrong one to *read* — the evidence is the point, and
 * nobody wants to open eleven PNGs by hand. This renders them into one page
 * and opens it.
 */
import { readdirSync, statSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';

const root = new URL('../ux-tests/reports/', import.meta.url).pathname;
if (!existsSync(root)) {
  console.error('No reports yet. Run: npm run ux:review --workspace=@setframe/web');
  process.exit(1);
}

const runs = [];
for (const journey of readdirSync(root)) {
  const journeyDir = join(root, journey);
  if (!statSync(journeyDir).isDirectory()) continue;
  for (const viewport of readdirSync(journeyDir)) {
    const dir = join(journeyDir, viewport);
    const report = join(dir, 'report.md');
    if (existsSync(report)) runs.push({ journey, viewport, dir, report, mtime: statSync(report).mtimeMs });
  }
}

if (!runs.length) {
  console.error('No reports found. Run: npm run ux:review --workspace=@setframe/web');
  process.exit(1);
}

runs.sort((a, b) => b.mtime - a.mtime);

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sections = runs.map((run) => {
  const md = readFileSync(run.report, 'utf8');
  const shots = readdirSync(run.dir).filter((f) => f.endsWith('.png')).sort();
  const body = md
    .replace(/^# .*$/m, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .split('\n')
    .map((line) => {
      if (line.startsWith('### ')) return `<h4>${escape(line.slice(4))}</h4>`;
      if (line.startsWith('## ')) return `<h3>${escape(line.slice(3))}</h3>`;
      if (line.startsWith('- ')) return `<li>${escape(line.slice(2))}</li>`;
      return line.trim() ? `<p>${escape(line)}</p>` : '';
    })
    .join('\n');
  const images = shots
    .map((f) => `<figure><img src="${run.journey}/${run.viewport}/${f}"><figcaption>${f}</figcaption></figure>`)
    .join('\n');
  return `<section><h2>${escape(run.journey)} — ${escape(run.viewport)}</h2>${body}
    <div class="shots">${images}</div></section>`;
});

const html = `<!doctype html><meta charset="utf-8"><title>Setframe UX review</title>
<style>
  body { font: 15px/1.6 -apple-system, system-ui, sans-serif; margin: 0; background: #f6f6f8; color: #16161d; }
  main { max-width: 1100px; margin: 0 auto; padding: 32px 20px 80px; }
  h1 { font-size: 28px; }
  section { background: #fff; border-radius: 14px; padding: 24px; margin-bottom: 28px; }
  h2 { margin-top: 0; }
  h4 { margin: 18px 0 4px; }
  li { margin-left: 18px; }
  .shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-top: 20px; }
  figure { margin: 0; }
  img { width: 100%; border: 1px solid #dcdce4; border-radius: 8px; display: block; }
  figcaption { font-size: 12px; color: #66667a; margin-top: 6px; }
</style>
<main><h1>Setframe UX review</h1>
<p>Newest first. Re-run with <code>npm run ux:review --workspace=@setframe/web</code>.</p>
${sections.join('\n')}</main>`;

const out = join(root, 'index.html');
writeFileSync(out, html);
console.log(`Report: ${out}`);
execFile('open', [out], (err) => { if (err) console.log('Open it manually in a browser.'); });
