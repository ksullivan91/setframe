import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { getTheme } from '../theme/getTheme';
import { Modal, type ModalPresentation } from './Modal';

function renderModal(
  presentation: ModalPresentation,
  props: Partial<React.ComponentProps<typeof Modal>> = {},
) {
  const onClose = vi.fn();
  const view = render(
    <ThemeProvider theme={getTheme('light')}>
      <button type="button">outside</button>
      <Modal open onClose={onClose} presentation={presentation} title="Dialog title" {...props}>
        <input aria-label="Field" />
      </Modal>
    </ThemeProvider>,
  );
  return { onClose, ...view };
}

/**
 * Stories 64-66. The old primitive chose its shape from the breakpoint: below
 * 640px every dialog became a bottom sheet. That is right for a short list of
 * choices and wrong for a form, and it produced the reported "two sheets" —
 * a dialog that does not fill the viewport leaves the app's own cards showing
 * above it, and two stacked light surfaces read as two sheets.
 */
describe('Modal presentation', () => {
  it('records its presentation on the surface, so callers cannot get one by accident', () => {
    renderModal('task');
    expect(screen.getByTestId('modal-surface')).toHaveAttribute('data-presentation', 'task');
  });

  it('renders exactly one surface and one backdrop for one dialog', () => {
    /* The reported defect looked like two dialogs. It never was — but this
       pins the invariant so a future change cannot make it true. */
    renderModal('task');
    expect(screen.getAllByTestId('modal-surface')).toHaveLength(1);
    expect(screen.getAllByTestId('modal-backdrop')).toHaveLength(1);
  });

  it('gives the content region the scrolling, not the surface', () => {
    // Exactly one container owns vertical scroll; nested scrolling is what
    // produces detached visual states.
    renderModal('task');
    const content = screen.getByTestId('modal-content');
    expect(getComputedStyle(content).overflowY).toBe('auto');
    expect(getComputedStyle(screen.getByTestId('modal-surface')).overflowY).not.toBe('auto');
  });

  it('renders a sticky footer only when actions are given', () => {
    const { unmount } = renderModal('task');
    expect(screen.queryByTestId('modal-footer')).not.toBeInTheDocument();
    unmount();

    renderModal('task', { footer: <button type="button">Save</button> });
    expect(screen.getByTestId('modal-footer')).toBeInTheDocument();
  });
});

describe('Modal dialog contract', () => {
  it('has an accessible name from its title', () => {
    renderModal('compact');
    expect(screen.getByRole('dialog', { name: 'Dialog title' })).toBeInTheDocument();
  });

  it('marks itself modal so the background is inert to assistive tech', () => {
    renderModal('compact');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus into the dialog on open', () => {
    renderModal('task');
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const { onClose } = renderModal('compact');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on a backdrop click but not on a click inside', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal('compact');

    await user.click(screen.getByTestId('modal-surface'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('returns focus to whatever was focused before it opened', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <ThemeProvider theme={getTheme('light')}>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Modal open={open} onClose={() => setOpen(false)} presentation="compact" title="T">
            <span>body</span>
          </Modal>
        </ThemeProvider>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
  });

  it('renders nothing at all when closed', () => {
    render(
      <ThemeProvider theme={getTheme('light')}>
        <Modal open={false} onClose={() => {}} presentation="task" title="T">
          <span>body</span>
        </Modal>
      </ThemeProvider>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Modal background scroll', () => {
  it('locks the body while open and restores it on close', () => {
    const { unmount } = renderModal('task');
    expect(document.body.style.position).toBe('fixed');
    unmount();
    expect(document.body.style.position).not.toBe('fixed');
  });

  it('does not accumulate lock styles across repeated open and close', () => {
    for (let i = 0; i < 3; i += 1) {
      const { unmount } = renderModal('task');
      unmount();
    }
    expect(document.body.style.position).not.toBe('fixed');
    expect(document.body.style.top).toBe('');
  });
});
