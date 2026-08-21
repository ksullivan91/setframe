import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import styled from 'styled-components';
import { radius, spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';

export interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  label: string;
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

const TabList = styled.div`
  display: inline-flex;
  gap: ${spacing[4]}px;
  padding: ${spacing[4]}px;
  border-radius: ${radius.small}px;
  background: ${(p) => p.theme.surface.sunken};
  width: fit-content;
`;

const Tab = styled.button<{ $active: boolean }>`
  border: none;
  border-radius: ${radius.small}px;
  padding: ${spacing[8]}px ${spacing[16]}px;
  font-size: ${typeScale.compactBody.fontSize}px;
  font-weight: 600;
  cursor: pointer;
  /* Selected-navigation treatment (light purple bg / purple text) is
     intentionally distinct from a solid primary button, per
     user-experience-iteration.md #29. */
  background: ${(p) => (p.$active ? p.theme.action.accentSubtle : 'transparent')};
  color: ${(p) => (p.$active ? p.theme.action.primary : p.theme.text.secondary)};

  &:hover {
    color: ${(p) => p.theme.action.primary};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 2px;
  }
`;

/**
 * Accessible tabs following the WAI-ARIA Authoring Practices tabs pattern:
 * roving tabindex, arrow-key navigation between tabs, and aria-selected on
 * the active tab. Callers are responsible for rendering the associated
 * tabpanel(s) with matching aria-labelledby/id.
 */
export function Tabs({ label, items, activeKey, onChange }: TabsProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = items.length - 1;
    const next = items[nextIndex];
    if (!next) return;
    onChange(next.key);
    tabRefs.current[next.key]?.focus();
  };

  return (
    <TabList role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <Tab
          key={item.key}
          ref={(node) => {
            tabRefs.current[item.key] = node;
          }}
          role="tab"
          type="button"
          id={`tab-${item.key}`}
          aria-controls={`tabpanel-${item.key}`}
          aria-selected={activeKey === item.key}
          tabIndex={activeKey === item.key ? 0 : -1}
          $active={activeKey === item.key}
          onClick={() => onChange(item.key)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {item.label}
        </Tab>
      ))}
    </TabList>
  );
}

export const TabPanel = styled.div.attrs<{ id: string; labelledBy: string; hidden?: boolean }>((props) => ({
  role: 'tabpanel',
  id: props.id,
  'aria-labelledby': props.labelledBy,
  hidden: props.hidden,
  tabIndex: 0,
}))``;
