import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { OverviewInsight } from '@setframe/domain';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ProgressInsights } from '../components/ProgressInsights';

function renderTree(element: React.ReactElement): ReactTestRenderer {
  let tree: ReactTestRenderer | null = null;
  act(() => {
    tree = create(<ThemeProvider>{element}</ThemeProvider>);
  });
  return tree!;
}

/** Concatenated text of every string child under a subtree. */
function textOf(rendered: ReactTestRenderer): string {
  return rendered.root
    .findAll((node) => typeof node.type === 'string')
    .flatMap((node) => React.Children.toArray(node.props?.children))
    .filter((child): child is string => typeof child === 'string')
    .join(' ');
}

function insight(patch: Partial<OverviewInsight> = {}): OverviewInsight {
  return {
    metric: 'training_frequency',
    label: 'Training',
    sentence: '2 sessions so far, compared with 3 last week.',
    insight: {
      metric: 'training_frequency',
      range: 'W',
      availability: 'ok',
      current: {
        start: '2026-08-24',
        end: '2026-08-25',
        value: 2,
        sampleCount: 2,
        elapsedDays: 2,
        periodDays: 7,
        isPartial: true,
      },
      previous: {
        start: '2026-08-17',
        end: '2026-08-23',
        value: 3,
        sampleCount: 3,
        elapsedDays: 7,
        periodDays: 7,
        isPartial: false,
      },
      change: { absolute: -1, percent: -33.3 },
      trend: { direction: 'down', slope: null, confidence: 'low' },
      comparisonBasis: 'full_period',
      dataQuality: ['partial_current_period'],
      focus: { metric: 'training_frequency', range: 'W' },
    },
    ...patch,
  } as OverviewInsight;
}

describe('ProgressInsights (mobile)', () => {
  it('shows the sentence the domain layer produced', () => {
    const rendered = renderTree(<ProgressInsights insights={[insight()]} />);
    expect(textOf(rendered)).toContain('2 sessions so far, compared with 3 last week.');
  });

  /**
   * The story's premise: an insight that cannot say anything useful should say
   * nothing, rather than render an empty card announcing it has no insight.
   */
  it('renders nothing at all when there are no insights', () => {
    const rendered = renderTree(<ProgressInsights insights={[]} />);
    expect(
      rendered.root.findAll((node) => node.props?.testID === 'progress-insights'),
    ).toHaveLength(0);
  });

  it('sends the reader to the supporting chart', () => {
    const onFocus = jest.fn();
    const rendered = renderTree(<ProgressInsights insights={[insight()]} onFocus={onFocus} />);

    const pressable = rendered.root.find(
      (node) =>
        node.props?.testID === 'progress-insight-training_frequency' &&
        typeof node.props?.onPress === 'function',
    );
    act(() => {
      pressable.props.onPress();
    });

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus.mock.calls[0][0].insight.focus).toEqual({
      metric: 'training_frequency',
      range: 'W',
    });
  });

  it('states a caveat when the comparison rests on few readings', () => {
    const sparse = insight({
      metric: 'body_weight',
      label: 'Body weight',
      sentence: 'Your 7-day average is 168.2 lb, 1.1 lb below the previous week.',
    });
    sparse.insight = { ...sparse.insight, dataQuality: ['sparse_previous_period'] };

    const rendered = renderTree(<ProgressInsights insights={[sparse]} />);
    expect(textOf(rendered)).toContain('treat the comparison loosely');
  });

  /**
   * Parity guard. Both platforms render `describeInsight`'s output verbatim,
   * so neither may quietly reword, truncate or decorate it.
   */
  it('renders the sentence verbatim, adding no words of its own', () => {
    const item = insight();
    const rendered = renderTree(<ProgressInsights insights={[item]} />);
    expect(textOf(rendered)).toContain(item.sentence);
  });
});
