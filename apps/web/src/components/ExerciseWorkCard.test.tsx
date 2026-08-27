import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { getTheme } from '../theme/getTheme';
import { ExerciseWorkCard } from './ExerciseWorkCard';

/**
 * Story 42.2 — the disclosure contract.
 *
 * These pin the rules that three rounds of styling kept breaking: only the
 * dedicated control toggles detail, and nothing nested inside the card does.
 */

function renderCard(overrides: Partial<Parameters<typeof ExerciseWorkCard>[0]> = {}) {
  function Harness() {
    const [expanded, setExpanded] = useState(false);
    return (
      <ThemeProvider theme={getTheme('light')}>
        <ExerciseWorkCard
          id="log-1"
          name="Barbell Bench Press"
          planLabel="Planned: 3 × 8"
          progressLabel="0 of 3 sets complete"
          expanded={expanded}
          onExpandedChange={setExpanded}
          quickLog={<input aria-label="Quick log: Weight" />}
          actions={<button type="button">Barbell Bench Press actions</button>}
          {...overrides}
        >
          <input aria-label="Set 1 weight" />
        </ExerciseWorkCard>
      </ThemeProvider>
    );
  }
  return render(<Harness />);
}

const trigger = () => screen.getByRole('button', { name: /^(Expand|Collapse) Barbell Bench Press$/ });

describe('ExerciseWorkCard disclosure', () => {
  it('always offers a dedicated control, collapsed or expanded', async () => {
    const user = userEvent.setup();
    renderCard();

    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    /* Still present after expanding — "can this be opened?" must never depend
       on whether it currently is. */
    expect(trigger()).toBeInTheDocument();
  });

  it('does not toggle when a quick-log input takes focus', async () => {
    const user = userEvent.setup();
    renderCard();

    /* The exact defect behind "Claude is doing too much here": the card used
       to activate the exercise on any focus inside it, so tabbing into the
       fast path opened the full editor. */
    await user.click(screen.getByLabelText('Quick log: Weight'));
    await user.keyboard('185');

    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Quick log: Weight')).toHaveValue('185');
  });

  it('does not toggle when a contextual action is used', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: 'Barbell Bench Press actions' }));
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the fast path usable while details stay collapsed', () => {
    renderCard();
    /* Quick log lives outside the panel, so it is reachable without opening
       anything. That is the entire point of the card. */
    expect(screen.getByLabelText('Quick log: Weight')).toBeVisible();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('is controlled by the caller, so a group can close the previous card', async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(
      <ThemeProvider theme={getTheme('light')}>
        <ExerciseWorkCard
          id="log-1"
          name="Barbell Bench Press"
          expanded={false}
          onExpandedChange={onExpandedChange}
        >
          <input aria-label="Set 1 weight" />
        </ExerciseWorkCard>
      </ThemeProvider>,
    );

    await user.click(trigger());
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    // Refused to self-expand: the parent decides, which is what lets opening
    // one exercise collapse another.
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('reaches the detail surface by keyboard alone', async () => {
    const user = userEvent.setup();
    renderCard();

    trigger().focus();
    await user.keyboard('{Enter}');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Set 1 weight')).toBeVisible();
  });

  it('stays reopenable when the exercise is already complete', async () => {
    const user = userEvent.setup();
    renderCard({ tone: 'complete', progressLabel: '3 sets logged' });

    await user.click(trigger());
    /* A completed exercise inside an active workout is still editable — the
       detail panel is a neutral surface, not a read-only summary. */
    expect(screen.getByLabelText('Set 1 weight')).toBeVisible();
  });
});
