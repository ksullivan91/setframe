import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';
import type { PersonaKey } from './auth';
import { personaAccounts } from './auth';

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
}

/** Wraps a page so every click the journey makes is counted. */
export class ReviewSession {
  readonly screenshots: string[] = [];
  readonly findings: Finding[] = [];
  readonly notes: string[] = [];
  private count = 0;

  private readonly viewport: string;

  constructor(
    private readonly page: Page,
    private readonly journey: string,
    private readonly persona: PersonaKey,
  ) {
    /* Read from the page, never passed in. A hardcoded label meant the
       desktop project wrote its report over the mobile one — the same journey
       at two widths silently became one report, which is precisely the
       comparison the two viewports exist to enable. */
    const size = page.viewportSize();
    this.viewport = size ? `${size.width}x${size.height}` : 'unknown-viewport';
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
  watchConsole(): void {
    this.page.on('pageerror', (error) => {
      this.find({
        severity: 'P1',
        title: 'Uncaught error while using the app',
        observed: String(error.message ?? error),
        impact: 'The screen may look correct while its behaviour is already broken.',
      });
    });
  }

  toReport(): JourneyReport {
    return {
      journey: this.journey,
      persona: this.persona,
      viewport: this.viewport,
      interactions: this.count,
      screenshots: this.screenshots,
      findings: this.findings,
      notes: this.notes,
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
      lines.push(`### ${finding.severity} — ${finding.title}`, '');
      lines.push(`**Observed.** ${finding.observed}`, '');
      lines.push(`**Impact.** ${finding.impact}`, '');
      if (finding.evidence) lines.push(`![${finding.title}](./${finding.evidence})`, '');
    }
  }

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
