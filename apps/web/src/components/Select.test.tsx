import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { getTheme } from '../theme/getTheme';
import { Select } from './Select';

function renderSelect() {
  return render(
    <ThemeProvider theme={getTheme('light')}>
      <Select label="Unit" value="lb" options={[{ value: 'lb', label: 'lb' }, { value: 'kg', label: 'kg' }]} onChange={vi.fn()} />
    </ThemeProvider>,
  );
}

/**
 * Story 28 — same iOS Safari auto-zoom threshold as Input.tsx: a native
 * `<select>` below 16px effective font size also triggers it on focus.
 */
describe('Select mobile-safe font size', () => {
  it('renders at least a 16px font size by default', () => {
    renderSelect();
    expect(getComputedStyle(screen.getByLabelText('Unit')).fontSize).toBe('16px');
  });
});
