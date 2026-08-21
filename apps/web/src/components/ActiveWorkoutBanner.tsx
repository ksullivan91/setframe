import styled, { keyframes } from 'styled-components';
import { Dumbbell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import type { WorkoutSession } from '@setline/schemas';
import { spacing, radius } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { useApiClient } from '../lib/api-client';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

/**
 * Styled to match the app's established Toast pattern (style guide §8,
 * `Toast/Error` node 14:84): solid dark/status background, inverse text,
 * and a colored semi-bold action label — rather than inventing a new
 * card-like treatment. This is a full-width persistent banner (not part
 * of the ephemeral toast stack), so it uses action.primary as the "in
 * progress" status color instead of Toast's error/dark background.
 */
const Banner = styled.button`
  display: flex;
  align-items: center;
  gap: ${spacing[12]}px;
  width: 100%;
  border: none;
  border-radius: ${radius.small}px;
  cursor: pointer;
  background: ${(p) => p.theme.action.primary};
  color: ${(p) => p.theme.action.primaryText};
  padding: ${spacing[12]}px ${spacing[16]}px;
  margin-bottom: ${spacing[16]}px;
  font: inherit;
  font-size: ${typeScale.body.fontSize}px;
  text-align: left;
`;

const PulseDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(p) => p.theme.action.primaryText};
  animation: ${pulse} 1.6s ease-in-out infinite;
  flex-shrink: 0;
`;

const Message = styled.span`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  font-weight: 600;
  flex: 1;
`;

const ResumeText = styled.span`
  font-weight: 700;
  white-space: nowrap;
`;

/**
 * Global banner shown across every authenticated page whenever the user has
 * an in-progress workout session, so they can always navigate back to it —
 * previously, leaving the workout page lost any way back short of
 * re-clicking "Start workout" on Today (which itself still showed the
 * disabled/default state, giving no indication a session was already open).
 */
export function ActiveWorkoutBanner() {
  const api = useApiClient();
  const navigate = useNavigate();
  const location = useLocation();

  const { data } = useQuery({
    queryKey: ['active-workout-session'],
    queryFn: () =>
      api.get<{ items: WorkoutSession[]; nextCursor: string | null }>('/workout-sessions?status=in_progress'),
    refetchInterval: 30_000,
  });

  const activeSession = data?.items[0];
  if (!activeSession) return null;
  if (location.pathname.startsWith('/workout/')) return null;

  return (
    <Banner onClick={() => navigate(`/workout/${activeSession.id}`)}>
      <Message>
        <PulseDot />
        <Dumbbell size={16} aria-hidden="true" />
        Workout in progress
      </Message>
      <ResumeText>Resume →</ResumeText>
    </Banner>
  );
}
