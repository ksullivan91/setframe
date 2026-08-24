import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it } from 'vitest';
import { getTheme } from '../theme/getTheme';
import { Input } from './Input';

function renderInput(props: Partial<ComponentProps<typeof Input>> = {}) {
  return render(
    <ThemeProvider theme={getTheme('light')}>
      <Input label="Weight" value="" onChange={() => {}} {...props} />
    </ThemeProvider>,
  );
}

/**
 * Story 22 — an inline "lb" suffix sharing the bordered input box with the
 * value could be pushed outside the field at narrow widths inside a
 * two-column form. Unit now folds into the visible/accessible label
 * instead of a separate in-field element.
 */
describe('Input unit label', () => {
  it('folds the unit into the visible label when both are provided', () => {
    renderInput({ unit: 'lb' });
    expect(screen.getByLabelText('Weight (lb)')).toBeInTheDocument();
  });

  it('renders a plain label when no unit is given', () => {
    renderInput();
    expect(screen.getByLabelText('Weight')).toBeInTheDocument();
  });

  it('does not render a separate in-field unit element', () => {
    const { container } = renderInput({ unit: 'lb' });
    // The old implementation rendered a standalone <span>lb</span> inside
    // the field row, in addition to the label — assert only one "lb"
    // occurrence exists (inside the label), not two.
    expect(container.textContent!.match(/lb/g)?.length ?? 0).toBe(1);
  });

  it('keeps the input value editable independent of the unit', async () => {
    renderInput({ unit: 'lb', value: '185' });
    expect(screen.getByLabelText('Weight (lb)')).toHaveValue('185');
  });
});

/**
 * Story 28 — a shared text/numeric input rendering below a 16px effective
 * font size triggers iOS Safari's auto-zoom on focus, and the page stays
 * visibly zoomed after blur. The mobile-first base rule must stay at 16px
 * (the desktop-width override is real CSS but isn't reliably observable
 * through jsdom's computed styles, so it's not asserted here).
 */
describe('Input mobile-safe font size', () => {
  it('renders at least a 16px font size by default', () => {
    renderInput();
    expect(getComputedStyle(screen.getByLabelText('Weight')).fontSize).toBe('16px');
  });
});
