/**
 * Story 47 spike — render-level verification of the native scrub prototype.
 *
 * This is deliberately scoped. It proves the native prototype *renders the
 * shared domain geometry and updates a stationary readout on selection*, on
 * dependencies the app already ships. It does NOT prove native touch feel —
 * no device or simulator is available in this environment, and gesture
 * quality is not observable from react-test-renderer. ADR 0008 records that
 * limitation explicitly; Story 48 must validate scrub on hardware before
 * Story 49 inherits the interaction grammar.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { buildLineChart, type SeriesPoint } from '@setframe/domain';
import { ScrubLineChart } from '../spikes/047/ScrubLineChart';

function series(): SeriesPoint[] {
  // 60 points with two genuine gaps, so null handling is exercised.
  const out: SeriesPoint[] = [];
  for (let i = 0; i < 60; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    const localDate = `2026-0${i < 31 ? '7' : '8'}-${i < 31 ? day : String(i - 30).padStart(2, '0')}`;
    const value = i === 10 || i === 25 ? null : 170 - i * 0.03 + (i % 5) * 0.4;
    out.push({ localDate, value: value == null ? null : Number(value.toFixed(1)) });
  }
  return out;
}

let tree: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
});

/**
 * `GestureDetector` (gesture-handler v3) throws without a
 * `GestureHandlerRootView` ancestor. The real app root already mounts one
 * (`apps/mobile/app/_layout.tsx`), so production needs no setup work to
 * adopt scrub — the wrapper here just reproduces that ancestor in isolation.
 */
function render(props: Partial<React.ComponentProps<typeof ScrubLineChart>> = {}) {
  act(() => {
    tree = create(
      <GestureHandlerRootView>
        <ScrubLineChart series={series()} {...props} />
      </GestureHandlerRootView>,
    );
  });
  return tree!;
}

function textOf(rendered: ReactTestRenderer, testID: string): string {
  const node = rendered.root.findAll((n) => n.props?.testID === testID && typeof n.type !== 'string')[0];
  return ([] as unknown[]).concat(node?.props?.children).filter((c) => typeof c === 'string').join('');
}

describe('Story 47 spike — native scrub prototype', () => {
  it('renders marks from the shared domain geometry, skipping gaps', () => {
    const rendered = render();
    const expected = buildLineChart(series(), {
      layout: { width: 340, height: 200, padding: { top: 12, right: 12, bottom: 24, left: 44 } },
      zeroBased: false,
      minimumSpan: 4,
      formatValue: (v) => `${Math.round(v)}`,
    });

    // 60 entries, 2 of them null -> 58 plotted marks.
    expect(expected.points).toHaveLength(58);
    // findAll matches both the composite <Circle> and the host element it
    // renders, so dedupe by coordinate rather than counting raw nodes.
    const marks = rendered.root.findAll((n) => n.props?.r === 2.5);
    const coords = new Set(marks.map((n) => `${n.props.cx},${n.props.cy}`));
    expect(coords.size).toBe(expected.points.length);
    // And they sit exactly where the shared geometry says.
    expect(coords.has(`${expected.points[0]!.x},${expected.points[0]!.y}`)).toBe(true);
    expect(
      coords.has(`${expected.points[expected.points.length - 1]!.x},${expected.points[expected.points.length - 1]!.y}`),
    ).toBe(true);
  });

  it('defaults the stationary readout to the latest measurement', () => {
    const rendered = render();
    const expected = buildLineChart(series(), {
      layout: { width: 340, height: 200, padding: { top: 12, right: 12, bottom: 24, left: 44 } },
      zeroBased: false,
      minimumSpan: 4,
      formatValue: (v) => `${Math.round(v)}`,
    });
    const last = expected.points[expected.points.length - 1]!;
    expect(textOf(rendered, 'scrub-value')).toBe(`${last.value.toFixed(1)} lb`);
  });

  it('shows no selection marks until something is selected', () => {
    const rendered = render();
    expect(rendered.root.findAll((n) => n.props?.testID === 'scrub-selected-dot')).toHaveLength(0);
    expect(rendered.root.findAll((n) => n.props?.testID === 'scrub-crosshair')).toHaveLength(0);
  });

  it('mounts a gesture surface over the plot', () => {
    const rendered = render();
    expect(rendered.root.findAll((n) => n.props?.testID === 'scrub-surface').length).toBeGreaterThan(0);
  });

  it('renders an empty readout rather than crashing on an all-null series', () => {
    const rendered = render({ series: [{ localDate: '2026-08-01', value: null }] });
    expect(textOf(rendered, 'scrub-value')).toBe('—');
    expect(textOf(rendered, 'scrub-date')).toBe('no data');
  });
});
