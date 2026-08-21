import styled, { keyframes } from 'styled-components';
import { Dumbbell, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import type { WorkoutSession } from '@setline/schemas';
import { spacing, radius } from '@setline/design-tokens';
import { useApiClient } from '../lib/api-client';

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.82); }
`;

const Banner = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  width: 100%;
  border: 1px solid ${(p) => p.theme.action.primary}33;
  border-radius: ${radius.large}px;
  cursor: pointer;
  background: ${(p) => p.theme.action.accentSubtle};
  color: ${(p) => p.theme.text.primary};
  padding: ${spacing[12]}px ${spacing[16]}px;
  margin-bottom: ${spacing[16]}px;
  font: inherit;
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    border-color: ${(p) => p.theme.action.primary}66;
  }
`;

const IconBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: ${radius.small}px;
  background: ${(p) => p.theme.action.primary};
  color: ${(p) => p.theme.action.primaryText};
`;

const Label = styled.span`
  display: flex;
  align-items: center;
  gap: ${spacing[12]}px;
  font-weight: 600;
`;

const StatusDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(p) => p.theme.status.success};
  animation: ${pulse} 1.6s ease-in-out infinite;
`;

const TextGroup = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.1;
`;

const Eyebrow = styled.span`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: ${(p) => p.theme.text.secondary};
`;

const Title = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: ${(p) => p.theme.text.primary};
`;

const ResumeText = styled.span`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  font-weight: 600;
  color: ${(p) => p.theme.action.primary};
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
      <Label>
        <IconBadge>
          <Dumbbell size={16} aria-hidden="true" />
        </IconBadge>
        <TextGroup>
          <Eyebrow>
            <StatusDot />
            In progress
          </Eyebrow>
          <Title>Workout in progress</Title>
        </TextGroup>
      </Label>
      <ResumeText>
        Resume
        <ArrowRight size={16} aria-hidden="true" />
      </ResumeText>
    </Banner>
  );
}
