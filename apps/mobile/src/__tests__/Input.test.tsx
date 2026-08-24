import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../theme/ThemeProvider';
import { Input } from '../components/Input';

let tree: ReactTestRenderer | null = null;

function renderTree(element: React.ReactElement): ReactTestRenderer {
  act(() => {
    tree = create(<ThemeProvider>{element}</ThemeProvider>);
  });
  return tree!;
}

function textNodesContaining(rendered: ReactTestRenderer, needle: string) {
  return rendered.root.findAll((node) => {
    if (typeof node.type !== 'string') return false;
    const joined = ([] as unknown[])
      .concat(node.props?.children)
      .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
      .join('');
    return joined.includes(needle);
  });
}

function textInput(rendered: ReactTestRenderer) {
  // `findAll` returns outer-to-inner matches (the `Input` component itself
  // also receives `onChangeText`, ahead of the actual RN `TextInput` it
  // renders) — the innermost/last match is the real host element carrying
  // the merged `accessibilityLabel` prop.
  const matches = rendered.root.findAll(
    (node) => typeof node.props?.onChangeText === 'function' && typeof node.type !== 'string',
  );
  return matches[matches.length - 1]!;
}

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
});

/**
 * Story 22 — same fix as web's Input: a "lb" suffix sharing the field's
 * bordered box with the value could overflow at narrow widths. Folded
 * into the visible label when one exists; the compact, label-less
 * `SetRow` inline weight/reps (deliberately not redesigned by this
 * story) keeps the inline suffix, but gets an explicit accessibilityLabel
 * instead.
 */
describe('Input unit label', () => {
  it('folds the unit into the visible label when both are provided', () => {
    const rendered = renderTree(<Input label="Weight" value="" onChangeText={() => {}} unit="lb" />);
    expect(textNodesContaining(rendered, 'Weight (lb)').length).toBeGreaterThan(0);
  });

  it('does not render a separate in-field unit element when a label is present', () => {
    const rendered = renderTree(<Input label="Weight" value="" onChangeText={() => {}} unit="lb" />);
    // Only the folded "Weight (lb)" label text should contain "lb" — no
    // standalone unit suffix node alongside it.
    const allLbText = rendered.root.findAll(
      (node) => typeof node.type === 'string' && ([] as unknown[]).concat(node.props?.children).some((c) => c === 'lb'),
    );
    expect(allLbText.length).toBe(0);
  });

  it('keeps the inline unit suffix for the label-less compact case', () => {
    const rendered = renderTree(<Input value="" onChangeText={() => {}} unit="lb" />);
    expect(textNodesContaining(rendered, 'lb').length).toBeGreaterThan(0);
  });

  it('sets an explicit accessibilityLabel for the label-less compact case', () => {
    const rendered = renderTree(
      <Input value="" onChangeText={() => {}} unit="lb" accessibilityLabel="Weight, lb" />,
    );
    expect(textInput(rendered).props.accessibilityLabel).toBe('Weight, lb');
  });

  it('computes an accessibilityLabel that includes the unit when a label is present', () => {
    const rendered = renderTree(<Input label="Weight" value="" onChangeText={() => {}} unit="lb" />);
    expect(textInput(rendered).props.accessibilityLabel).toBe('Weight (lb)');
  });
});
