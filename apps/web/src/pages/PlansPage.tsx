import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components';
import type { TrainingProgram } from '@setframe/schemas';
import { describeRepeatMode, planBadge, planSwitchLabel } from '@setframe/domain';
import { training, workoutEditor } from '@setframe/design-tokens';
import { useApiClient } from '../lib/api-client';
import { Card } from '../components/training-v2/TrainingCards';

/**
 * "Your plans" — reached from the overview's Change, not from a tab.
 *
 * Figma: `Explore/Mobile/Training 8 · Later — switch plans` (151:708).
 *
 * Named plans rather than Programs: the object stays, the jargon does not.
 *
 * Switching is a **pointer move** — `program_version` keeps the history — so
 * it needs no confirmation and no migration. The reassurance is in the copy
 * rather than a dialog, because "will I lose my history" is the thing a user
 * would most reasonably fear about pressing these buttons.
 */

const SHELL_PADDING = 16;

const Screen = styled.div`
  display: flex;
  flex-direction: column;
`;

const Header = styled.header`
  margin-inline: -${SHELL_PADDING}px;
  display: flex;
  flex-direction: column;
  gap: ${workoutEditor.header.gap}px;
  padding: ${workoutEditor.header.paddingTop}px ${workoutEditor.header.paddingX}px
    ${workoutEditor.header.paddingBottom}px 12px;
  background: ${({ theme }) => theme.surface.raised};
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Back = styled.button`
  width: 24px;
  border: none;
  background: none;
  padding: 0;
  font-size: ${workoutEditor.header.backSize}px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.secondary};
  cursor: pointer;
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${workoutEditor.header.titleSize}px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};
`;

const Meta = styled.p`
  margin: 0;
  padding-left: 12px;
  font-size: ${workoutEditor.header.metaSize}px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${training.cardGap}px;
  padding: ${SHELL_PADDING}px 0;
`;

const PlanTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
`;

const PlanLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const PlanName = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Badge = styled.span`
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: 999px;
  background: ${({ theme }) => theme.action.accentSubtle};
  color: ${({ theme }) => theme.action.primary};
  font-size: 10px;
  font-weight: 600;
`;

const PlanMeta = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.text.secondary};
`;

const UseButton = styled.button`
  width: 100%;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: ${({ theme }) => theme.surface.sunken};
  color: ${({ theme }) => theme.action.primary};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
`;

const Note = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.text.secondary};
`;

const NewPlan = styled.button`
  width: ${training.cardWidth}px;
  max-width: 100%;
  height: 46px;
  border: none;
  border-radius: 8px;
  background: ${({ theme }) => theme.surface.sunken};
  color: ${({ theme }) => theme.action.primary};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
`;

export default function PlansPage() {
  const api = useApiClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<TrainingProgram[]>('/programs'),
  });

  const activate = useMutation({
    mutationFn: (programId: string) => api.post(`/programs/${programId}/activate`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
      navigate('/training');
    },
  });

  const sorted = useMemo(
    () => [...programs].sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    [programs],
  );

  return (
    <Screen data-testid="plans-page">
      <Header>
        <TitleRow>
          <Back type="button" onClick={() => navigate('/training')} aria-label="Back to Training">
            ‹
          </Back>
          <Title>Your plans</Title>
        </TitleRow>
        <Meta>One drives Today. The rest keep their history.</Meta>
      </Header>

      <Body>
        {sorted.map((program) => {
          const badge = planBadge(program.isActive);
          return (
            <Card key={program.id} data-testid={`plan-${program.id}`}>
              <PlanTop>
                <PlanLeft>
                  <NameRow>
                    <PlanName>{program.name}</PlanName>
                    {/* Says what it DOES rather than using the word Active. */}
                    {badge ? <Badge>{badge}</Badge> : null}
                  </NameRow>
                  <PlanMeta>{describeRepeatMode(program.cycleLengthWeeks ?? null)}</PlanMeta>
                </PlanLeft>
              </PlanTop>
              {program.isActive ? null : (
                <UseButton
                  type="button"
                  onClick={() => activate.mutate(program.id)}
                  data-testid={`use-plan-${program.id}`}
                >
                  {/* Different copy for a plan run before — the label does the
                      reassuring a dialog would otherwise have to. */}
                  {planSwitchLabel(!!program.startDate)}
                </UseButton>
              )}
            </Card>
          );
        })}

        {/* Answered before they press, because it is the thing a user would
            most reasonably fear about these buttons. */}
        <Note>
          Switching keeps everything. Your logged workouts stay with the plan you did them on, and
          you can come back to it.
        </Note>

        <NewPlan type="button" onClick={() => navigate('/training/new')} data-testid="new-plan">
          + New plan
        </NewPlan>
      </Body>
    </Screen>
  );
}
