import { render, screen, fireEvent } from '@testing-library/react';
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
