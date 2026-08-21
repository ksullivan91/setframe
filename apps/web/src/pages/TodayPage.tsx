import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Scale, NotebookText, Utensils, Dumbbell, Watch, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { spacing, radius } from '@setline/design-tokens';
import type { WorkoutSession } from '@setline/schemas';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { Button, Card, Checkbox, Input, useToast } from '../components';
import { useApiClient } from '../lib/api-client';

interface DashboardTodayResponse {
  localDate: string;
  sessions: { id: string; status: string; templateId: string | null }[];
  manualEntry: {
    localDate: string;
    morningWeightValue: number | null;
    morningWeightUnit: 'lb' | 'kg' | null;
    notes: string | null;
    mood: number | null;
    preWorkoutMealLogged: boolean | null;
  } | null;
  activitySummary: {
    activeEnergyKcal?: string | null;
    exerciseMinutes?: number | null;
    appleMoveTimeMinutes?: number | null;
    sourceBundleId?: string | null;
    updatedAt?: string;
  } | null;
  nutritionSnapshot: { caloriesKcal?: string | null } | null;
  syncState: { status?: 'ok' | 'syncing' | 'error' | 'needs_attention'; lastSuccessfulSyncAt?: string | null } | null;
  weekLabel: string | null;
  dayLabel: string | null;
  dayTypeId: string | null;
  estimatedDurationMinutes: number | null;
}

interface DailyManualEntryPatch {
  morningWeightValue?: number | null;
  morningWeightUnit?: 'lb' | 'kg' | null;
  notes?: string | null;
  mood?: number | null;
  preWorkoutMealLogged?: boolean | null;
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[24]}px;

  ${mq.desktop} {
    grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.85fr);
    align-items: start;
  }
`;
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
`;
const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
`;
const Eyebrow = styled.span`
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;
const Title = styled.h1`
  margin: 0;
  font-size: ${typeScale.pageTitle.fontSize}px;
`;
const Subtitle = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.body.fontSize}px;
`;
const RitualCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
`;
const StepRow = styled.div<{ $passive?: boolean }>`
  display: flex;
  gap: ${spacing[12]}px;
  align-items: flex-start;
  opacity: ${(p) => (p.$passive ? 0.88 : 1)};
`;
const StepContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;
`;
const StepHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[12]}px;
`;
const StepTitle = styled.h2`
  margin: 0;
  font-size: ${typeScale.sectionTitle.fontSize}px;
`;
const StepBody = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;
const Divider = styled.hr`
  margin: 0;
  border: none;
  border-top: 1px solid ${(p) => p.theme.border.subtle};
`;
const InlineRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[8]}px;
  align-items: center;
`;
const NotesArea = styled.textarea`
  width: 100%;
  min-height: 88px;
  resize: vertical;
  border: 1px solid ${(p) => p.theme.border.default};
  border-radius: ${radius.small}px;
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
  padding: ${spacing[12]}px;
  font: inherit;

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 2px;
  }
`;
const MoodButton = styled.button<{ $selected: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: ${radius.full}px;
  border: 1px solid ${(p) => (p.$selected ? p.theme.action.primary : p.theme.border.default)};
  background: ${(p) => (p.$selected ? p.theme.action.accentSubtle : p.theme.surface.raised)};
  cursor: pointer;
  font-size: 20px;
`;
const PassiveChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[4]}px;
  border-radius: ${radius.full}px;
  background: ${(p) => p.theme.surface.sunken};
  padding: ${spacing[4]}px ${spacing[12]}px;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.caption.fontSize}px;
`;
const MetaList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: ${spacing[8]}px;
`;
const MetaTile = styled.div`
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: ${radius.small}px;
  padding: ${spacing[12]}px;
  background: ${(p) => p.theme.surface.sunken};
`;
const MetaLabel = styled.div`
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;
const MetaValue = styled.div`
  font-size: ${typeScale.body.fontSize}px;
  font-weight: 600;
`;
const statusCopy = {
  ok: 'Synced',
  syncing: 'Updating health data…',
  error: 'Health sync needs attention',
  needs_attention: 'Health sync needs attention',
} as const;
const moodOptions = [
  { value: 1, label: 'Awful', emoji: '😫' },
  { value: 2, label: 'Low', emoji: '😕' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '🙂' },
  { value: 5, label: 'Great', emoji: '😄' },
] as const;

function todayLocalDate() {
  return new Date().toISOString().slice(0, 10);
}
function formatLongDate(localDate: string) {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}
function formatTime(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function localTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
function fetchToday(api: ReturnType<typeof useApiClient>, localDate: string) {
  return api.get<DashboardTodayResponse>(`/dashboard/today?localDate=${localDate}`);
}
function patchDaily(api: ReturnType<typeof useApiClient>, localDate: string, body: DailyManualEntryPatch) {
  return api.patch(`/me/daily-entries/${localDate}`, body);
}

export function TodayPage() {
  const api = useApiClient();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const localDate = todayLocalDate();
  const { data, isLoading, isError } = useQuery({ queryKey: ['today', localDate], queryFn: () => fetchToday(api, localDate) });
  const manual = data?.manualEntry;
  const [weight, setWeight] = useState('');
  const [journal, setJournal] = useState('');
  const [selectedMood, setSelectedMood] = useState<number | null>(null);

  useEffect(() => {
    setWeight(manual?.morningWeightValue?.toString() ?? '');
    setJournal(manual?.notes ?? '');
    setSelectedMood(manual?.mood ?? null);
  }, [manual?.morningWeightValue, manual?.notes, manual?.mood]);

  const saveMutation = useMutation({
    mutationFn: (body: DailyManualEntryPatch) => patchDaily(api, localDate, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today', localDate] });
      toast.show({ variant: 'success', message: 'Today updated.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not save today.', actionLabel: 'Retry now' }),
  });

  const startWorkoutMutation = useMutation({
    mutationFn: async () => {
      if (data?.sessions[0]?.id) return { id: data.sessions[0].id } as Pick<WorkoutSession, 'id'>;
      return api.post<WorkoutSession>('/workout-sessions', {
        templateId: data?.dayTypeId ?? undefined,
        localDate,
        timezone: localTimezone(),
      });
    },
    onSuccess: (session) => navigate(`/workout/${session.id}`),
    onError: () => toast.show({ variant: 'error', message: 'Could not start workout.', actionLabel: 'Retry now' }),
  });

  const workoutDone = Boolean(data?.sessions.length);
  const mealDone = Boolean(manual?.preWorkoutMealLogged);
  const weightDone = manual?.morningWeightValue != null;
  const journalDone = Boolean((manual?.notes ?? '').trim()) || manual?.mood != null;
  const syncDone = Boolean(data?.activitySummary);
  const syncStatus = data?.syncState?.status ?? 'ok';

  return (
    <Grid>
      <Stack>
        <Header>
          <Eyebrow>{data ? formatLongDate(data.localDate) : formatLongDate(localDate)}</Eyebrow>
          <Title>Today ritual</Title>
          <Subtitle>Move through your morning in order. Auto-synced steps check themselves off.</Subtitle>
        </Header>
        <RitualCard>
          {isLoading ? <span>Loading…</span> : isError ? <span>Couldn't load today.</span> : (
            <>
              <StepRow>
                {weightDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                <StepContent>
                  <StepHeader>
                    <StepTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Scale size={18} /> Morning weight</StepTitle>
                    {weightDone ? <PassiveChip>{manual?.morningWeightValue} {manual?.morningWeightUnit ?? 'lb'}</PassiveChip> : null}
                  </StepHeader>
                  <StepBody>Log your morning weigh-in before anything else.</StepBody>
                  <InlineRow>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <Input label="Weight" value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" unit={manual?.morningWeightUnit ?? 'lb'} />
                    </div>
                    <Button onClick={() => saveMutation.mutate({ morningWeightValue: weight ? Number(weight) : null, morningWeightUnit: manual?.morningWeightUnit ?? 'lb' })} disabled={saveMutation.isPending}>Save</Button>
                  </InlineRow>
                </StepContent>
              </StepRow>
              <Divider />
              <StepRow>
                {journalDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                <StepContent>
                  <StepHeader>
                    <StepTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}><NotebookText size={18} /> Journal + mood</StepTitle>
                  </StepHeader>
                  <StepBody>Short note and a quick read on how you feel.</StepBody>
                  <InlineRow>
                    {moodOptions.map((m) => (
                      <MoodButton key={m.value} $selected={selectedMood === m.value} aria-label={m.label} onClick={() => setSelectedMood(m.value)}>{m.emoji}</MoodButton>
                    ))}
                  </InlineRow>
                  <NotesArea value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="Energy, soreness, sleep, anything worth noting." />
                  <InlineRow>
                    <Button onClick={() => saveMutation.mutate({ notes: journal || null, mood: selectedMood })} disabled={saveMutation.isPending}>Save journal</Button>
                  </InlineRow>
                </StepContent>
              </StepRow>
              <Divider />
              <StepRow>
                {mealDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                <StepContent>
                  <StepHeader>
                    <StepTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Utensils size={18} /> Pre-workout meal</StepTitle>
                    {mealDone ? <PassiveChip>Logged in MFP</PassiveChip> : null}
                  </StepHeader>
                  <StepBody>No nutrition details here — just mark it done once it’s in MyFitnessPal.</StepBody>
                  <Checkbox checked={mealDone} onChange={(e) => saveMutation.mutate({ preWorkoutMealLogged: e.target.checked })} label="Done in MyFitnessPal" />
                </StepContent>
              </StepRow>
              <Divider />
              <StepRow>
                {workoutDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                <StepContent>
                  <StepHeader>
                    <StepTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dumbbell size={18} /> Workout</StepTitle>
                    {data?.estimatedDurationMinutes ? <PassiveChip>~{data.estimatedDurationMinutes} min</PassiveChip> : null}
                  </StepHeader>
                  <StepBody>
                    {data?.dayLabel ? `${data.weekLabel ?? 'Scheduled'} · ${data.dayLabel}` : 'No scheduled day type resolved yet.'}
                  </StepBody>
                  <InlineRow>
                    <Button disabled={!data?.dayLabel || startWorkoutMutation.isPending} onClick={() => startWorkoutMutation.mutate()}>Start workout</Button>
                    <Button variant="secondary" disabled>Preview</Button>
                  </InlineRow>
                </StepContent>
              </StepRow>
              <Divider />
              <StepRow $passive>
                {syncDone ? <CheckCircle2 size={22} /> : <RefreshCw size={22} />}
                <StepContent>
                  <StepHeader>
                    <StepTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Watch size={18} /> Watch auto-sync</StepTitle>
                    <PassiveChip>{statusCopy[syncStatus as keyof typeof statusCopy] ?? 'Synced'}</PassiveChip>
                  </StepHeader>
                  <StepBody>
                    Passive step — your watch fills this in after training.
                    {formatTime(data?.syncState?.lastSuccessfulSyncAt) ? ` Last sync ${formatTime(data?.syncState?.lastSuccessfulSyncAt)}.` : ''}
                  </StepBody>
                  <MetaList>
                    <MetaTile><MetaLabel>Exercise</MetaLabel><MetaValue>{data?.activitySummary?.exerciseMinutes ?? data?.activitySummary?.appleMoveTimeMinutes ?? '—'} min</MetaValue></MetaTile>
                    <MetaTile><MetaLabel>Active kcal</MetaLabel><MetaValue>{data?.activitySummary?.activeEnergyKcal ? Math.round(Number(data.activitySummary.activeEnergyKcal)) : '—'}</MetaValue></MetaTile>
                    <MetaTile><MetaLabel>MFP kcal</MetaLabel><MetaValue>{data?.nutritionSnapshot?.caloriesKcal ? Math.round(Number(data.nutritionSnapshot.caloriesKcal)) : '—'}</MetaValue></MetaTile>
                  </MetaList>
                </StepContent>
              </StepRow>
            </>
          )}
        </RitualCard>
      </Stack>
      <Stack>
        <Card>
          <StepTitle style={{ marginBottom: 8 }}>Today summary</StepTitle>
          <StepBody>{[weightDone, journalDone, mealDone, workoutDone, syncDone].filter(Boolean).length} of 5 steps complete.</StepBody>
          <MetaList>
            <MetaTile><MetaLabel>Weight</MetaLabel><MetaValue>{manual?.morningWeightValue ?? '—'} {manual?.morningWeightUnit ?? ''}</MetaValue></MetaTile>
            <MetaTile><MetaLabel>Mood</MetaLabel><MetaValue>{selectedMood ? moodOptions.find((m) => m.value === selectedMood)?.emoji : '—'}</MetaValue></MetaTile>
            <MetaTile><MetaLabel>Day type</MetaLabel><MetaValue>{data?.dayLabel ?? 'Rest / none'}</MetaValue></MetaTile>
          </MetaList>
        </Card>
      </Stack>
    </Grid>
  );
}
