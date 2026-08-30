import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { training } from '@setframe/design-tokens';
import { buildWeekStrip } from '@setframe/domain';
import { ThemeProvider } from '../theme/ThemeProvider';
import { WeekStrip } from '../components/training-v2/WeekStrip';
import { ListRow } from '../components/training-v2/TrainingCards';

/**
 * Mobile's half of the Training v2 geometry contract.
 *
 * `apps/web/e2e/functional/training-v2-figma-parity.spec.ts` asserts the same
 * numbers against computed layout in a real browser. Both sides read the
 * `training` tokens, so this cannot pass while web fails on the same value —
 * what it does catch is a component that ignores the token and hardcodes its
 * own, which is how the two builds drift apart in practice.
 *
 * Web/mobile parity is a repo rule, and its failure mode is silent: the strip
 * stops lining up on one platform and nothing errors.
 */

const flatten = (style: unknown) => StyleSheet.flatten(style) as Record<string, number>;

type Json = { type: string; props: Record<string, unknown>; children: Json[] | null } | string | null;

/** Reads the rendered HOST tree; `findByProps` returns the composite. */
function findAllByTestIdPrefix(node: Json, prefix: string): Extract<Json, { type: string }>[] {
  if (!node || typeof node === 'string') return [];
  const hits: Extract<Json, { type: string }>[] = [];
  const testID = node.props?.testID;
  if (typeof testID === 'string' && testID.startsWith(prefix)) hits.push(node);
  for (const child of node.children ?? []) hits.push(...findAllByTestIdPrefix(child, prefix));
  return hits;
}

const STRIP = buildWeekStrip({
  localDate: '2026-08-24',
  todayLocalDate: '2026-08-24',
  slots: [
    { dayIndex: 1, dayTypeName: 'Upper A', weekNumber: null, sortOrder: 0 },
    { dayIndex: 4, dayTypeName: 'Upper B', weekNumber: null, sortOrder: 0 },
  ],
  completedDates: [],
  restDates: [],
});

function renderStrip(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ThemeProvider>
        <WeekStrip days={STRIP} />
      </ThemeProvider>,
    );
  });
  return tree;
}

describe('WeekStrip (mobile)', () => {
  it('renders seven days at the design width and gap', () => {
    const days = findAllByTestIdPrefix(renderStrip().toJSON() as Json, 'week-day-');
    expect(days).toHaveLength(7);
    for (const day of days) {
      expect(flatten(day.props.style).width).toBe(training.weekStrip.dayWidth);
    }
  });

  it('sums to the card inner width, which is what keeps it flush', () => {
    /* 7 * 42 + 6 * 6 = 330. The same assertion the web spec makes against
       real layout; here it is arithmetic on the tokens both sides read. */
    const total =
      7 * training.weekStrip.dayWidth + 6 * training.weekStrip.dayGap;
    expect(total).toBe(training.cardInnerWidth);
  });

  it('runs Sunday-first, matching the product week rather than the Figma frame', () => {
    const days = findAllByTestIdPrefix(renderStrip().toJSON() as Json, 'week-day-');
    expect(days.map((d) => d.props.testID)).toEqual([
      'week-day-2026-08-23',
      'week-day-2026-08-24',
      'week-day-2026-08-25',
      'week-day-2026-08-26',
      'week-day-2026-08-27',
      'week-day-2026-08-28',
      'week-day-2026-08-29',
    ]);
  });

  it('names every day accessibly, because one letter is ambiguous', () => {
    /* Two chips read "T". The letter alone cannot be the accessible name. */
    const labels = findAllByTestIdPrefix(renderStrip().toJSON() as Json, 'week-day-').map(
      (d) => d.props.accessibilityLabel as string,
    );
    expect(labels[0]).toMatch(/^Sunday, /);
    expect(labels[2]).toMatch(/^Tuesday, /);
    expect(new Set(labels).size).toBe(7);
  });
});

describe('ListRow (mobile)', () => {
  it('pads to the design row height and carries the badge', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <ThemeProvider>
          <ListRow name="Upper A" meta="6 exercises" badge="Next up" divided={false} testID="row-1" />
        </ThemeProvider>,
      );
    });
    const row = findAllByTestIdPrefix(tree.toJSON() as Json, 'row-1')[0]!;
    expect(flatten(row.props.style).paddingVertical).toBe(training.workoutRow.paddingY);
    expect(JSON.stringify(tree.toJSON())).toContain('Next up');
  });
});
