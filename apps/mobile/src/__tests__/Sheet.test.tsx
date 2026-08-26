import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../theme/ThemeProvider';
import { PopoverHost } from '../components/PopoverHost';
import { Sheet } from '../components/Sheet';

let tree: ReactTestRenderer | null = null;

/**
 * `react-test-renderer` has no layout engine, so a host node's
 * `measureInWindow` never invokes its callback and anything that positions
 * itself from a measurement silently never appears. `createNodeMock` is the
 * documented way to supply one — same category of environment gap as the
 * safe-area mock in jest.setup.ts.
 */
const nodeMock = () => ({
  measureInWindow: (callback: (x: number, y: number, w: number, h: number) => void) =>
    callback(20, 100, 22, 22),
});

function renderTree(element: React.ReactElement): ReactTestRenderer {
  act(() => {
    tree = create(<ThemeProvider><PopoverHost>{element}</PopoverHost></ThemeProvider>, { createNodeMock: nodeMock });
  });
  return tree!;
}

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
});

describe('Sheet', () => {
  it('renders its children while visible', () => {
    const rendered = renderTree(
      <Sheet visible onRequestClose={jest.fn()}>
        <Text testID="content">Hello</Text>
      </Sheet>,
    );
    const node = rendered.root.findAll((n) => n.props?.testID === 'content' && typeof n.type === 'string')[0]!;
    expect(node.props.children).toBe('Hello');
  });

  it('does not close on backdrop tap by default', () => {
    const onRequestClose = jest.fn();
    const rendered = renderTree(
      <Sheet visible onRequestClose={onRequestClose} backdropTestID="backdrop">
        <Text>Hello</Text>
      </Sheet>,
    );
    const backdrop = rendered.root.findAll((n) => n.props?.testID === 'backdrop')[0]!;
    expect(backdrop.props.onPress).toBeUndefined();
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('closes on backdrop tap when dismissOnBackdropPress is set', () => {
    const onRequestClose = jest.fn();
    const rendered = renderTree(
      <Sheet visible onRequestClose={onRequestClose} dismissOnBackdropPress backdropTestID="backdrop">
        <Text>Hello</Text>
      </Sheet>,
    );
    const backdrop = rendered.root.findAll((n) => n.props?.testID === 'backdrop')[0]!;
    act(() => backdrop.props.onPress());
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('wires onRequestClose to the native Modal (Android back button)', () => {
    const onRequestClose = jest.fn();
    const rendered = renderTree(
      <Sheet visible onRequestClose={onRequestClose}>
        <Text>Hello</Text>
      </Sheet>,
    );
    const modal = rendered.root.findAll((n) => n.props?.onRequestClose)[0]!;
    modal.props.onRequestClose();
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });
});
