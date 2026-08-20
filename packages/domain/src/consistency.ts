export interface ConsistencyWeekInput {
  weekStart: string;
  plannedCount: number;
  completedCount: number;
}

/**
 * Backs GET /v1/progress/consistency (docs/api.md "Progress"). Pure
 * aggregation — the API layer supplies plan/completion counts already
 * grouped per ISO week; this just shapes the response and guards against
 * planned=0 weeks (e.g. before a program existed) reporting misleading
 * ratios.
 */
export function summarizeConsistency(weeks: ConsistencyWeekInput[]) {
  return weeks.map((week) => ({
    ...week,
    completionRatio: week.plannedCount > 0 ? week.completedCount / week.plannedCount : null,
  }));
}
