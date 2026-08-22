import { useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { MoreVertical } from 'lucide-react';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/typeScale';
import { IconButton } from './IconButton';

export interface MenuItem {
  label: string;
  onClick: () => void;
  /** Renders the item with the destructive-action tone (style guide §6:
   * destructive actions should be visually distinct but not dominant). */
  destructive?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  items: MenuItem[];
  /** Accessible label for the trigger button, e.g. "Workout actions". */
  label: string;
}

const Wrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const List = styled.ul`
  position: absolute;
  top: calc(100% + ${spacing[4]}px);
  right: 0;
  min-width: 180px;
  background: ${(p) => p.theme.surface.raised};
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: ${radius.small}px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: ${spacing[4]}px;
  margin: 0;
  list-style: none;
  z-index: 100;
`;

const Item = styled.li`
  display: block;
`;

const ItemButton = styled.button<{ $destructive?: boolean }>`
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  padding: ${spacing[8]}px ${spacing[12]}px;
  border-radius: ${radius.small}px;
  font-size: ${typeScale.body.fontSize}px;
  color: ${(p) => (p.$destructive ? p.theme.status.error : p.theme.text.primary)};
  cursor: pointer;

  &:hover:not(:disabled),
  &:focus-visible {
    background: ${(p) => p.theme.surface.sunken};
    outline: none;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

/**
 * Menu — reusable overflow/dropdown menu for moving secondary and
 * destructive actions (rename/duplicate/delete) out of prominent
 * always-visible inline buttons, per the UX redesign's guidance to
 * reduce repeated visual controls and de-emphasize destructive actions
 * (user-experience-redesign.md §5-6).
 */
export function Menu({ items, label }: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <Wrapper ref={wrapperRef}>
      <IconButton
        ref={triggerRef}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreVertical size={16} />
      </IconButton>
      {open ? (
        <List id={listId} role="menu">
          {items.map((item) => (
            <Item key={item.label} role="none">
              <ItemButton
                role="menuitem"
                type="button"
                $destructive={item.destructive}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </ItemButton>
            </Item>
          ))}
        </List>
      ) : null}
    </Wrapper>
  );
}
