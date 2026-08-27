import type { Finding, Severity } from './review';

/**
 * Scoring a workflow, so "looks good" is not an acceptable conclusion.
 *
 * Story §7. Nine dimensions, 1–5, with a gate that decides whether a story may
 * be called UX-complete.
 *
 * The important design decision here: **scores are derived from findings, not
 * typed in.** A number a reviewer chooses by feel is the same subjective
 * judgement as "looks good" wearing a costume, and it is worse because it
 * looks defensible. Every deduction below traces back to something observed,
 * with evidence attached, so a score can be argued with by disputing the
 * finding rather than the mood.
 *
 * Dimensions no automated check can honestly assess — Delight, and much of
 * Data payoff — are reported as `null` rather than given a flattering default.
 * A rubric that quietly awards 5/5 for things it never measured is worse than
 * one with holes in it, because it launders ignorance as confidence.
 */

export const scoreDimensions = [
  'taskClarity',
  'efficiency',
  'feedback',
  'errorRecovery',
  'visualHierarchy',
  'mobileErgonomics',
  'accessibility',
  'delight',
  'dataPayoff',
] as const;

export type ScoreDimension = (typeof scoreDimensions)[number];

export const dimensionLabels: Record<ScoreDimension, string> = {
  taskClarity: 'Task clarity',
  efficiency: 'Efficiency',
  feedback: 'Feedback',
  errorRecovery: 'Error recovery',
  visualHierarchy: 'Visual hierarchy',
  mobileErgonomics: 'Mobile ergonomics',
  accessibility: 'Accessibility',
  delight: 'Delight',
  dataPayoff: 'Data payoff',
};

/** `null` means "not assessed", which is different from "fine". */
export type Score = 1 | 2 | 3 | 4 | 5 | null;

export type Scorecard = Record<ScoreDimension, Score>;

/** Which dimension a finding's category counts against. */
export type FindingDimension = ScoreDimension;

export interface ScoredFinding extends Finding {
  dimension?: FindingDimension;
}

const severityCost: Record<Severity, number> = { P0: 4, P1: 2, P2: 1, P3: 0 };

/**
 * The workflow kind, because the gate is stricter for some.
 *
 * `gym` covers anything performed mid-workout; `dataEntry` anything whose
 * purpose is capturing what the user did; `payoff` the screens that exist to
 * give entered data back as meaning.
 */
export type WorkflowKind = 'gym' | 'dataEntry' | 'payoff' | 'general';

export interface ScoreInput {
  findings: ScoredFinding[];
  /** Measured, not estimated. */
  interactions: number;
  /** What a competent user should need. Above this, efficiency suffers. */
  expectedInteractions?: number;
  kind: WorkflowKind;
  /** Set when the journey could genuinely assess these; otherwise null. */
  assessed?: Partial<Record<ScoreDimension, boolean>>;
}

/**
 * Turns findings into a scorecard.
 *
 * Starts every measurable dimension at 5 and deducts for what was actually
 * observed. Starting low and awarding points would require the reviewer to
 * prove a positive, which it cannot do — the absence of a finding is evidence
 * of nothing going wrong, not evidence of excellence, but it is the only
 * honest direction to run the arithmetic.
 */
export function scoreWorkflow(input: ScoreInput): Scorecard {
  const card = Object.fromEntries(scoreDimensions.map((d) => [d, 5])) as Record<ScoreDimension, number>;

  for (const finding of input.findings) {
    const dimension = finding.dimension ?? inferDimension(finding);
    card[dimension] -= severityCost[finding.severity];
  }

  /* Efficiency is the one dimension with a direct measurement rather than a
     proxy, so it is scored from the count instead of from findings. */
  if (input.expectedInteractions != null) {
    const overshoot = input.interactions - input.expectedInteractions;
    if (overshoot > 0) card.efficiency -= Math.min(4, Math.ceil(overshoot / 2));
  }

  const clamp = (value: number): Score => Math.max(1, Math.min(5, value)) as Score;

  return Object.fromEntries(
    scoreDimensions.map((dimension) => {
      // Not assessed → null. Never a flattering default.
      const assessed = input.assessed?.[dimension];
      if (assessed === false) return [dimension, null];
      if (assessed === undefined && (dimension === 'delight' || dimension === 'dataPayoff')) {
        return [dimension, null];
      }
      return [dimension, clamp(card[dimension])];
    }),
  ) as Scorecard;
}

/** Best-effort mapping when a finding does not name its dimension. */
function inferDimension(finding: ScoredFinding): ScoreDimension {
  const text = `${finding.title} ${finding.observed}`.toLowerCase();
  if (/overflow|touch target|44px|viewport|scroll/.test(text)) return 'mobileErgonomics';
  if (/focus|aria|screen reader|colour alone|color alone|keyboard/.test(text)) return 'accessibility';
  if (/fail|error|retry|lost|not saved/.test(text)) return 'errorRecovery';
  if (/serialis|serializ|slow|blocked|latency|duplicate|repeated/.test(text)) return 'feedback';
  if (/hierarchy|competing|outshout|dead control|disabled/.test(text)) return 'visualHierarchy';
  if (/no route|no way|cannot|missing|not offered/.test(text)) return 'taskClarity';
  return 'taskClarity';
}

export interface GateResult {
  passed: boolean;
  reasons: string[];
}

/**
 * The gate from §7.
 *
 * A dimension that was not assessed cannot fail the gate — but it is reported,
 * so "we never looked" is visible rather than silently passing.
 */
export function evaluateGate(card: Scorecard, kind: WorkflowKind): GateResult {
  const reasons: string[] = [];
  const check = (dimension: ScoreDimension, minimum: number, why: string) => {
    const score = card[dimension];
    if (score != null && score < minimum) {
      reasons.push(`${dimensionLabels[dimension]} is ${score}/5 (needs ≥${minimum}) — ${why}.`);
    }
  };

  for (const dimension of scoreDimensions) {
    check(dimension, 3, 'no dimension may sit below 3');
  }
  check('taskClarity', 4, 'a user who cannot tell what to do has no workflow');
  if (kind === 'gym') {
    check('mobileErgonomics', 4, 'this is performed mid-workout, one-handed');
  }
  if (kind === 'dataEntry') {
    check('errorRecovery', 4, 'a data-entry workflow must make mistakes cheap to undo');
  }
  if (kind === 'payoff') {
    check('dataPayoff', 4, 'a payoff screen that does not repay entered data has no reason to exist');
  }

  return { passed: reasons.length === 0, reasons: [...new Set(reasons)] };
}

/** Renders the scorecard for the report. */
export function formatScorecard(card: Scorecard, gate: GateResult): string[] {
  const lines = ['## Scores', '', '| Dimension | Score |', '|---|---|'];
  for (const dimension of scoreDimensions) {
    const score = card[dimension];
    lines.push(`| ${dimensionLabels[dimension]} | ${score == null ? '— *not assessed*' : `${score}/5`} |`);
  }
  lines.push('');
  lines.push(gate.passed ? '**Gate: passed.**' : '**Gate: failed.**');
  if (!gate.passed) {
    lines.push('');
    for (const reason of gate.reasons) lines.push(`- ${reason}`);
  }
  lines.push('');
  lines.push(
    '_Scores are derived from the findings above, not typed in. Dimensions marked "not assessed" are ones no automated check can honestly judge._',
  );
  lines.push('');
  return lines;
}
