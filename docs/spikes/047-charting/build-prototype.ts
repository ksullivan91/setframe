/**
 * Story 47 spike — prototype builder.
 *
 * Emits a standalone HTML harness driven by the REAL `@setframe/domain`
 * chart geometry, so the prototype tests the incumbent architecture rather
 * than a reimplementation of it. Geometry for every range is precomputed
 * here (the same call the production renderers make); the HTML adds only
 * the interaction layer — scrub, tap, keyboard, range swap — which is
 * precisely the capability under evaluation.
 *
 * Run: npx tsx docs/spikes/047-charting/build-prototype.ts
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLineChart,
  buildColumnChart,
  filterByRange,
  chartRanges,
  type ChartRange,
  type SeriesPoint,
} from '../../../packages/domain/src/chart-geometry.js';

const here = dirname(fileURLToPath(import.meta.url));

/* ---------- deterministic fixture: 120 days of realistic data ---------- */

const END = '2026-08-25';
/**
 * Deliberately longer than a year. A fixture shorter than the longest
 * offered range makes the "does switching range re-bucket?" check vacuous:
 * 6M/1Y/ALL would all cover the whole series and return equal counts even
 * from an implementation that *did* aggregate correctly. At 500 days the
 * three windows genuinely differ, so equal counts are real evidence.
 */
const DAYS = 500;

function addDays(iso: string, delta: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`) + delta * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Mulberry32 — deterministic so the prototype is reproducible. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Body weight: a slow downward drift with real daily noise, plus genuine
 * gaps (missed check-ins) so the prototype exercises null handling rather
 * than a tidy dense series.
 */
function bodyWeightSeries(): SeriesPoint[] {
  const rand = rng(42);
  const out: SeriesPoint[] = [];
  // Two-state run-length model, so gaps arrive as multi-day stretches (a
  // holiday, an illness) rather than scattered single-day holes. Multi-day
  // gaps are what actually stress null handling and the date-proportional
  // x-axis — i.i.d. dropout does not.
  let logging = true;
  let remaining = 1;
  for (let i = DAYS - 1; i >= 0; i -= 1) {
    if (remaining <= 0) {
      logging = !logging;
      remaining = logging
        ? 6 + Math.floor(rand() * 22) // 6-27 days of consistent logging
        : 2 + Math.floor(rand() * 6); // 2-7 day gap
    }
    remaining -= 1;

    const localDate = addDays(END, -i);
    if (!logging) {
      out.push({ localDate, value: null });
      continue;
    }
    // Slow downward drift with real daily water-weight noise.
    const drift = 178 - (DAYS - i) * 0.017;
    const noise = (rand() - 0.5) * 1.9;
    out.push({ localDate, value: Number((drift + noise).toFixed(1)) });
  }
  return out;
}

/** Sessions: weekly counts, 0–5, with a deload week and a missed week. */
function sessionSeries(): SeriesPoint<{ isCurrent?: boolean }>[] {
  const rand = rng(7);
  const out: SeriesPoint<{ isCurrent?: boolean }>[] = [];
  const weeks = Math.floor(DAYS / 7);
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const localDate = addDays(END, -w * 7);
    const isCurrent = w === 0;
    const value = w === 3 ? 0 : w === 8 ? 1 : 2 + Math.floor(rand() * 3);
    out.push({ localDate, value, meta: isCurrent ? { isCurrent: true } : undefined });
  }
  return out;
}

const weight = bodyWeightSeries();
const sessions = sessionSeries();

/* ---------- precompute geometry per range via the real domain code ------ */

const WIDTH = 720;
const LINE_H = 220;
const BAR_H = 180;

const linePayload: Record<string, unknown> = {};
const barPayload: Record<string, unknown> = {};

for (const range of chartRanges) {
  const w = filterByRange(weight, range as ChartRange, END);
  const s = filterByRange(sessions, range as ChartRange, END);

  linePayload[range] = buildLineChart(w, {
    layout: { width: WIDTH, height: LINE_H, padding: { top: 12, right: 12, bottom: 24, left: 44 } },
    zeroBased: false,
    minimumSpan: 4,
    formatValue: (v) => `${v.toFixed(0)}`,
  });
  barPayload[range] = buildColumnChart(s, {
    layout: { width: WIDTH, height: BAR_H, padding: { top: 12, right: 10, bottom: 24, left: 34 } },
    formatValue: (v) => `${Math.round(v)}`,
  });
}

const pointCounts = Object.fromEntries(
  chartRanges.map((r) => [r, (linePayload[r] as { points: unknown[] }).points.length]),
);

/* ---------- emit the harness ---------- */

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Story 47 — charting spike prototype</title>
<style>
  :root{
    --raw:#7C5CFF; --trend:#2FBF71; --emphasis:#5B3FD9; --empty:#E4E4E7;
    --grid:#E4E4E7; --axis:#71717A; --text:#18181B; --muted:#52525B;
    --surface:#FFFFFF; --canvas:#FAFAFA; --border:#E4E4E7;
  }
  *{box-sizing:border-box}
  body{margin:0;padding:16px;background:var(--canvas);color:var(--text);
    font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;
    padding:16px;margin:0 auto 20px;max-width:760px}
  h2{margin:0 0 2px;font-size:17px}
  .ranges{display:flex;gap:4px;flex-wrap:wrap;margin:12px 0}
  .ranges button{min-height:32px;padding:0 12px;border-radius:999px;border:1px solid var(--border);
    background:transparent;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer}
  .ranges button[aria-pressed="true"]{background:var(--emphasis);color:#fff;border-color:transparent}
  /* The signature: a STATIONARY readout. Values change, layout never moves. */
  .readout{display:flex;gap:24px;align-items:baseline;margin:4px 0 10px;
    font-variant-numeric:tabular-nums;min-height:46px}
  .readout .big{font-size:28px;font-weight:650;letter-spacing:-0.02em}
  .readout .lbl{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
  .plot{width:100%;touch-action:pan-y}
  .meta{font-size:12px;color:var(--muted)}
  svg{display:block;width:100%;height:auto}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
</style></head><body>

<div class="card">
  <h2>Body weight</h2>
  <div class="meta" id="w-period"></div>
  <div class="ranges" id="w-ranges" role="group" aria-label="Body weight time range"></div>
  <div class="readout" aria-live="polite">
    <div><div class="big" id="w-val">—</div><div class="lbl" id="w-date">scrub the plot</div></div>
    <div><div class="big" id="w-change">—</div><div class="lbl">change in range</div></div>
  </div>
  <div class="plot" id="w-plot"></div>
  <div class="meta" id="w-count"></div>
</div>

<div class="card">
  <h2>Training sessions</h2>
  <div class="ranges" id="s-ranges" role="group" aria-label="Sessions time range"></div>
  <div class="readout" aria-live="polite">
    <div><div class="big" id="s-val">—</div><div class="lbl" id="s-date">tap a bar</div></div>
  </div>
  <div class="plot" id="s-plot"></div>
</div>

<!-- Makes the document taller than a phone viewport so the scroll-vs-scrub
     arbitration check exercises something real. Progress is a long page. -->
<div style="height:900px" aria-hidden="true"></div>

<script>
const LINE = ${JSON.stringify(linePayload)};
const BAR  = ${JSON.stringify(barPayload)};
const RANGES = ${JSON.stringify(chartRanges)};
const W=${WIDTH}, LH=${LINE_H}, BH=${BAR_H};

function fmtDate(d){return new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});}

/* ---- line chart with continuous scrub ---- */
let wRange='3M', wSel=null;
function drawLine(){
  const c=LINE[wRange], p=c.plot;
  const pts=c.points;
  document.getElementById('w-count').textContent = pts.length+' measurements';
  if(pts.length){
    const first=pts[0].value, last=pts[pts.length-1].value;
    const d=(last-first);
    document.getElementById('w-change').textContent=(d>=0?'+':'')+d.toFixed(1)+' lb';
    document.getElementById('w-period').textContent=fmtDate(pts[0].localDate)+' – '+fmtDate(pts[pts.length-1].localDate);
  } else {
    // A range with no measurements must clear these, not leave the previous
    // range's numbers on screen relabelled as this one's.
    document.getElementById('w-change').textContent='—';
    document.getElementById('w-period').textContent='no measurements in range';
  }
  const sel = wSel!=null ? pts.find(x=>x.index===wSel) : null;
  const shown = sel || (pts.length?pts[pts.length-1]:null);
  document.getElementById('w-val').textContent = shown? shown.value.toFixed(1)+' lb':'—';
  document.getElementById('w-date').textContent = shown? fmtDate(shown.localDate) : 'no data';

  let g='';
  for(const t of c.ticks){
    g+='<line x1="'+p.x+'" x2="'+(p.x+p.width)+'" y1="'+t.y+'" y2="'+t.y+'" stroke="var(--grid)"/>'
     +'<text x="4" y="'+(t.y+3)+'" font-size="10" fill="var(--axis)">'+t.label+'</text>';
  }
  if(c.areaPath) g+='<path d="'+c.areaPath+'" fill="var(--raw)" opacity=".10"/>';
  if(c.path) g+='<path d="'+c.path+'" fill="none" stroke="var(--raw)" stroke-width="1.5" stroke-linejoin="round" opacity=".55"/>';
  for(const pt of pts){
    g+='<circle class="pt" data-i="'+pt.index+'" cx="'+pt.x+'" cy="'+pt.y+'" r="2.5" fill="var(--raw)" opacity=".7"/>';
  }
  // Selection layer is drawn ONCE and only mutated afterwards. Re-rendering
  // the whole SVG on every pointermove destroys the element holding pointer
  // capture, which silently kills the drag after its first frame — the
  // single most important implementation constraint this spike surfaced.
  g+='<line id="w-cross" x1="0" x2="0" y1="'+p.y+'" y2="'+(p.y+p.height)+'" stroke="var(--emphasis)" stroke-width="1" opacity="0"/>';
  g+='<circle id="w-dot" cx="0" cy="0" r="5" fill="var(--emphasis)" stroke="#fff" stroke-width="2" opacity="0"/>';
  g+='<rect id="w-hit" x="'+p.x+'" y="'+p.y+'" width="'+p.width+'" height="'+p.height+'" fill="transparent" style="cursor:crosshair"/>';
  // Operable, not just an image: the incumbent's real renderers make every
  // mark a focusable labelled control, and ADR 0008 rationale 4 leans on
  // that. A model implementation for Story 48 must not drop it.
  document.getElementById('w-plot').innerHTML=
    '<svg viewBox="0 0 '+W+' '+LH+'" role="application" aria-roledescription="line chart"'
    +' aria-label="Body weight over time. Use left and right arrow keys to inspect measurements."'
    +' id="w-svg" tabindex="0">'+g+'</svg>';
  paintSelection();
  wireScrub();
}
/** Mutates only the selection marks + readout text — no DOM teardown. */
function paintSelection(){
  const pts=LINE[wRange].points;
  const sel = wSel!=null ? pts.find(x=>x.index===wSel) : null;
  const shown = sel || (pts.length?pts[pts.length-1]:null);
  document.getElementById('w-val').textContent = shown? shown.value.toFixed(1)+' lb':'—';
  document.getElementById('w-date').textContent = shown? fmtDate(shown.localDate) : 'no data';
  const cross=document.getElementById('w-cross'), dot=document.getElementById('w-dot');
  if(!cross||!dot) return;
  if(sel){
    cross.setAttribute('x1',sel.x); cross.setAttribute('x2',sel.x); cross.setAttribute('opacity','.35');
    dot.setAttribute('cx',sel.x); dot.setAttribute('cy',sel.y); dot.setAttribute('opacity','1');
  } else {
    cross.setAttribute('opacity','0'); dot.setAttribute('opacity','0');
  }
}
function nearest(clientX){
  const svg=document.getElementById('w-svg'), r=svg.getBoundingClientRect();
  const x=(clientX-r.left)*(W/r.width);
  const pts=LINE[wRange].points; if(!pts.length) return null;
  let best=pts[0],bd=Math.abs(pts[0].x-x);
  for(const p of pts){const d=Math.abs(p.x-x); if(d<bd){bd=d;best=p;}}
  return best;
}
function wireScrub(){
  const hit=document.getElementById('w-hit'); if(!hit) return;
  let down=false;
  const move=e=>{const n=nearest(e.clientX); if(n&&n.index!==wSel){wSel=n.index;paintSelection();}};
  hit.addEventListener('pointerdown',e=>{down=true;hit.setPointerCapture(e.pointerId);move(e);});
  hit.addEventListener('pointermove',e=>{if(down)move(e);});
  hit.addEventListener('pointerup',()=>{down=false;});
  hit.addEventListener('pointercancel',()=>{down=false;});
  const svg=document.getElementById('w-svg');
  svg.addEventListener('keydown',e=>{
    const pts=LINE[wRange].points; if(!pts.length)return;
    let i=pts.findIndex(p=>p.index===wSel); if(i<0)i=pts.length-1;
    if(e.key==='ArrowLeft'){i=Math.max(0,i-1);} else if(e.key==='ArrowRight'){i=Math.min(pts.length-1,i+1);} else return;
    e.preventDefault(); wSel=pts[i].index; paintSelection();
  });
}

/* ---- bar chart with tap ---- */
let sRange='3M', sSel=null;
function drawBar(){
  const c=BAR[sRange], p=c.plot;
  const sel = sSel!=null ? c.columns[sSel] : null;
  document.getElementById('s-val').textContent = sel? (sel.value==null?'—':sel.value+(sel.value===1?' session':' sessions')) : '—';
  document.getElementById('s-date').textContent = sel? ('week of '+fmtDate(sel.localDate)) + (sel.meta&&sel.meta.isCurrent?' · current':'') : 'tap a bar';
  let g='';
  for(const t of c.ticks){
    g+='<line x1="'+p.x+'" x2="'+(p.x+p.width)+'" y1="'+t.y+'" y2="'+t.y+'" stroke="var(--grid)"/>'
     +'<text x="4" y="'+(t.y+3)+'" font-size="10" fill="var(--axis)">'+t.label+'</text>';
  }
  c.columns.forEach((col,i)=>{
    const on=i===sSel, cur=col.meta&&col.meta.isCurrent;
    const h=Math.max(col.height,2), y=col.height<2?(p.y+p.height-2):col.y;
    g+='<rect x="'+col.x+'" y="'+y+'" width="'+col.width+'" height="'+h+'" rx="3" fill="'+
      (col.value===0?'var(--empty)':on?'var(--emphasis)':cur?'var(--trend)':'var(--raw)')+'"/>';
    // Focusable + labelled, matching the incumbent renderers: selection is
    // reachable by keyboard, not locked behind a pointer gesture.
    const lbl=fmtDate(col.localDate)+': '+(col.value==null?'no sessions':col.value+(col.value===1?' session':' sessions'))+(cur?', current week':'');
    g+='<rect class="bhit" data-i="'+i+'" x="'+(p.x+c.slotWidth*i)+'" y="'+p.y+'" width="'+c.slotWidth+'" height="'+p.height+'"'
      +' fill="transparent" style="cursor:pointer;outline:none" tabindex="0" role="button" aria-label="'+lbl+'"/>';
  });
  document.getElementById('s-plot').innerHTML='<svg viewBox="0 0 '+W+' '+BH+'" role="application" aria-roledescription="bar chart" aria-label="Training sessions per week">'+g+'</svg>';
  document.querySelectorAll('.bhit').forEach(el=>{
    const pick=()=>{sSel=+el.dataset.i;drawBar();};
    el.addEventListener('pointerdown',pick);
    el.addEventListener('focus',pick);
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();}});
  });
}

function mkRanges(id,get,set,redraw){
  const host=document.getElementById(id); host.innerHTML='';
  RANGES.forEach(r=>{
    const b=document.createElement('button');
    b.textContent=r; b.dataset.range=r;
    b.setAttribute('aria-pressed', String(get()===r));
    b.onclick=()=>{set(r);
      host.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.range===r)));
      redraw();};
    host.appendChild(b);
  });
}
mkRanges('w-ranges',()=>wRange,r=>{wRange=r;wSel=null;},drawLine);
mkRanges('s-ranges',()=>sRange,r=>{sRange=r;sSel=null;},drawBar);
drawLine(); drawBar();
window.__pointCounts=${JSON.stringify(pointCounts)};
</script></body></html>`;

writeFileSync(join(here, 'prototype-incumbent.html'), html);
console.log('wrote prototype-incumbent.html');
console.log('points per range:', JSON.stringify(pointCounts));
