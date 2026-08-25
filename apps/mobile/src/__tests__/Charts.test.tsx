import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { SeriesPoint } from '@setframe/domain';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ColumnChart, LineChart, RangeSelector } from '../components/Charts';

let tree: ReactTestRenderer | null = null;

function renderTree(element: React.ReactElement): ReactTestRenderer {
  act(() => {
    tree = create(<ThemeProvider>{element}</ThemeProvider>);
  });
  return tree!;
}

// `findAll` returns both the composite and its host node; only host nodes are
// actually rendered, so filter on `typeof node.type === 'string'`.
function hostsByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.type === 'string',
  );
}

// The Pressable composite carries both `onPress` and the `style` prop we pass.
function pressablesByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.props?.onPress === 'function',
  );
}

function rectOf(node: ReactTestInstance): {
  left: number;
  width: number;
  top: number;
  height: number;
} {
  return Object.assign({}, ...[node.props.style].flat(2));
}

// The x a point lands on with the 320px fallback width and the LineChart's
// left/right padding of 40/10, for an evenly-spaced daily series.
function expectedX(index: number, count: number): number {
  const plotX = 40;
  const plotWidth = 320 - 40 - 10;
  const ratio = count <= 1 ? 0.5 : index / (count - 1);
  return plotX + ratio * plotWidth;
}

function tapAt(pressables: ReturnType<typeof pressablesByTestId>, x: number) {
  const covering = pressables.find((node) => {
    const rect = rectOf(node);
    return x >= rect.left && x <= rect.left + rect.width;
  })!;
  act(() => {
    covering.props.onPress();
  });
}

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
});

const line = (values: (number | null)[]): SeriesPoint[] =>
  values.map((value, index) => ({
    localDate: `2026-01-${String(index + 1).padStart(2, '0')}`,
    value,
  }));

describe('LineChart', () => {
  const series = line([170.2, 171.1, 170.4, 169.8]);

  it('draws the green trend overlay only when a trend series is supplied', () => {
    const withTrend = renderTree(
      <LineChart series={series} trendSeries={line([170, 170.4, 170.2, 170])} formatValue={(v) => `${v}`} label="Weight" />,
    );
    expect(hostsByTestId(withTrend, 'chart-trend-line')).toHaveLength(1);

    act(() => {
      tree?.unmount();
    });
    tree = null;

    const withoutTrend = renderTree(<LineChart series={series} formatValue={(v) => `${v}`} label="Weight" />);
    expect(hostsByTestId(withoutTrend, 'chart-trend-line')).toHaveLength(0);
  });

  it('exposes every point as a full-height, non-overlapping accessible band', () => {
    const rendered = renderTree(<LineChart series={series} formatValue={(v) => `${v}`} label="Weight" />);
    const hits = pressablesByTestId(rendered, 'chart-point');
    expect(hits).toHaveLength(4);
    expect(hits[0]!.props.accessible).toBe(true);
    expect(hits[0]!.props.accessibilityRole).toBe('button');

    const rects = hits.map(rectOf).sort((a, b) => a.left - b.left);
    // Full plot height (168 − 10 top − 22 bottom = 136), pinned inside bounds.
    for (const rect of rects) {
      expect(rect.top).toBe(10);
      expect(rect.height).toBe(136);
      expect(rect.left).toBeGreaterThanOrEqual(40);
      expect(rect.left + rect.width).toBeLessThanOrEqual(310 + 0.01);
    }
    // Contiguous and disjoint: each band ends exactly where the next begins.
    for (let i = 0; i < rects.length - 1; i += 1) {
      expect(rects[i]!.left + rects[i]!.width).toBeCloseTo(rects[i + 1]!.left, 5);
    }
  });

  it('resolves a tap on a dense daily series to the point under the finger', () => {
    // 12 weeks of daily weigh-ins: ~3.3px apart, well inside a 44px overlay.
    const values = Array.from({ length: 84 }, (_, i) => 150 + i);
    const dense = values.map((value, i) => {
      const day = new Date(Date.UTC(2025, 0, 1) + i * 86_400_000);
      return { localDate: day.toISOString().slice(0, 10), value };
    });
    const rendered = renderTree(
      <LineChart series={dense} formatValue={(v) => `${v.toFixed(0)} lb`} label="Weight" />,
    );
    const hits = pressablesByTestId(rendered, 'chart-point');
    expect(hits).toHaveLength(84);

    for (const target of [1, 40, 83]) {
      tapAt(hits, expectedX(target, dense.length));
      const label = `${values[target]} lb`;
      const shown = rendered.root.findAll(
        (n) => typeof n.type === 'string' && ([] as unknown[]).concat(n.props.children).includes(label),
      );
      expect(shown.length).toBeGreaterThan(0);
    }
  });

  it('provides a gesture-free text equivalent of the whole series', () => {
    const rendered = renderTree(
      <LineChart series={line([170.2, 171.1])} formatValue={(v) => `${v.toFixed(1)} lb`} label="Body weight" />,
    );
    const table = hostsByTestId(rendered, 'chart-table')[0]!;
    expect(table.props.accessible).toBe(true);
    expect(table.props.accessibilityLabel).toContain('Body weight');
    expect(table.props.accessibilityLabel).toContain('170.2 lb');
    expect(table.props.accessibilityLabel).toContain('171.1 lb');
  });

  it('renders nothing when there are no present points', () => {
    const rendered = renderTree(<LineChart series={line([null, null])} formatValue={(v) => `${v}`} label="Empty" />);
    expect(hostsByTestId(rendered, 'chart-point')).toHaveLength(0);
  });
});

describe('ColumnChart', () => {
  it('renders an empty week as a real column rather than omitting it', () => {
    const series: SeriesPoint<{ isCurrent?: boolean }>[] = [
      { localDate: '2026-01-05', value: 3 },
      { localDate: '2026-01-12', value: null },
      { localDate: '2026-01-19', value: 2, meta: { isCurrent: true } },
    ];
    const rendered = renderTree(<ColumnChart series={series} formatValue={(v) => `${v}`} label="Sessions" />);
    const columns = hostsByTestId(rendered, 'chart-column');
    const current = hostsByTestId(rendered, 'chart-column-current');
    // Three slots in, three slots out: the missed week keeps its place.
    expect(columns.length + current.length).toBe(3);
    expect(current).toHaveLength(1);
  });

  it('labels an empty column with the empty label, never a zero', () => {
    const series: SeriesPoint<{ isCurrent?: boolean }>[] = [
      { localDate: '2026-01-05', value: 3 },
      { localDate: '2026-01-12', value: null },
    ];
    const rendered = renderTree(
      <ColumnChart series={series} formatValue={(v) => `${v}`} label="Sessions" emptyLabel="No sessions" />,
    );
    const hits = hostsByTestId(rendered, 'chart-column-hit');
    const emptyHit = hits.find((node) => node.props.accessibilityLabel.includes('No sessions'));
    expect(emptyHit).toBeDefined();
    expect(emptyHit!.props.accessibilityLabel).not.toContain(': 0');
  });

  it('spans each hit target across its whole slot, leaving no dead gaps', () => {
    // The 12-week series this screen always renders: gaps between the ~15px
    // bars must still be tappable, and must resolve to a single column.
    const series: SeriesPoint<{ isCurrent?: boolean }>[] = Array.from({ length: 12 }, (_, i) => ({
      localDate: new Date(Date.UTC(2025, 0, 6) + i * 7 * 86_400_000).toISOString().slice(0, 10),
      value: i % 3 === 0 ? null : i,
    }));
    const rendered = renderTree(<ColumnChart series={series} formatValue={(v) => `${v}`} label="Sessions" />);
    const hits = pressablesByTestId(rendered, 'chart-column-hit');
    expect(hits).toHaveLength(12);

    const rects = hits.map(rectOf).sort((a, b) => a.left - b.left);
    // Slots tile the plot with no gap and no overlap.
    for (let i = 0; i < rects.length - 1; i += 1) {
      expect(rects[i]!.left + rects[i]!.width).toBeCloseTo(rects[i + 1]!.left, 5);
      expect(rects[i]!.width).toBeGreaterThan(0);
    }

    // A tap in the gap just right of the first bar's centre still lands on a
    // column, and adjacent slot centres resolve to different indices.
    const first = rectOf(hits[0]!);
    const second = rectOf(hits[1]!);
    const cover = (x: number) =>
      hits.findIndex((node) => {
        const rect = rectOf(node);
        return x >= rect.left && x <= rect.left + rect.width;
      });
    expect(cover(first.left + first.width - 0.5)).toBe(0);
    expect(cover(second.left + second.width / 2)).toBe(1);
  });

  it('marks a deliberate week off as a rest week, distinct from a vanished week', () => {
    const series: SeriesPoint<{ isCurrent?: boolean; isRest?: boolean }>[] = [
      // A week that vanished: nothing logged, no rest recorded.
      { localDate: '2026-01-05', value: 0 },
      // A deliberate week off: zero trained, but rest was logged.
      { localDate: '2026-01-12', value: 0, meta: { isRest: true } },
      // A trained current week, whose bar already uses the trend tint.
      { localDate: '2026-01-19', value: 4, meta: { isCurrent: true } },
    ];
    const rendered = renderTree(<ColumnChart series={series} formatValue={(v) => `${v}`} label="Sessions" />);

    const vanishedFill = hostsByTestId(rendered, 'chart-column')[0]!.props.fill;
    const restFill = hostsByTestId(rendered, 'chart-column')[1]!.props.fill;
    const currentFill = hostsByTestId(rendered, 'chart-column-current')[0]!.props.fill;
    // The rest week's zero stub takes the trend tint, unlike a vanished week.
    expect(restFill).toEqual(currentFill);
    expect(restFill).not.toEqual(vanishedFill);

    const hits = hostsByTestId(rendered, 'chart-column-hit');
    const restHit = hits.find((node) => node.props.accessibilityLabel.includes('rest week'));
    expect(restHit).toBeDefined();
    const vanishedHit = hits.find((node) => !node.props.accessibilityLabel.includes('rest week'));
    expect(vanishedHit).toBeDefined();
  });

  /**
   * Story 33 — the current/incomplete period must be labeled
   * semantically, not only by its distinct fill color.
   */
  it('labels the current week semantically, both in the accessible name and the visible readout', () => {
    const series: SeriesPoint<{ isCurrent?: boolean }>[] = [
      { localDate: '2026-01-05', value: 3 },
      { localDate: '2026-01-12', value: 4, meta: { isCurrent: true } },
    ];
    const rendered = renderTree(<ColumnChart series={series} formatValue={(v) => `${v}`} label="Sessions" />);

    const hits = pressablesByTestId(rendered, 'chart-column-hit');
    expect(hits[1]!.props.accessibilityLabel).toContain('current week');
    expect(hits[0]!.props.accessibilityLabel).not.toContain('current week');

    act(() => hits[1]!.props.onPress());
    const readout = hostsByTestId(rendered, 'chart-current-label')[0];
    expect(readout).toBeDefined();
  });
});

describe('RangeSelector', () => {
  /* The superseded control filtered unavailable ranges out and rendered
     nothing at all below two options, so a user with a few days of data saw
     no time-range control and a reviewer concluded it had never been built.
     Every range is now always present; the ones the data cannot fill are
     dimmed and reported disabled. */
  it('still renders the control when only one range is usable', () => {
    const rendered = renderTree(
      <RangeSelector
        options={[
          { range: 'W', disabled: true },
          { range: 'ALL', disabled: false },
        ]}
        value="ALL"
        onChange={() => {}}
        label="Range"
      />,
    );
    expect(hostsByTestId(rendered, 'chart-range-selector')).toHaveLength(1);
    expect(hostsByTestId(rendered, 'chart-range-W')).toHaveLength(1);
  });

  it('reports an unfillable range as disabled rather than hiding it', () => {
    const rendered = renderTree(
      <RangeSelector
        options={[
          { range: 'W', disabled: false },
          { range: 'Y', disabled: true },
        ]}
        value="W"
        onChange={() => {}}
        label="Range"
      />,
    );
    const unavailable = hostsByTestId(rendered, 'chart-range-Y')[0]!;
    expect(unavailable.props.accessibilityState.disabled).toBe(true);
  });

  it('marks the active range as selected for assistive technology', () => {
    const rendered = renderTree(
      <RangeSelector
        options={[
          { range: 'M', disabled: false },
          { range: '3M', disabled: false },
          { range: 'ALL', disabled: false },
        ]}
        value="3M"
        onChange={() => {}}
        label="Range"
      />,
    );
    const active = hostsByTestId(rendered, 'chart-range-3M')[0]!;
    expect(active.props.accessibilityState.selected).toBe(true);
  });
});

/**
 * Story 48 — the native counterpart of the web scrub. There is no pointer
 * capture on native, so the equivalent is a PanResponder on the container
 * that claims the gesture only once it is clearly horizontal: a tap must
 * still reach the per-point Pressables (and with them VoiceOver), and a
 * vertical drag must still scroll the screen.
 */
describe('LineChart scrub', () => {
  const series = line([180, 181, 182, 183]);

  /* The gesture-resolution maths is shared with web through
     `nearestPointIndex`/`shouldClaimScrub` and is tested in @setframe/domain.
     What is worth asserting here is that this renderer actually wires a
     responder to the plot, since the alternative — a chart that only responds
     to discrete taps — looks identical in a snapshot. Whether the resulting
     drag *feels* right is a hardware question; see the story's notes on the
     simulator run, which no jsdom test can stand in for. */
  it('wires a pan responder to the plot surface', () => {
    const rendered = renderTree(
      <LineChart series={series} formatValue={(v) => `${v} lb`} label="Weight" />,
    );
    const surface = rendered.root.find(
      (node) => node.props?.testID === 'chart-scrub-surface' && typeof node.type === 'string',
    );

    expect(typeof surface.props.onMoveShouldSetResponder).toBe('function');
    expect(typeof surface.props.onResponderMove).toBe('function');
  });

  it('keeps per-point taps working alongside the responder', () => {
    const rendered = renderTree(
      <LineChart series={series} formatValue={(v) => `${v} lb`} label="Weight" />,
    );
    /* The responder claims only horizontal movement, so a tap must still
       reach the Pressable bands that carry the accessibility labels. */
    const pressables = pressablesByTestId(rendered, 'chart-point');
    expect(pressables).toHaveLength(4);

    tapAt(pressables, expectedX(2, 4));
    const readout = hostsByTestId(rendered, 'chart-readout')[0]!;
    const text = readout.findAll((node) => typeof node.type === 'string')
      .flatMap((node) => [node.props.children].flat(3))
      .filter((child) => typeof child === 'string')
      .join('');
    expect(text).toContain('182 lb');
  });
});
