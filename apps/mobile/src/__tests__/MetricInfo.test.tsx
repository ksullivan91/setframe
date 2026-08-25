import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../theme/ThemeProvider';
import { MetricInfo } from '../components/MetricInfo';

let tree: ReactTestRenderer | null = null;

function renderTree(element: React.ReactElement): ReactTestRenderer {
  act(() => {
    tree = create(<ThemeProvider>{element}</ThemeProvider>);
  });
  return tree!;
}

function hostsByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.type === 'string',
  );
}

function press(rendered: ReactTestRenderer, testID: string) {
  const node = rendered.root.findAll(
    (n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
  )[0]!;
  act(() => {
    node.props.onPress();
  });
}

function allText(rendered: ReactTestRenderer): string {
  return rendered.root
    .findAll((n) => typeof n.type === 'string')
    .flatMap((n) => ([] as unknown[]).concat(n.props.children))
    .filter((child): child is string => typeof child === 'string')
    .join(' ');
}

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
});

describe('MetricInfo disclosure', () => {
  const props = {
    label: 'Estimated 1RM',
    explanation: 'An estimate of the heaviest weight you could lift for a single rep.',
    calculation: 'Epley formula from your best working set.',
    limitation: 'It is an estimate, not a tested max.',
  };

  it('keeps the panel closed until the trigger is pressed', () => {
    const rendered = renderTree(<MetricInfo {...props} />);
    expect(hostsByTestId(rendered, 'metric-info-panel')).toHaveLength(0);
  });

  it('reveals the explanation, calculation and limitation on press', () => {
    const rendered = renderTree(<MetricInfo {...props} />);
    press(rendered, 'metric-info-trigger');
    expect(hostsByTestId(rendered, 'metric-info-panel')).toHaveLength(1);
    const text = allText(rendered);
    expect(text).toContain('An estimate of the heaviest weight');
    expect(text).toContain('Epley formula');
    expect(text).toContain('not a tested max');
  });

  it('toggles the panel closed again on a second press', () => {
    const rendered = renderTree(<MetricInfo {...props} />);
    press(rendered, 'metric-info-trigger');
    press(rendered, 'metric-info-trigger');
    expect(hostsByTestId(rendered, 'metric-info-panel')).toHaveLength(0);
  });

  it('announces its expanded state and carries an accessible name', () => {
    const rendered = renderTree(<MetricInfo {...props} />);
    const trigger = hostsByTestId(rendered, 'metric-info-trigger')[0]!;
    expect(trigger.props.accessible).toBe(true);
    expect(trigger.props.accessibilityRole).toBe('button');
    expect(trigger.props.accessibilityLabel).toBe('What does Estimated 1RM mean?');
    expect(trigger.props.accessibilityState.expanded).toBe(false);
  });

  it('omits the limitation line when a metric has no caveat', () => {
    const rendered = renderTree(<MetricInfo {...props} limitation={null} />);
    press(rendered, 'metric-info-trigger');
    expect(allText(rendered)).not.toContain('not a tested max');
  });

  /**
   * Story 30 — only one metric tooltip should be open at a time, across
   * every MetricInfo instance on screen.
   */
  it('closes a previously open panel when a second MetricInfo opens', () => {
    const rendered = renderTree(
      <>
        <MetricInfo label="Sessions per week" explanation="Weekly training frequency." />
        <MetricInfo label="Weekly volume" explanation="Total load lifted this week." />
      </>,
    );

    const triggers = rendered.root.findAll(
      (n) => n.props?.testID === 'metric-info-trigger' && typeof n.props?.onPress === 'function',
    );
    act(() => triggers[0]!.props.onPress());
    expect(allText(rendered)).toContain('Weekly training frequency.');

    act(() => triggers[1]!.props.onPress());
    expect(allText(rendered)).not.toContain('Weekly training frequency.');
    expect(allText(rendered)).toContain('Total load lifted this week.');
  });
});
