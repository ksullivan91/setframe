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
});
