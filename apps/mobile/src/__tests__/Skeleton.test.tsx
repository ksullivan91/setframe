import React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../theme/ThemeProvider';
import { FadeIn, Skeleton, SkeletonStack } from '../components/Skeleton';

/**
 * These components run looping animations, so every tree is unmounted after
 * the assertions — otherwise the loop keeps a timer alive and Jest reports a
 * leaked worker.
 */
let tree: ReactTestRenderer | null = null;

function renderTree(element: React.ReactElement): ReactTestRenderer {
  act(() => {
    tree = create(<ThemeProvider>{element}</ThemeProvider>);
  });
  return tree!;
}

function flattenedStyle(rendered: ReactTestRenderer, testID: string): Record<string, unknown> {
  // `findAll` returns both the composite and its host node; only the host
  // carries the resolved style.
  const node = rendered.root.findAll((n) => n.props?.testID === testID && typeof n.type === 'string')[0]!;
  return Object.assign({}, ...[node.props.style].flat(2));
}

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);
});

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
  jest.restoreAllMocks();
});

describe('Skeleton', () => {
  it('renders at the requested size', () => {
    const rendered = renderTree(<Skeleton testID="bar" height={24} width="50%" />);
    const style = flattenedStyle(rendered, 'bar');
    expect(style.height).toBe(24);
    expect(style.width).toBe('50%');
  });

  it('uses a pill radius when rounded', () => {
    const rendered = renderTree(<Skeleton testID="bar" rounded />);
    expect(flattenedStyle(rendered, 'bar').borderRadius).toBe(999);
  });

  it('is hidden from screen readers, since it conveys no content', () => {
    const rendered = renderTree(<Skeleton testID="bar" />);
    const node = rendered.root.findAll((n) => n.props?.testID === 'bar' && typeof n.type === 'string')[0]!;
    expect(node.props.accessibilityElementsHidden).toBe(true);
  });

  it('checks the reduce-motion setting before animating', () => {
    renderTree(<Skeleton testID="bar" />);
    expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled();
  });

  it('stacks children in a column with a gap', () => {
    const rendered = renderTree(
      <SkeletonStack testID="stack" gap={12}>
        <Skeleton />
      </SkeletonStack>,
    );
    const style = flattenedStyle(rendered, 'stack');
    expect(style.gap).toBe(12);
    expect(style.flexDirection).toBe('column');
  });
});

describe('FadeIn', () => {
  it('renders its children', () => {
    const rendered = renderTree(
      <FadeIn testID="fade">
        <Text testID="fade-child">Loaded</Text>
      </FadeIn>,
    );
    const child = rendered.root.findAll((n) => n.props?.testID === 'fade-child' && typeof n.type === 'string')[0]!;
    expect(child.props.children).toBe('Loaded');
  });

  it('checks the reduce-motion setting before animating', () => {
    renderTree(
      <FadeIn testID="fade">
        <Text>Loaded</Text>
      </FadeIn>,
    );
    expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled();
  });
});

/**
 * The skeleton bars are all removed from the accessibility tree, so the
 * container has to carry the announcement itself — and on iOS a view is only
 * exposed as an accessibility element when `accessible` is set.
 */
describe('skeleton accessibility contract', () => {
  it('hides every bar from assistive technology', () => {
    const rendered = renderTree(
      <SkeletonStack testID="stack">
        <Skeleton testID="bar" />
      </SkeletonStack>,
    );
    const node = rendered.root.findAll((n) => n.props?.testID === 'bar' && typeof n.type === 'string')[0]!;
    expect(node.props.accessibilityElementsHidden).toBe(true);
    expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
