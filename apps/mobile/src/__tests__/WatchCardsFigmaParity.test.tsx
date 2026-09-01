import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { effortChart, heartRateChart, heartRateZoneColors } from '@setframe/design-tokens';
import { zoneBands } from '@setframe/domain';
import { ThemeProvider } from '../theme/ThemeProvider';
import { WatchSummaryCard } from '../components/watch/WatchSummaryCard';
import { HeartRateCard } from '../components/watch/HeartRateCard';
import { EffortByExerciseCard } from '../components/watch/EffortByExerciseCard';

/**
 * Copy and geometry parity with Figma `265:2` — the assembled
 * completed-workout screen.
 *
 * The strings and numbers below were read out of the Figma nodes, not
 * retyped, so this fails if either side drifts. Copy and geometry are what
 * can be honestly checked here: nothing renders these on a device, and jest
 * does no layout.
 */
let tree: ReactTestRenderer | null = null;

function render(node: React.ReactElement) {
  act(() => {
    tree = create(<ThemeProvider>{node}</ThemeProvider>);
  });
  return tree!;
}
function allText(rendered: ReactTestRenderer): string {
  const parts: string[] = [];
  rendered.root.findAll((n) => {
    if (typeof n.type !== 'string') return false;
    ([] as unknown[]).concat(n.props?.children).forEach((c) => {
      if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    });
    return false;
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
function byTestId(rendered: ReactTestRenderer, id: string) {
  return rendered.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
}

afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
});

const workout = {
  id: 'w1',
  sessionId: 's1',
  externalId: 'hk-1',
  activityType: 'other',
  appleActivityType: 50,
  title: 'Traditional Strength Training',
  startedAt: '2026-09-01T17:32:00.000Z',
  endedAt: '2026-09-01T18:36:00.000Z',
  durationSeconds: 3840,
  activeEnergyKcal: 612,
  totalEnergyKcal: 842,
  avgHeartRateBpm: 142,
  peakHeartRateBpm: 171,
  minHeartRateBpm: 96,
  distanceValue: null,
  distanceUnit: null,
  deviceName: 'Series 9',
  createdAt: '2026-09-01T18:40:00.000Z',
  updatedAt: '2026-09-01T18:40:00.000Z',
};

describe('WatchSummaryCard · Figma 265:2 › WatchSummary', () => {
  it('renders the four tiles the design specifies, in order', () => {
    const text = allText(render(<WatchSummaryCard workouts={[workout]} />));
    for (const s of ['From your Watch', 'Series 9', '612', 'Active kcal', '842', 'Total kcal', '142', 'Avg HR', '171', 'Peak HR']) {
      expect(text).toContain(s);
    }
    const order = ['Active kcal', 'Total kcal', 'Avg HR', 'Peak HR'].map((l) => text.indexOf(l));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('names the workout and its duration underneath', () => {
    expect(allText(render(<WatchSummaryCard workouts={[workout]} />))).toContain(
      'Traditional Strength Training · 1h 04m, attached to this session.',
    );
  });

  it('weights the average heart rate by duration, not by workout', () => {
    /* A four-minute walk and a sixty-four-minute lift are not two equal
       opinions about the session's heart rate. */
    const walk = { ...workout, id: 'w2', externalId: 'hk-2', durationSeconds: 240, avgHeartRateBpm: 90 };
    const text = allText(render(<WatchSummaryCard workouts={[workout, walk]} />));
    // Weighted: (142×3840 + 90×240) / 4080 ≈ 139. A plain mean would say 116.
    expect(text).toContain('139');
    expect(text).not.toContain('116');
  });

  it('renders nothing when no workout is attached', () => {
    expect(render(<WatchSummaryCard workouts={[]} />).toJSON()).toBeNull();
  });
});

describe('HeartRateCard · Figma 265:2 › HeartRateCard', () => {
  const series = {
    offsets: Array.from({ length: 240 }, (_, i) => i * 5),
    values: Array.from({ length: 240 }, (_, i) => 110 + Math.round(40 * Math.abs(Math.sin(i / 6)))),
  };
  const model = { restingBpm: 54, maxBpm: 186 };
  const props = {
    series,
    model,
    startedAt: '2026-09-01T17:32:00.000Z',
    endedAt: '2026-09-01T18:36:00.000Z',
  };

  it('carries the headings and footnote the design specifies', () => {
    const text = allText(render(<HeartRateCard {...props} />));
    expect(text).toContain('Heart rate');
    expect(text).toContain('TIME IN ZONE');
    expect(text).toContain('Zones from your heart-rate reserve');
    expect(text).toContain('resting 54');
    expect(text).toContain('max 186');
  });

  it('lists zones from 5 down to 1, as the design does', () => {
    const text = allText(render(<HeartRateCard {...props} />));
    const order = ['Zone 5', 'Zone 4', 'Zone 3', 'Zone 2', 'Zone 1'].map((z) => text.indexOf(z));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('labels the lowest zone as open-ended and the highest as unbounded', () => {
    // Figma: "< 124 bpm" and "171+ bpm" — neither is a two-ended range.
    const text = allText(render(<HeartRateCard {...props} />));
    expect(text).toMatch(/< \d+ bpm/);
    expect(text).toMatch(/\d+\+ bpm/);
  });

  it('colours bars from the sequential ramp, never a rainbow', () => {
    /* Five ordered hues cannot be told apart on a light surface — 192
       candidates were tested and none passed. The ramp is one hue, and the
       zone is also the bar's height, so colour is redundant by design. */
    const rendered = render(<HeartRateCard {...props} />);
    const bars = rendered.root.findAll(
      (n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('heart-rate-bar-') && typeof n.type === 'string',
    );
    expect(bars.length).toBeGreaterThan(0);
    const ramp = Object.values(heartRateZoneColors);
    for (const bar of bars) {
      const flat = JSON.stringify(bar.props.style);
      expect(ramp.some((hex) => flat.toLowerCase().includes(hex.toLowerCase()))).toBe(true);
    }
  });

  it('shows the summary at rest and the moment while scrubbing', () => {
    const resting = allText(render(<HeartRateCard {...props} />));
    expect(resting).toMatch(/\d+ avg · \d+ peak/);
    act(() => tree?.unmount());
    const scrubbed = allText(render(<HeartRateCard {...props} selectedIndex={4} />));
    // Stationary readout: it replaces the summary in place rather than
    // floating over the bars.
    expect(scrubbed).toMatch(/\d+:\d+ ?(AM|PM)? · \d+ bpm · Zone \d/);
  });

  it('dims every bar but the scrubbed one', () => {
    const rendered = render(<HeartRateCard {...props} selectedIndex={3} />);
    const opacity = (i: number) =>
      JSON.stringify(byTestId(rendered, `heart-rate-bar-${i}`)[0]!.props.style);
    expect(opacity(3)).toContain('"opacity":1');
    expect(opacity(4)).toContain('0.32');
  });

  it('uses the plot geometry from the design tokens', () => {
    const rendered = render(<HeartRateCard {...props} />);
    const plot = JSON.stringify(byTestId(rendered, 'heart-rate-plot')[0]!.props.style);
    expect(plot).toContain(`"height":${heartRateChart.plotHeight}`);
    expect(plot).toContain(`"padding":${heartRateChart.plotPadding}`);
    expect(plot).toContain(`"gap":${heartRateChart.barGap}`);
  });

  it('renders nothing without a series', () => {
    expect(render(<HeartRateCard {...props} series={{ offsets: [], values: [] }} />).toJSON()).toBeNull();
  });

  it('agrees with the domain about where the bands fall', () => {
    // The card must not compute its own zones alongside the domain's.
    const bands = zoneBands(model);
    const text = allText(render(<HeartRateCard {...props} />));
    expect(text).toContain(`${bands.find((b) => b.zone === 5)!.fromBpm}+ bpm`);
  });
});

describe('EffortByExerciseCard · Figma 265:2 › EffortByExerciseCard', () => {
  const efforts = [
    { exerciseName: 'Bench Press', avgBpm: 158, peakBpm: 174, setCount: 3 },
    { exerciseName: 'Incline DB Press', avgBpm: 149, peakBpm: 163, setCount: 3 },
    { exerciseName: 'Triceps Pushdown', avgBpm: 116, peakBpm: 127, setCount: 3 },
  ];

  it('carries the design heading and caption', () => {
    const text = allText(render(<EffortByExerciseCard efforts={efforts} />));
    expect(text).toContain('Effort by exercise');
    expect(text).toContain('Average heart rate while you were working each lift.');
    expect(text).toContain('Bar is average, tick is peak, both from 0 bpm so the lengths compare.');
  });

  it('states the spread between hardest and easiest', () => {
    // Figma: "Bench cost 42 bpm more than pushdowns".
    expect(allText(render(<EffortByExerciseCard efforts={efforts} />))).toContain('42 bpm more');
  });

  it('sizes each bar from its own number, on one zero-based scale', () => {
    /* The bars once used eyeballed fractions that did not match the numbers
       printed beside them — a chart contradicting its own labels. */
    const rendered = render(<EffortByExerciseCard efforts={efforts} />);
    /* Selected by testID rather than by shape: the bar's style is an array,
       so the first node with a plain `style.width` is the gap spacer. */
    const widths = efforts.map((e) => {
      const bar = byTestId(rendered, `effort-bar-${e.exerciseName}`)[0]!;
      const flat = ([] as Record<string, unknown>[]).concat(bar.props.style);
      return flat.reduce<number | undefined>(
        (found, layer) => (typeof layer?.width === 'number' ? (layer.width as number) : found),
        undefined,
      )!;
    });
    const scale = Math.max(...efforts.map((e) => e.peakBpm));
    efforts.forEach((e, i) => {
      expect(widths[i]).toBeCloseTo((e.avgBpm / scale) * effortChart.maxBarWidth, 1);
    });
  });

  it('renders nothing when no exercise could be aligned', () => {
    expect(render(<EffortByExerciseCard efforts={[]} />).toJSON()).toBeNull();
  });
});
