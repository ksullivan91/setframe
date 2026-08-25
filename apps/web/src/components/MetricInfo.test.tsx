import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it } from 'vitest';
import { getTheme } from '../theme/getTheme';
import { MetricInfo } from './MetricInfo';

function renderInfo(props: Partial<React.ComponentProps<typeof MetricInfo>> = {}) {
  return render(
    <ThemeProvider theme={getTheme('light')}>
      <MetricInfo
        label="Estimated 1RM"
        explanation="An estimate of the heaviest weight you could lift for a single rep."
        calculation="Epley formula from your best working set."
        limitation="It is an estimate, not a tested max."
        {...props}
      />
    </ThemeProvider>,
  );
}

describe('MetricInfo disclosure', () => {
  it('keeps the panel closed until the trigger is clicked', () => {
    renderInfo();
    expect(screen.queryByTestId('metric-info-panel')).not.toBeInTheDocument();
  });

  it('reveals the explanation, calculation and limitation on click', () => {
    renderInfo();
    fireEvent.click(screen.getByTestId('metric-info-trigger'));
    const panel = screen.getByTestId('metric-info-panel');
    expect(panel).toHaveTextContent('An estimate of the heaviest weight');
    expect(panel).toHaveTextContent('Epley formula');
    expect(panel).toHaveTextContent('not a tested max');
  });

  it('toggles the panel closed again on a second click', () => {
    renderInfo();
    fireEvent.click(screen.getByTestId('metric-info-trigger'));
    fireEvent.click(screen.getByTestId('metric-info-trigger'));
    expect(screen.queryByTestId('metric-info-panel')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    renderInfo();
    fireEvent.click(screen.getByTestId('metric-info-trigger'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('metric-info-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('metric-info-trigger')).toHaveFocus();
  });

  it('omits the limitation line when a metric has no caveat', () => {
    renderInfo({ limitation: null });
    fireEvent.click(screen.getByTestId('metric-info-trigger'));
    expect(screen.getByTestId('metric-info-panel')).not.toHaveTextContent('not a tested max');
  });

  /**
   * Story 30 — only one metric tooltip should be open at a time. Two
   * independent MetricInfo instances share a module-level singleton so
   * opening the second one always closes the first, regardless of how far
   * apart they are in the tree.
   */
  it('closes a previously open panel when a second MetricInfo opens', () => {
    render(
      <ThemeProvider theme={getTheme('light')}>
        <MetricInfo label="Sessions per week" explanation="Weekly training frequency." />
        <MetricInfo label="Weekly volume" explanation="Total load lifted this week." />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByLabelText('What does Sessions per week mean?'));
    expect(screen.getByTestId('metric-info-panel')).toHaveTextContent('Weekly training frequency.');

    fireEvent.click(screen.getByLabelText('What does Weekly volume mean?'));
    const panels = screen.getAllByTestId('metric-info-panel');
    expect(panels).toHaveLength(1);
    expect(panels[0]).toHaveTextContent('Total load lifted this week.');
  });
});

/**
 * Story 46 — the regressions Story 30 introduced while fixing right-edge
 * overflow, each pinned so the same trade cannot be made again.
 *
 * Note these use `userEvent`, not `fireEvent.click`. The two-tap bug was a
 * full-viewport backdrop swallowing the first press on another trigger, and
 * `fireEvent.click` dispatches only a `click` — no `pointerdown`, and no hit
 * testing — so the old suite's A → B test passed throughout the entire time
 * the bug was live. Only a realistic pointer sequence can catch it.
 */
describe('MetricInfo anchoring and switching', () => {
  function renderPair() {
    return render(
      <ThemeProvider theme={getTheme('light')}>
        <MetricInfo label="Sessions per week" explanation="Weekly training frequency." />
        <MetricInfo label="Weekly volume" explanation="Total load lifted this week." />
      </ThemeProvider>,
    );
  }

  it('switches from one help panel to another in a single press', async () => {
    const user = userEvent.setup();
    renderPair();

    await user.click(screen.getByLabelText('What does Sessions per week mean?'));
    expect(screen.getByTestId('metric-info-panel')).toHaveTextContent('Weekly training frequency.');

    // One press, not two. Previously the first press landed on the backdrop
    // covering the page, closing A and leaving B shut.
    await user.click(screen.getByLabelText('What does Weekly volume mean?'));

    const panels = screen.getAllByTestId('metric-info-panel');
    expect(panels).toHaveLength(1);
    expect(panels[0]).toHaveTextContent('Total load lifted this week.');
  });

  it('adds only the panel to the page, with no sibling overlay, at mobile width', async () => {
    // The backdrop this guards against only rendered below the 768px tablet
    // breakpoint, so the viewport has to be narrowed or the assertion is
    // vacuous — jsdom defaults to 1024px wide.
    const original = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true });
    try {
      const user = userEvent.setup();
      const { container } = renderPair();
      await user.click(screen.getByLabelText('What does Sessions per week mean?'));

      const panel = screen.getByTestId('metric-info-panel');
      // Everything MetricInfo puts outside its own inline wrapper must be
      // the panel and nothing else. A dismissal backdrop would show up here
      // as an extra node; dismissal is handled by document listeners
      // instead, which is what keeps another trigger pressable while this
      // panel is open. (jsdom does no hit testing, so the *absence of an
      // overlay* is the strongest claim a unit test can make — the one-tap
      // behaviour itself is verified in a real browser; see this story's
      // Playwright evidence.)
      const outside = Array.from(document.body.children).filter((node) => node !== container);
      expect(outside).toHaveLength(1);
      expect(outside[0]).toContainElement(panel);
      expect(outside[0]!.querySelectorAll('*')).toHaveLength(panel.querySelectorAll('*').length + 1);
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: original, configurable: true, writable: true });
    }
  });

  /**
   * Deliberately not asserted here: that the panel *lands* beside its
   * trigger. jsdom reports every rect as zero, and `placement` starts at
   * the requested `bottom-start` before any measurement, so a
   * `data-placement` assertion passes whether positioning works or not —
   * it would be a test that cannot fail. Real placement (flip at the
   * bottom edge, shift at the left/right edges, a constant offset held
   * through scroll) is verified in Chromium across 320/390/768/1280px;
   * see this story's Playwright evidence.
   */
  it('positions from a resolved placement rather than a fixed corner', async () => {
    const user = userEvent.setup();
    renderInfo();
    await user.click(screen.getByTestId('metric-info-trigger'));

    const panel = screen.getByTestId('metric-info-panel');
    // Floating UI drives placement through inline styles it owns; the panel
    // must not carry a hard-coded position of its own, which is what the
    // centred-card implementation did.
    expect(panel.style.position).toBe('absolute');
    expect(screen.getByTestId('metric-info-caret')).toBeInTheDocument();
  });

  it('portals the panel out of the trigger wrapper so it cannot widen the layout', async () => {
    const user = userEvent.setup();
    const { container } = renderInfo();
    await user.click(screen.getByTestId('metric-info-trigger'));

    const panel = screen.getByTestId('metric-info-panel');
    // Rendered somewhere in the document, but not inside the inline wrapper
    // that holds the trigger — that containment is what previously let a
    // `position: fixed` panel re-anchor to any transformed ancestor.
    expect(document.body).toContainElement(panel);
    expect(container).not.toContainElement(panel);
  });

  it('points a caret at the trigger so the association survives shifting', async () => {
    const user = userEvent.setup();
    renderInfo();
    await user.click(screen.getByTestId('metric-info-trigger'));
    expect(screen.getByTestId('metric-info-caret')).toBeInTheDocument();
  });

  it('describes the panel as a labelled group, not ancillary prose', async () => {
    const user = userEvent.setup();
    renderInfo();
    await user.click(screen.getByTestId('metric-info-trigger'));

    const panel = screen.getByTestId('metric-info-panel');
    expect(panel).not.toHaveAttribute('role', 'note');
    expect(panel).toHaveAccessibleName('Estimated 1RM');
    expect(screen.getByTestId('metric-info-trigger')).toHaveAttribute('aria-controls', panel.id);
  });

  it('closes on an outside press', async () => {
    const user = userEvent.setup();
    renderInfo();
    await user.click(screen.getByTestId('metric-info-trigger'));
    expect(screen.getByTestId('metric-info-panel')).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByTestId('metric-info-panel')).not.toBeInTheDocument();
  });
});
