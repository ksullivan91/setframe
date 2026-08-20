import { useState } from 'react';
import styled from 'styled-components';
import { spacing, radius } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { Card, Button } from '../components';

/**
 * Settings — Account/Preferences/Apple Health sync/Notifications/Danger
 * zone sections, per style guide §12/§19.3. Health sync section is
 * grounded in the `integration_sync_state` entity, notification toggles
 * in the `user_notification_preference` schema (packages/schemas/user.ts).
 * Clerk owns identity/profile editing — we only show a read-only summary
 * + hand-off link, never rebuild Clerk's own UI (§11.5).
 */
const Section = styled.section`
  margin-bottom: ${spacing[24]}px;
`;

const SectionTitle = styled.h2`
  font-size: ${typeScale.sectionTitle.fontSize}px;
  margin: 0 0 ${spacing[8]}px;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${spacing[12]}px 0;
  border-top: 1px solid ${(p) => p.theme.border.subtle};

  &:first-child {
    border-top: none;
  }
`;

const Value = styled.span<{ $tone?: 'success' | 'destructive' }>`
  color: ${(p) =>
    p.$tone === 'success'
      ? p.theme.status.success
      : p.$tone === 'destructive'
        ? p.theme.action.destructive
        : p.theme.text.secondary};
  font-weight: ${(p) => (p.$tone ? 600 : 400)};
`;

const ToggleButton = styled.button<{ $on: boolean }>`
  width: 44px;
  height: 24px;
  border-radius: ${radius.full}px;
  border: none;
  background: ${(p) => (p.$on ? p.theme.action.primary : p.theme.surface.sunken)};
  position: relative;
  cursor: pointer;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${(p) => (p.$on ? '22px' : '2px')};
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: ${(p) => p.theme.surface.raised};
    transition: left 0.15s ease;
  }
`;

export function SettingsPage() {
  const [workoutReminders, setWorkoutReminders] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);

  return (
    <div>
      <h1>Settings</h1>

      <Section>
        <SectionTitle>Account</SectionTitle>
        <Card>
          <Row>
            <span>Email</span>
            <Value>you@example.com</Value>
          </Row>
          <Row>
            <span>Manage account</span>
            <Value>Clerk &rsaquo;</Value>
          </Row>
        </Card>
      </Section>

      <Section>
        <SectionTitle>Preferences</SectionTitle>
        <Card>
          <Row>
            <span>Units</span>
            <Value>Imperial (lb) &rsaquo;</Value>
          </Row>
          <Row>
            <span>Timezone</span>
            <Value>America/Chicago</Value>
          </Row>
        </Card>
      </Section>

      <Section>
        <SectionTitle>Apple Health sync</SectionTitle>
        <Card>
          <Row>
            <span>Apple Health sync</span>
            <Value $tone="success">Connected &rsaquo;</Value>
          </Row>
          <Row>
            <span>Last synced</span>
            <Value>2 minutes ago</Value>
          </Row>
        </Card>
      </Section>

      <Section>
        <SectionTitle>Notifications</SectionTitle>
        <Card>
          <Row>
            <span>Workout reminders</span>
            <ToggleButton
              type="button"
              role="switch"
              aria-checked={workoutReminders}
              aria-label="Workout reminders"
              $on={workoutReminders}
              onClick={() => setWorkoutReminders((v) => !v)}
            />
          </Row>
          <Row>
            <span>Weekly progress summary</span>
            <ToggleButton
              type="button"
              role="switch"
              aria-checked={weeklySummary}
              aria-label="Weekly progress summary"
              $on={weeklySummary}
              onClick={() => setWeeklySummary((v) => !v)}
            />
          </Row>
        </Card>
      </Section>

      <Section>
        <SectionTitle>Danger zone</SectionTitle>
        <Card>
          <Row>
            <div>
              <div>Delete account</div>
              <Value $tone="destructive">This cannot be undone</Value>
            </div>
            <Button variant="destructive">Delete account</Button>
          </Row>
        </Card>
      </Section>
    </div>
  );
}
