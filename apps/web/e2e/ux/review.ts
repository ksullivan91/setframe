import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';
import type { PersonaKey } from './auth';
import { personaAccounts } from './auth';
import { NetworkWatcher } from './network';
import {
  evaluateGate,
  formatScorecard,
  scoreWorkflow,
  type ScoredFinding,
  type WorkflowKind,
} from './score';

/**
 * The evidence half of the review system.
 *
 * A UX finding without evidence is an opinion, and opinions about a screen
 * nobody can re-open are unactionable. Every journey here produces the same
 * three artefacts — screenshots, a measured interaction count, and a Markdown
 * report — so a finding can be argued with rather than merely believed.
 *
 * Deliberately *not* assertions. A journey that fails a hard expectation stops
 * the run and hides everything after it, which is the opposite of what a
 * review wants: the whole point is to walk the entire flow and report on it.
 * Only genuine breakage — a page that will not load, an element that does not
 * exist — should fail the test. Everything else is a finding.
 */

export const REPORT_ROOT = new URL('../../../../ux-tests/reports/', import.meta.url).pathname;

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';

export interface Finding {
  severity: Severity;
  /**
   * Whose defect this is.
   *
   * A third-party failure is still worth reporting — a broken vendor script
   * breaks the product for the user regardless of whose repository it lives
   * in — but it must not be scored against our own workflow quality. Clerk's
   * SDK failing to fetch one of its chunks in WebKit drove "Error recovery"
   * to 1/5 and failed the gate on all three journeys, which says something
   * untrue about screens that were working correctly.
   */
  source?: 'product' | 'third-party';
  title: string;
  /** What the reviewer saw, in the user's terms rather than the DOM's. */
  observed: string;
  /** Why it matters to that persona, on that viewport. */
  impact: string;
  /** Screenshot filename, relative to the report. */
  evidence?: string;
}

export interface JourneyReport {
  journey: string;
  persona: PersonaKey;
  viewport: string;
  /**
   * Taps/clicks/keystroke-groups the persona spent to reach the goal.
   *
   * Counted rather than estimated: interaction cost is the one UX property
   * that is cheap to measure and almost always argued about from memory.
   */
  interactions: number;
  screenshots: string[];
  findings: Finding[];
  notes: string[];
  kind: WorkflowKind;
  expectedInteractions?: number;
  /** Dimensions this journey genuinely evaluated. */
  assessed?: Partial<Record<import('./score').ScoreDimension, boolean>>;
}

/** Wraps a page so every click the journey makes is counted. */
export class ReviewSession {
  readonly screenshots: string[] = [];
  readonly findings: Finding[] = [];
  readonly notes: string[] = [];
  private count = 0;
  private readonly assessed: Partial<Record<import('./score').ScoreDimension, boolean>> = {};

  private readonly viewport: string;

  /** Wire-level observation, so defects invisible on screen still surface. */
  readonly network: NetworkWatcher;

  constructor(
    private readonly page: Page,
    private readonly journey: string,
    private readonly persona: PersonaKey,
    private readonly kind: WorkflowKind = 'general',
    private readonly expectedInteractions?: number,
  ) {
    this.network = new NetworkWatcher(page);
    /* Read from the page, never passed in. A hardcoded label meant the
       desktop project wrote its report over the mobile one — the same journey
       at two widths silently became one report, which is precisely the
       comparison the two viewports exist to enable.

       The browser is part of the label for the same reason. `ux-mobile` and
       `ux-webkit` deliberately share the iPhone viewport and differ only in
       engine, so size alone made WebKit overwrite Chromium — hiding exactly
       the WebKit-only regressions that project exists to catch. */
    const size = page.viewportSize();
    const dimensions = size ? `${size.width}x${size.height}` : 'unknown-viewport';
    this.viewport = `${page.context().browser()?.browserType().name() ?? 'browser'}-${dimensions}`;
  }

  /** A click, counted. Use this instead of `page.click` inside a journey. */
  async tap(selectorOrLocator: string | ReturnType<Page['locator']>): Promise<void> {
    const locator = typeof selectorOrLocator === 'string' ? this.page.locator(selectorOrLocator) : selectorOrLocator;
    await locator.click();
    this.count += 1;
  }

  /** Typing a value counts as one interaction, not one per character. */
  async type(selectorOrLocator: string | ReturnType<Page['locator']>, value: string): Promise<void> {
    const locator = typeof selectorOrLocator === 'string' ? this.page.locator(selectorOrLocator) : selectorOrLocator;
    await locator.fill(value);
    this.count += 1;
  }

  get interactions(): number {
    return this.count;
  }

  /** Captures a labelled step. The filename carries the order, so a reader can follow the flow. */
  async capture(label: string): Promise<string> {
    const slug = `${String(this.screenshots.length + 1).padStart(2, '0')}-${label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}.png`;
    const file = join(REPORT_ROOT, this.journey, this.viewport, slug);
    mkdirSync(dirname(file), { recursive: true });
    try {
      await this.page.screenshot({ path: file, fullPage: true });
    } catch {
      /* A very tall page — Progress, with several charts — can exceed the
         browser's snapshot limit and throw `Could not capture snapshot`.
         Losing the whole review because one screenshot was too big is the
         wrong trade: capture the viewport instead and say so. Evidence that
         is merely partial still beats a run that died. */
      await this.page.screenshot({ path: file, fullPage: false });
      this.note(`${slug} captured at viewport size — the full page was too tall to snapshot.`);
    }
    this.screenshots.push(slug);
    return slug;
  }

  find(finding: Finding): void {
    this.findings.push(finding);
  }

  /**
   * Declares that this journey actually evaluated a dimension.
   *
   * Without this, `delight` and `dataPayoff` default to "not assessed" and
   * therefore cannot fail the gate — which quietly disables the story's
   * deliberate rule that a Progress screen scoring below 4 on Data payoff is
   * a failure. A journey that genuinely looks at the payoff says so here.
   */
  assess(dimension: import('./score').ScoreDimension, didAssess = true): void {
    this.assessed[dimension] = didAssess;
  }

  note(text: string): void {
    this.notes.push(text);
  }

  /**
   * Records anything the browser itself complained about.
   *
   * Console errors are the cheapest real signal available and are invisible in
   * a screenshot; a page that looks fine while throwing on every render is a
   * finding the reviewer would otherwise miss entirely.
   */
  /** Starts console *and* network observation. */
  watch(): void {
    this.watchConsole();
    this.network.start();
  }

  watchConsole(): void {
    /* Hosts whose failures are not this codebase's to fix. Named explicitly
       rather than inferred as "not our origin", because a bundled dependency
       still fails from our origin and *is* ours. */
    const thirdPartyHost = /clerk\.(accounts\.dev|com)|clerk-telemetry|googleapis|gstatic/i;

    const attribute = (text: string): 'product' | 'third-party' =>
      thirdPartyHost.test(text) ? 'third-party' : 'product';



    this.page.on('pageerror', (error) => {
      const text = `${error.message ?? error} ${error.stack ?? ''}`;
      const source = attribute(text);
      this.find({
        severity: 'P1',
        source,
        title:
          source === 'third-party'
            ? 'A third-party script failed while using the app'
            : 'Uncaught error while using the app',
        observed: String(error.message ?? error),
        impact:
          source === 'third-party'
            ? 'Not this codebase, but the user still meets it. Worth chasing with the vendor rather than scoring against these screens.'
            : 'The screen may look correct while its behaviour is already broken.',
      });
    });

    /* Console errors carry the failing URL that `pageerror` does not, which is
       the only thing that distinguished "our bundle is broken" from "Clerk's
       CDN chunk 404'd". Without it the same message was reported for three
       runs as an unattributed product defect. */
    this.page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (!/ChunkLoadError|Failed to fetch|Importing a module script failed/i.test(text)) return;
      const source = attribute(`${text} ${message.location().url}`);
      this.find({
        severity: source === 'third-party' ? 'P2' : 'P1',
        source,
        title:
          source === 'third-party'
            ? `A third-party script failed to load (${new URL(message.location().url || 'https://unknown/').host})`
            : 'A script failed to load',
        observed: text.slice(0, 300),
        impact:
          source === 'third-party'
            ? 'The vendor SDK could not fetch part of itself. In this engine that may break flows which depend on it, such as a hosted sign-in form.'
            : 'Part of the application never arrived, so the screen is running on whatever loaded.',
      });
    });
  }

  /**
   * WebKit reports a failed dynamic import as a bare
   * "TypeError: Importing a module script failed" — no URL, no usable stack —
   * so it cannot be attributed on its own. The paired `ChunkLoadError` does
   * name the host.
   *
   * Correlated here rather than as the events arrive, because `pageerror`
   * fires *before* the console error that identifies the vendor: a flag set
   * during the run is always still false when it is needed. Attributing at
   * report time sees the whole run at once.
   */
  private correlateUnattributedModuleErrors(): void {
    const sawThirdParty = this.findings.some((finding) => finding.source === 'third-party');
    if (!sawThirdParty) return;
    for (const finding of this.findings) {
      if (finding.source === 'third-party') continue;
      if (!/Importing a module script failed/i.test(finding.observed)) continue;
      finding.source = 'third-party';
      finding.title = 'A third-party script failed while using the app';
      finding.observed += ' — no URL of its own; correlated with the third-party chunk failure in the same run.';
      finding.impact =
        'Not this codebase, but the user still meets it. Worth chasing with the vendor rather than scoring against these screens.';
    }
  }

  toReport(): JourneyReport {
    this.correlateUnattributedModuleErrors();
    /* Network findings are merged in at report time rather than as they
       happen, because most of them are only visible once the whole journey's
       traffic can be compared against itself. */
    const networkFindings = this.network.findings();
    this.notes.push(this.network.summary());
    return {
      journey: this.journey,
      persona: this.persona,
      viewport: this.viewport,
      interactions: this.count,
      screenshots: this.screenshots,
      findings: [...this.findings, ...networkFindings],
      notes: this.notes,
      kind: this.kind,
      expectedInteractions: this.expectedInteractions,
      assessed: this.assessed,
    };
  }
}

const severityOrder: Severity[] = ['P0', 'P1', 'P2', 'P3'];

/** Writes the Markdown report beside its screenshots. */
export function writeReport(report: JourneyReport): string {
  const dir = join(REPORT_ROOT, report.journey, report.viewport);
  mkdirSync(dir, { recursive: true });

  const sorted = [...report.findings].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
  );

  const lines: string[] = [
    `# ${report.journey} — ${report.viewport}`,
    '',
    `- **Persona:** ${personaAccounts[report.persona].label}`,
    `- **Viewport:** ${report.viewport}`,
    `- **Interactions to complete:** ${report.interactions}`,
    `- **Generated:** ${new Date().toISOString()}`,
    '',
    '## Findings',
    '',
  ];

  if (!sorted.length) {
    lines.push('No findings. The journey completed without anything worth raising.', '');
  } else {
    for (const finding of sorted) {
      const tag = finding.source === 'third-party' ? ' _(third-party — not scored)_' : '';
      lines.push(`### ${finding.severity} — ${finding.title}${tag}`, '');
      lines.push(`**Observed.** ${finding.observed}`, '');
      lines.push(`**Impact.** ${finding.impact}`, '');
      if (finding.evidence) lines.push(`![${finding.title}](./${finding.evidence})`, '');
    }
  }

  /* Third-party failures are listed in full but excluded from scoring: they
     are not a measure of this product's workflow quality, and letting them
     drive the gate reports something untrue about screens that work. */
  const ourFindings = sorted.filter((finding) => finding.source !== 'third-party');
  const card = scoreWorkflow({
    findings: ourFindings as ScoredFinding[],
    interactions: report.interactions,
    expectedInteractions: report.expectedInteractions,
    kind: report.kind,
    assessed: report.assessed,
  });
  lines.push(...formatScorecard(card, evaluateGate(card, report.kind)));

  if (report.notes.length) {
    lines.push('## Notes', '');
    for (const note of report.notes) lines.push(`- ${note}`);
    lines.push('');
  }

  lines.push('## Steps', '');
  for (const shot of report.screenshots) lines.push(`![${shot}](./${shot})`, '');

  const file = join(dir, 'report.md');
  writeFileSync(file, lines.join('\n'));
  return file;
}
