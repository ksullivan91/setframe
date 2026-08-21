import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { getTheme } from '../theme/getTheme';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label and responds to clicks', async () => {
    const onClick = vi.fn();
    render(
      <ThemeProvider theme={getTheme('light')}>
        <Button onClick={onClick}>Start Workout</Button>
      </ThemeProvider>,
    );

    const button = screen.getByRole('button', { name: 'Start Workout' });
    expect(button).toBeInTheDocument();
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('disables the button and marks it busy while status is loading', () => {
    render(
      <ThemeProvider theme={getTheme('light')}>
        <Button status="loading">Save</Button>
      </ThemeProvider>,
    );

    const button = screen.getByRole('button', { name: 'Save Loading' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('keeps the label accessible while morphed into a success checkmark', () => {
    render(
      <ThemeProvider theme={getTheme('light')}>
        <Button status="success">Save</Button>
      </ThemeProvider>,
    );

    // The label stays in the accessibility tree (opacity: 0 keeps it out
    // of the visual layout without removing it from the DOM), so the
    // button's accessible name is unaffected by the checkmark morph — it
    // gains the "Saved" live-region announcement alongside it.
    const button = screen.getByRole('button', { name: 'Save Saved' });
    expect(button).not.toBeDisabled();
  });

  it('announces success to assistive tech via a visually-hidden live region', () => {
    render(
      <ThemeProvider theme={getTheme('light')}>
        <Button status="success">Save</Button>
      </ThemeProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });
});
