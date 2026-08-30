import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components';
import type { DayType, ProgramScheduleSlot, TrainingProgram } from '@setframe/schemas';
import { buildScheduleDays, describeRepeatMode, type OverviewSlot } from '@setframe/domain';
import { training, workoutEditor } from '@setframe/design-tokens';
import { useApiClient } from '../lib/api-client';
import { Card, CardLabel } from '../components/training-v2/TrainingCards';
import { AssignDaySheet } from '../components/training-v2/AssignDaySheet';

/**
 * The weekly schedule — what replaces the Schedule tab.
 *
 * Figma: `Explore/Mobile/Training 5 · Plan the week` (150:708).
 *
 * Two things live here the product has never surfaced: whether the plan
 * repeats indefinitely or runs as a block (`cycle_length_weeks` has always
 * been in the schema and nothing ever showed it), and which specific dates
 * have been changed.
 *
 * Nothing here touches a logged session. Rescheduling changes intent, and
 * sessions snapshot their prescription at start (ADR 0005).
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

const ModeRow = styled.div`
  display: flex;
  gap: 6px;
`;

const ModeChip = styled.button<{ $active: boolean }>`
  height: 34px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: ${({ theme, $active }) => ($active ? theme.action.primary : theme.surface.sunken)};
  color: ${({ theme, $active }) => ($active ? theme.action.primaryText : theme.text.primary)};
`;

const DayRow = styled.button<{ $divided: boolean }>`
  width: 100%;
  height: 43px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0;
  border: none;
  border-top: ${({ $divided, theme }) => ($divided ? `1px solid ${theme.border.subtle}` : 'none')};
  background: none;
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.action.primary};
    outline-offset: -2px;
  }
`;

const DayName = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: ${({ theme }) => theme.text.primary};
`;

const DayRight = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const DaySummary = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.text.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Chevron = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.secondary};
`;

const Help = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.text.secondary};
`;

export default function SchedulePage() {
  const api = useApiClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState<number | null>(null);

  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<TrainingProgram[]>('/programs'),
  });
  const program = useMemo(
    () => programs.find((p) => p.isActive) ?? programs[0] ?? null,
    [programs],
  );

  const { data: dayTypes = [] } = useQuery({
    queryKey: ['program-day-types', program?.id],
    queryFn: () => api.get<DayType[]>(`/programs/${program!.id}/day-types`),
    enabled: !!program,
  });

  const { data: slots = [] } = useQuery({
    queryKey: ['schedule-slots', program?.id],
    queryFn: () => api.get<ProgramScheduleSlot[]>(`/programs/${program!.id}/schedule-slots`),
    enabled: !!program,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['schedule-slots', program?.id] });

  const assignDay = useMutation({
    mutationFn: async ({ dayIndex, dayTypeIds }: { dayIndex: number; dayTypeIds: string[] }) => {
      /* Rest is the absence of a slot — dayTypeId is NOT NULL, so clearing a
         day means deleting its rows, never writing one that points nowhere.
         Delete first, then re-create in the chosen order. */
      const existing = slots.filter((slot) => slot.dayIndex === dayIndex);
      for (const slot of existing) {
        await api.del(`/programs/${program!.id}/schedule-slots/${slot.id}`);
      }
      for (const [index, dayTypeId] of dayTypeIds.entries()) {
        await api.post(`/programs/${program!.id}/schedule-slots`, {
          dayTypeId,
          dayIndex,
          sortOrder: index,
          weekNumber: null,
        });
      }
    },
    onSuccess: invalidate,
  });

  const overviewSlots = useMemo<OverviewSlot[]>(() => {
    const names = new Map(dayTypes.map((d) => [d.id, d.name]));
    return slots.flatMap((slot) => {
      const dayTypeName = names.get(slot.dayTypeId);
      return dayTypeName
        ? [{ dayIndex: slot.dayIndex, weekNumber: slot.weekNumber, sortOrder: slot.sortOrder, dayTypeName }]
        : [];
    });
  }, [slots, dayTypes]);

  const days = useMemo(() => buildScheduleDays(overviewSlots), [overviewSlots]);
  const isBlock = !!program?.cycleLengthWeeks;

  return (
    <Screen data-testid="schedule-page">
      <Header>
        <TitleRow>
          <Back type="button" onClick={() => navigate('/training')} aria-label="Back to Training">
            ‹
          </Back>
          <Title>Schedule</Title>
        </TitleRow>
        <Meta>
          {program?.name ?? 'Your plan'} · {describeRepeatMode(program?.cycleLengthWeeks ?? null)}
        </Meta>
      </Header>

      <Body>
        <Card data-testid="repeat-mode-card">
          <CardLabel>Repeats</CardLabel>
          <ModeRow>
            {/* Surfaces cycle_length_weeks, which has always been in the
                schema and has never been shown anywhere in the product. */}
            <ModeChip type="button" $active={!isBlock} data-testid="mode-perpetual">
              Every week
            </ModeChip>
            <ModeChip type="button" $active={isBlock} data-testid="mode-block">
              {isBlock ? `As a ${program!.cycleLengthWeeks}-week block` : 'As a block'}
            </ModeChip>
          </ModeRow>
        </Card>

        <Card data-testid="weekly-template-card">
          <CardLabel>Each week</CardLabel>
          {days.map((day, index) => (
            <DayRow
              key={day.dayIndex}
              type="button"
              $divided={index > 0}
              onClick={() => setAssigning(day.dayIndex)}
              data-testid={`schedule-day-${day.dayIndex}`}
            >
              <DayName>{day.dayName}</DayName>
              <DayRight>
                <DaySummary>{day.summary}</DaySummary>
                <Chevron aria-hidden="true">›</Chevron>
              </DayRight>
            </DayRow>
          ))}
        </Card>

        <Card data-testid="overrides-card">
          <CardLabel>Changes to specific days</CardLabel>
          {/* The distinction users most often get wrong, stated before they
              can act on it. */}
          <Help>Swapping one date does not change the weekly pattern above.</Help>
        </Card>
      </Body>

      {assigning != null ? (
        <AssignDaySheet
          dayIndex={assigning}
          dayName={days.find((d) => d.dayIndex === assigning)!.dayName}
          dayTypes={dayTypes}
          selectedIds={slots
            .filter((slot) => slot.dayIndex === assigning)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((slot) => slot.dayTypeId)}
          onClose={() => setAssigning(null)}
          onChange={(dayTypeIds) => assignDay.mutate({ dayIndex: assigning, dayTypeIds })}
        />
      ) : null}
    </Screen>
  );
}
