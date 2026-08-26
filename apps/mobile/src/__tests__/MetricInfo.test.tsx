import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../theme/ThemeProvider';
import { PopoverHost } from '../components/PopoverHost';
import { MetricInfo } from '../components/MetricInfo';

let tree: ReactTestRenderer | null = null;

/**
 * Supplies the layout `react-test-renderer` has no engine for. jest-expo does
 * not actually invoke `createNodeMock` for RN's View, so this is belt and
 * braces rather than load-bearing — `MetricInfo` deliberately opens before
 * measuring, precisely so a measurement that never arrives cannot swallow the
 * tap. That is the property the "opens without any measurement" test pins.
 */
const nodeMock = () => ({
  measureInWindow: (callback: (x: number, y: number, w: number, h: number) => void) =>
    callback(20, 100, 22, 22),
});

function renderTree(element: React.ReactElement): ReactTestRenderer {
  act(() => {
    tree = create(<ThemeProvider><PopoverHost>{element}</PopoverHost></ThemeProvider>, { createNodeMock: nodeMock });
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


/**
 * The two things the bottom-sheet implementation got wrong, per direct user
 * report: it covered the whole app, and switching help took two taps.
 */
describe('MetricInfo is an anchored popover, not a modal', () => {
  const a = { label: 'Alpha', explanation: 'Explanation for alpha.' };
  const b = { label: 'Beta', explanation: 'Explanation for beta.' };

  function triggers(rendered: ReactTestRenderer) {
    return rendered.root.findAll(
      (n) => n.props?.testID === 'metric-info-trigger' && typeof n.props?.onPress === 'function',
    );
  }

  it('renders no modal and no full-screen backdrop', () => {
    const rendered = renderTree(<MetricInfo {...a} />);
    press(rendered, 'metric-info-trigger');
    expect(hostsByTestId(rendered, 'metric-info-panel')).toHaveLength(1);
    // A Modal would cover the app; that is the reported complaint.
    expect(rendered.root.findAll((n) => n.props?.testID === 'sheet-backdrop')).toHaveLength(0);
    expect(
      rendered.root.findAll(
        (n) => typeof n.type !== 'string' && (n.type as { displayName?: string })?.displayName === 'Modal',
      ),
    ).toHaveLength(0);
  });

  it('leaves the overlay non-blocking so other controls stay tappable', () => {
    const rendered = renderTree(<MetricInfo {...a} />);
    press(rendered, 'metric-info-trigger');
    const overlay = rendered.root.findAll((n) => n.props?.testID === 'popover-overlay')[0]!;
    /* box-none is the whole mechanism: the container never claims a touch, so
       trigger B is still hit-testable while panel A is open. */
    expect(overlay.props.pointerEvents).toBe('box-none');
  });

  it('switches help in a single tap', () => {
    const rendered = renderTree(
      <>
        <MetricInfo {...a} />
        <MetricInfo {...b} />
      </>,
    );
    act(() => triggers(rendered)[0]!.props.onPress());
    expect(allText(rendered)).toContain('Explanation for alpha.');

    // One tap on the second trigger — not two.
    act(() => triggers(rendered)[1]!.props.onPress());
    expect(allText(rendered)).not.toContain('Explanation for alpha.');
    expect(allText(rendered)).toContain('Explanation for beta.');
  });

  it('opens even when no measurement ever arrives', () => {
    /* Gating the open on measureInWindow's callback made the control look
       broken rather than degraded when the callback never fired — which is
       exactly what jest-expo does, and what a detached node does on device. */
    const rendered = renderTree(<MetricInfo {...a} />);
    press(rendered, 'metric-info-trigger');
    expect(hostsByTestId(rendered, 'metric-info-panel')).toHaveLength(1);
  });

  it('does not close itself in the render that opened it', () => {
    /* Regression: the unmount cleanup depended on the context value, whose
       identity changes on every host state update, so opening scheduled the
       cleanup that closed it again in the same tick and the panel never
       appeared at all. */
    const rendered = renderTree(<MetricInfo {...a} />);
    press(rendered, 'metric-info-trigger');
    const trigger = triggers(rendered)[0]!;
    expect(trigger.props.accessibilityState.expanded).toBe(true);
  });

  it('draws a caret so the panel is visibly tied to its trigger', () => {
    const rendered = renderTree(<MetricInfo {...a} />);
    press(rendered, 'metric-info-trigger');
    expect(hostsByTestId(rendered, 'metric-info-caret')).toHaveLength(1);
  });

  it('closes on a touch outside both the panel and its trigger', () => {
    const rendered = renderTree(<MetricInfo {...a} />);
    press(rendered, 'metric-info-trigger');
    expect(allText(rendered)).toContain('Explanation for alpha.');

    const root = rendered.root.findAll(
      (n) => typeof n.props?.onStartShouldSetResponderCapture === 'function',
    )[0]!;
    let claimed: boolean | undefined;
    act(() => {
      claimed = root.props.onStartShouldSetResponderCapture({
        nativeEvent: { pageX: 5, pageY: 5 },
      });
    });
    expect(allText(rendered)).not.toContain('Explanation for alpha.');
    // Never claims the touch, so the thing actually pressed still receives it.
    expect(claimed).toBe(false);
  });
});
