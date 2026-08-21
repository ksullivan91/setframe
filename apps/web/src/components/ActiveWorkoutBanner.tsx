import styled from 'styled-components';
import { Dumbbell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import type { WorkoutSession } from '@setline/schemas';
import { spacing } from '@setline/design-tokens';
import { useApiClient } from '../lib/api-client';

const Banner = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  width: 100%;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: ${(p) => p.theme.action.primary};
  color: ${(p) => p.theme.action.primaryText};
  padding: ${spacing[12]}px ${spacing[16]}px;
  margin-bottom: ${spacing[16]}px;
  font: inherit;
  text-align: left;
`;

const Label = styled.span`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  font-weight: 600;
`;

const ResumeText = styled.span`
  text-decoration: underline;
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
    queryFn: () => api.get<WorkoutSession[]>('/workout-sessions?status=in_progress'),
    refetchInterval: 30_000,
  });

  const activeSession = data?.[0];
  if (!activeSession) return null;
  if (location.pathname === `/workout/${activeSession.id}`) return null;

  return (
    <Banner onClick={() => navigate(`/workout/${activeSession.id}`)}>
      <Label>
        <Dumbbell size={16} aria-hidden="true" />
        Workout in progress
      </Label>
      <ResumeText>Resume →</ResumeText>
    </Banner>
  );
}
