import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import { getTheme } from '../src/theme/getTheme';
import { GlobalStyle } from '../src/theme/GlobalStyle';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { Modal, type ModalPresentation } from '../src/components/Modal';

/**
 * A Playwright-only harness that mounts the *real* `Modal`.
 *
 * Story 67. The alternative was driving a real route, which needs a Clerk
 * sign-in — and `docs/design/design-review-account.md` records that Clerk's
 * multi-step form is not reliably scriptable. Rather than let that block
 * regression coverage entirely, this exercises the primitive itself, which is
 * where every one of the story's assertions actually lives: viewport
 * behaviour, scroll ownership, overflow, focus, surface count.
 *
 * It is deliberately **not** part of the app. Vite's build only emits
 * `index.html`, so nothing here reaches the production bundle, and no
 * dev-only route is added to the router — this repo has removed that kind of
 * scaffolding once already.
 */

/** Long enough to force the content region to scroll on a phone viewport. */
const LONG_TEXT = Array.from({ length: 24 }, (_, i) => `Filler paragraph ${i + 1}.`);

function Harness() {
  const [open, setOpen] = useState<ModalPresentation | null>(null);

  return (
    <ThemeProvider theme={getTheme('light')}>
      <GlobalStyle />
      <main style={{ padding: 16, display: 'grid', gap: 12 }}>
        <h1>Modal harness</h1>
        {/* Tall, so the page genuinely scrolls and background-scroll locking
            is a real assertion rather than a vacuous one. */}
        {LONG_TEXT.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <Button data-testid="open-task" onClick={() => setOpen('task')}>
          Open task
        </Button>
        <Button data-testid="open-compact" onClick={() => setOpen('compact')}>
          Open compact
        </Button>
        <Button data-testid="open-actions" onClick={() => setOpen('actions')}>
          Open actions
        </Button>
      </main>

      <Modal
        open={open === 'task'}
        onClose={() => setOpen(null)}
        presentation="task"
        title="Barbell Back Squat"
        footer={<Button data-testid="task-primary">Add to workout</Button>}
      >
        <Input label="Sets" defaultValue="3" inputMode="numeric" />
        <Input label="Reps" defaultValue="8" inputMode="numeric" />
        {LONG_TEXT.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </Modal>

      <Modal
        open={open === 'compact'}
        onClose={() => setOpen(null)}
        presentation="compact"
        title="Remove set?"
        description="This deletes the set from the workout session."
      >
        <Button data-testid="compact-confirm">Remove set</Button>
      </Modal>

      <Modal
        open={open === 'actions'}
        onClose={() => setOpen(null)}
        presentation="actions"
        title="Workout actions"
      >
        <Button data-testid="actions-first">Remove from this program</Button>
      </Modal>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
