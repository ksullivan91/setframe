import type { ReactNode } from 'react';
import styled from 'styled-components';
import { NavLink } from 'react-router-dom';
import { CalendarCheck, Dumbbell, History, TrendingUp, Settings as SettingsIcon } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { ActiveWorkoutBanner } from './ActiveWorkoutBanner';

/**
 * AppShell — mobile-first. Base styles render a bottom `Shell/Mobile/
 * TabBar`-equivalent (4 items, no History — matching the mobile tab bar
 * per style guide §13/§14) so narrow viewports degrade to the same
 * content as the documented mobile screens. At `tablet` width and up,
 * this progressively enhances into the 240px `Shell/Web/AppShell`
 * sidebar (5 items, History included), per style guide §7.
 */
const Shell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  ${mq.tablet} {
    flex-direction: row;
  }
`;

const Sidebar = styled.nav`
  order: 2;
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  gap: 0;
  background: ${(p) => p.theme.surface.raised};
  border-top: 1px solid ${(p) => p.theme.border.subtle};
  padding: ${spacing[8]}px;

  ${mq.tablet} {
    order: 0;
    position: static;
    width: 240px;
    flex-shrink: 0;
    flex-direction: column;
    justify-content: flex-start;
    border-top: none;
    border-right: 1px solid ${(p) => p.theme.border.subtle};
    padding: ${spacing[24]}px ${spacing[16]}px;
    gap: ${spacing[4]}px;
  }
`;

const Wordmark = styled.div`
  display: none;

  ${mq.tablet} {
    display: block;
    font-size: ${typeScale.sectionTitle.fontSize}px;
    font-weight: ${typeScale.sectionTitle.fontWeight};
    color: ${(p) => p.theme.text.primary};
    padding: 0 ${spacing[12]}px ${spacing[24]}px;
  }
`;

const NavItem = styled(NavLink)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: ${spacing[8]}px;
  border-radius: 8px;
  text-decoration: none;
  color: ${(p) => p.theme.text.primary};
  font-size: ${typeScale.caption.fontSize}px;
  flex: 1;

  &.active {
    background: ${(p) => p.theme.action.primary};
    color: ${(p) => p.theme.action.primaryText};
    font-weight: 600;
  }

  ${mq.tablet} {
    flex-direction: row;
    justify-content: flex-start;
    gap: ${spacing[8]}px;
    padding: ${spacing[8]}px ${spacing[12]}px;
    font-size: ${typeScale.body.fontSize}px;
    flex: initial;
  }
`;

const HistoryNavItem = styled(NavItem)`
  display: none;

  ${mq.tablet} {
    display: flex;
  }
`;

const AccountRow = styled.div`
  order: -1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${spacing[8]}px;

  ${mq.tablet} {
    justify-content: flex-start;
    padding: 0 ${spacing[12]}px ${spacing[16]}px;
  }
`;

const Content = styled.main`
  order: 1;
  flex: 1;
  padding: ${spacing[16]}px;

  ${mq.tablet} {
    padding: ${spacing[32]}px;
    max-width: 1040px;
  }
`;

const navItems = [
  { to: '/today', label: 'Today', icon: CalendarCheck },
  { to: '/training', label: 'Training', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Shell>
      <Sidebar aria-label="Primary">
        <Wordmark>Setline</Wordmark>
        <AccountRow>
          <UserButton afterSignOutUrl="/sign-in" />
        </AccountRow>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavItem key={to} to={to}>
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavItem>
        ))}
        {/* History is web-only nav item per style guide §13/§14 — hidden below `tablet`. */}
        <HistoryNavItem to="/history">
          <History size={18} aria-hidden="true" />
          History
        </HistoryNavItem>
      </Sidebar>
      <Content>
        <ActiveWorkoutBanner />
        {children}
      </Content>
    </Shell>
  );
}

