import { useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { AdditionalActivity, AdditionalActivityPreset, AdditionalActivityType, User } from '@setframe/schemas';
import {
  deriveRecentActivitySuggestions,
  formatActivityDuration,
  getAdditionalActivityFields,
  secondsToDurationParts,
  validateDurationDraft,
  type DurationDraft,
  type RecentActivitySuggestion,
} from '@setframe/domain';

/** Canonical seconds -> the two form fields, with empty for "no duration". */
function toDurationDraft(totalSeconds: number | null | undefined): DurationDraft {
  if (totalSeconds == null || totalSeconds <= 0) return { minutes: '', seconds: '' };
  const parts = secondsToDurationParts(totalSeconds);
  return {
    minutes: String(parts.minutes),
    // Blank rather than "0" so a whole-minute activity looks exactly as it
    // did before seconds existed.
    seconds: parts.seconds === 0 ? '' : String(parts.seconds),
  };
}
import { radius, spacing } from '@setframe/design-tokens';
import { Button } from './Button';
import { Card } from './Card';
import { IconButton } from './IconButton';
import { DurationInput } from './DurationInput';
import { Input } from './Input';
import { Modal } from './Modal';
import { Select } from './Select';
import { Skeleton } from './Skeleton';
import { useToast } from './Toast';
import { useApiClient } from '../lib/api-client';
import { typeScale } from '../theme/typeScale';

const activityTypeLabels: Record<AdditionalActivityType, string> = {
  walk: 'Walk',
  yoga: 'Yoga',
  mobility: 'Mobility',
  foam_rolling: 'Foam rolling',
  outdoor_cycle: 'Outdoor cycle',
  indoor_cycle: 'Indoor cycle',
  run: 'Run',
  stretching: 'Stretching',
  other: 'Other',
};

const activityTypeOptions = (Object.keys(activityTypeLabels) as AdditionalActivityType[]).map((value) => ({
  value,
  label: activityTypeLabels[value],
}));

function formatActivityTime(startedAt: string | null): string | null {
  if (!startedAt) return null;
  return new Date(startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function daysAgo(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function suggestionLabel(suggestion: { activityType: AdditionalActivityType; title: string | null; durationSeconds: number | null }): string {
  const duration = formatActivityDuration(suggestion.durationSeconds);
  const name = suggestion.title || activityTypeLabels[suggestion.activityType];
  return duration ? `${name} · ${duration}` : name;
}

interface ActivityDraft {
  activityType: AdditionalActivityType;
  title: string;
  duration: DurationDraft;
  distanceValue: string;
  distanceUnit: 'm' | 'km' | 'mi';
  startTime: string;
  notes: string;
}

function emptyDraft(preferredDistanceUnit: 'km' | 'mi'): ActivityDraft {
  return { activityType: 'walk', title: '', duration: { minutes: '', seconds: '' }, distanceValue: '', distanceUnit: preferredDistanceUnit, startTime: '', notes: '' };
}

// The <input type="time"> field works in local wall-clock time, but
// `startedAt` is stored/returned as a UTC ISO string — slicing its UTC
// hour directly (rather than converting) shows/re-saves the wrong time
// whenever the browser's timezone isn't UTC.
function draftFromActivity(activity: AdditionalActivity): ActivityDraft {
  const local = activity.startedAt ? new Date(activity.startedAt) : null;
  return {
    activityType: activity.activityType,
    title: activity.title ?? '',
    /* Split, not rounded to minutes. The previous `Math.round(seconds / 60)`
       meant opening an existing 877-second activity and saving it rewrote it
       to 900 — precision was destroyed on every round-trip through this form. */
    duration: toDurationDraft(activity.durationSeconds),
    distanceValue: activity.distanceValue != null ? String(activity.distanceValue) : '',
    distanceUnit: activity.distanceUnit ?? 'mi',
    startTime: local ? `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}` : '',
    notes: activity.notes ?? '',
  };
}

const SectionCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
  /* Story 41 — lighter visual weight than the scheduled-workout card, per
     the steering doc's "do not clone the Today's Workout card." */
  background: ${(p) => p.theme.surface.sunken};
  border: 1px dashed ${(p) => p.theme.border.subtle};
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[8]}px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${typeScale.sectionTitle.fontSize}px;
`;

const EmptyText = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const RowList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;
`;

const Row = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[8]}px;
  padding: ${spacing[8]}px ${spacing[12]}px;
  border-radius: ${radius.small}px;
  background: ${(p) => p.theme.surface.raised};
`;

const RowMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
  min-width: 0;
`;

const RowTitle = styled.span`
  font-size: ${typeScale.compactBody.fontSize}px;
  color: ${(p) => p.theme.text.primary};
`;

const RowDetail = styled.span`
  font-size: ${typeScale.helper.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[4]}px;
  flex-shrink: 0;
`;

const FormGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${spacing[8]}px;
`;

const ErrorRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[8]}px;
`;

const QuickAddSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;
`;

const QuickAddLabel = styled.span`
  font-size: ${typeScale.helper.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[8]}px;
`;

// A plain div, not a <button> — the removable variant nests a real <button>
// (ChipRemove) inside it, which HTML doesn't allow inside an actual button
// element. Suggestion chips (no remove affordance) use ChipButton instead.
const Chip = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[4]}px;
  border: 1px solid ${(p) => p.theme.border.default};
  background: ${(p) => p.theme.surface.raised};
  border-radius: ${radius.small}px;
  padding: ${spacing[4]}px ${spacing[8]}px;
  font-size: ${typeScale.helper.fontSize}px;
  color: ${(p) => p.theme.text.primary};
`;

const ChipButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${spacing[4]}px;
  border: 1px solid ${(p) => p.theme.border.default};
  background: ${(p) => p.theme.surface.raised};
  border-radius: ${radius.small}px;
  padding: ${spacing[4]}px ${spacing[8]}px;
  font-size: ${typeScale.helper.fontSize}px;
  color: ${(p) => p.theme.text.primary};
  cursor: pointer;
`;

const ChipLabel = styled.button`
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
`;

const ChipRemove = styled.button`
  display: inline-flex;
  align-items: center;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  color: ${(p) => p.theme.text.disabled};

  &:hover {
    color: ${(p) => p.theme.status.error};
  }
`;

const SavePresetRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${spacing[8]}px;
`;

/**
 * Story 41 — a distinct, visually-secondary section for supplemental
 * movement (walks, yoga, mobility) outside the scheduled workout. Fetches
 * independently of Today's main dashboard query, so a failed activity
 * request degrades this section alone and never blocks the scheduled
 * workout from rendering (per the story's steering doc).
 *
 * Story 42 — the add/edit form shows only the fields relevant to the
 * selected activity type (packages/domain's additionalActivityFieldsByType
 * — one shared mapping, not a duplicated form per platform), defaults the
 * distance unit to the user's stated preference, and requires only
 * duration (plus a name for "Other") to save.
 */
export function TodayAdditionalActivitySection({ localDate }: { localDate: string }) {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdditionalActivity | null>(null);
  const [draft, setDraft] = useState<ActivityDraft>(emptyDraft('mi'));
  const [pendingDelete, setPendingDelete] = useState<AdditionalActivity | null>(null);
  const [presetTitleDraft, setPresetTitleDraft] = useState('');

  const query = useQuery({
    queryKey: ['additional-activities', localDate],
    queryFn: () => api.get<{ items: AdditionalActivity[] }>(`/additional-activities?localDate=${localDate}`),
  });

  // Story 43 — recent suggestions only matter while adding something new,
  // so this only fetches once the form is actually open, and never for an
  // edit (there's nothing to "suggest" when a specific activity is already
  // selected). A 30-day window is enough recency to be useful without
  // pulling a user's entire history for a dedup pass that only keeps 3.
  const recentsQuery = useQuery({
    queryKey: ['additional-activities', 'recents', localDate],
    queryFn: () =>
      api.get<{ items: AdditionalActivity[] }>(
        `/additional-activities?from=${daysAgo(localDate, 30)}&to=${localDate}`,
      ),
    enabled: formOpen && !editTarget,
  });
  // Only fetched while the form that would show them is actually open —
  // otherwise every Today page load would fetch shortcuts nobody asked for.
  const presetsQuery = useQuery({
    queryKey: ['additional-activity-presets'],
    queryFn: () => api.get<{ items: AdditionalActivityPreset[] }>('/additional-activity-presets'),
    enabled: formOpen && !editTarget,
  });
  const recentSuggestions: RecentActivitySuggestion[] = recentsQuery.data?.items
    ? deriveRecentActivitySuggestions(recentsQuery.data.items)
    : [];

  // Story 42 — a new activity's distance unit defaults to the user's
  // preference; editing an existing one still preserves its own stored
  // unit (see draftFromActivity).
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => api.get<User>('/me') });
  const preferredDistanceUnit = meQuery.data?.preferredUnits === 'metric' ? 'km' : 'mi';

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['additional-activities', localDate] });

  function openAdd() {
    setEditTarget(null);
    setDraft(emptyDraft(preferredDistanceUnit));
    setPresetTitleDraft('');
    setFormOpen(true);
  }

  function openEdit(activity: AdditionalActivity) {
    setEditTarget(activity);
    setDraft(draftFromActivity(activity));
    setFormOpen(true);
  }

  // Story 43 — a tapped shortcut prefills the form for review, it never
  // saves directly: the user still has to hit Save, and can change
  // anything first (AC: "user can modify values before save").
  function applySuggestion(suggestion: RecentActivitySuggestion) {
    setDraft((prev) => ({
      ...prev,
      activityType: suggestion.activityType,
      title: suggestion.title ?? '',
      duration: toDurationDraft(suggestion.durationSeconds),
      distanceValue: suggestion.distanceValue != null ? String(suggestion.distanceValue) : '',
      distanceUnit: suggestion.distanceUnit ?? prev.distanceUnit,
    }));
  }

  function buildBody() {
    // A field the current activity type doesn't show is omitted entirely
    // (undefined, dropped by JSON.stringify) rather than forced to null.
    // On create that's equivalent — an absent column still inserts null —
    // but on update it's essential: the PATCH route only touches a field
    // when its key is present at all, so sending an explicit `null` for an
    // excluded-but-currently-populated field (e.g. editing a `walk` that
    // already has a `title` from when it was created as `other`) would
    // silently wipe data the user never asked to change.
    const fields = new Set(getAdditionalActivityFields(draft.activityType));
    return {
      activityType: draft.activityType,
      title: fields.has('title') ? draft.title || null : undefined,
      durationSeconds: fields.has('duration')
        ? (validateDurationDraft(draft.duration).totalSeconds ?? undefined)
        : undefined,
      distanceValue: fields.has('distance') && draft.distanceValue ? Number(draft.distanceValue) : undefined,
      distanceUnit: fields.has('distance') && draft.distanceValue ? draft.distanceUnit : undefined,
      // `${localDate}T${startTime}:00` (no offset) parses as local wall-clock
      // time in the browser; converting to an ISO string is both what the
      // API's z.string().datetime() requires and the correct UTC instant.
      startedAt: fields.has('startTime') && draft.startTime ? new Date(`${localDate}T${draft.startTime}:00`).toISOString() : undefined,
      notes: fields.has('notes') ? draft.notes || null : undefined,
    };
  }

  const createMutation = useMutation({
    mutationFn: () => api.post('/additional-activities', { localDate, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...buildBody() }),
    onSuccess: async () => {
      await refresh();
      setFormOpen(false);
      toast.show({ variant: 'success', message: `${activityTypeLabels[draft.activityType]} added.` });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not save activity.' }),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/additional-activities/${editTarget!.id}`, buildBody()),
    onSuccess: async () => {
      await refresh();
      setFormOpen(false);
      toast.show({ variant: 'success', message: 'Activity updated.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not update activity.' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/additional-activities/${id}`),
    onSuccess: async () => {
      await refresh();
      setPendingDelete(null);
      toast.show({ variant: 'success', message: 'Activity removed.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not remove activity.' }),
  });

  const refreshPresets = () => queryClient.invalidateQueries({ queryKey: ['additional-activity-presets'] });

  const savePresetMutation = useMutation({
    mutationFn: () => {
      const fields = new Set(getAdditionalActivityFields(draft.activityType));
      return api.post('/additional-activity-presets', {
        title: presetTitleDraft.trim(),
        activityType: draft.activityType,
        defaultDurationSeconds: fields.has('duration')
          ? (validateDurationDraft(draft.duration).totalSeconds ?? undefined)
          : undefined,
        defaultDistanceValue: fields.has('distance') && draft.distanceValue ? Number(draft.distanceValue) : undefined,
        defaultDistanceUnit: fields.has('distance') && draft.distanceValue ? draft.distanceUnit : undefined,
        defaultNotes: fields.has('notes') ? draft.notes || undefined : undefined,
      });
    },
    onSuccess: async () => {
      await refreshPresets();
      setPresetTitleDraft('');
      toast.show({ variant: 'success', message: 'Quick activity saved.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not save quick activity.' }),
  });

  const deletePresetMutation = useMutation({
    mutationFn: (id: string) => api.del(`/additional-activity-presets/${id}`),
    onSuccess: refreshPresets,
    onError: () => toast.show({ variant: 'error', message: 'Could not remove quick activity.' }),
  });

  const items = query.data?.items ?? [];
  const visibleFields = new Set(getAdditionalActivityFields(draft.activityType));
  // Conservative minimum, per the story's steering doc: duration alone is
  // enough for most activities; "Other" additionally needs a name since an
  // unnamed custom activity is meaningless.
  /* A duration of zero is not a duration. `validateDurationDraft` returns
     null for an empty *or* all-zero draft, so both are blocked by the same
     rule rather than by two checks that could disagree. */
  const durationValidation = validateDurationDraft(draft.duration);
  const canSave =
    durationValidation.totalSeconds != null &&
    Object.keys(durationValidation.errors).length === 0 &&
    (!visibleFields.has('title') || draft.title.trim() !== '');

  return (
    <SectionCard aria-label="Additional activity">
      <SectionHeader>
        <SectionTitle>Additional activity</SectionTitle>
        <IconButton aria-label="Add activity" onClick={openAdd}>
          <Plus size={16} />
        </IconButton>
      </SectionHeader>

      {query.isLoading ? <Skeleton $height={40} /> : null}

      {query.isError ? (
        <ErrorRow>
          <EmptyText>Couldn't load additional activity.</EmptyText>
          <Button variant="secondary" onClick={() => query.refetch()}>
            Retry
          </Button>
        </ErrorRow>
      ) : null}

      {!query.isLoading && !query.isError && items.length === 0 ? (
        <>
          <EmptyText>Add walks, mobility, yoga, or anything else you do outside today's planned workout.</EmptyText>
          <Button variant="secondary" onClick={openAdd}>
            <Plus size={16} /> Add activity
          </Button>
        </>
      ) : null}

      {items.length > 0 ? (
        <RowList>
          {items.map((activity) => {
            const duration = formatActivityDuration(activity.durationSeconds);
            const time = formatActivityTime(activity.startedAt);
            const detailBits = [
              duration,
              activity.distanceValue != null ? `${activity.distanceValue} ${activity.distanceUnit ?? 'mi'}` : null,
              time,
              activity.source === 'apple_health' ? 'Apple Health' : null,
            ].filter(Boolean);
            return (
              <Row key={activity.id}>
                <RowMeta>
                  <RowTitle>{activity.title || activityTypeLabels[activity.activityType]}</RowTitle>
                  {detailBits.length ? <RowDetail>{detailBits.join(' · ')}</RowDetail> : null}
                </RowMeta>
                <RowActions>
                  <IconButton aria-label={`Edit ${activityTypeLabels[activity.activityType]}`} onClick={() => openEdit(activity)}>
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton aria-label={`Delete ${activityTypeLabels[activity.activityType]}`} onClick={() => setPendingDelete(activity)}>
                    <Trash2 size={14} />
                  </IconButton>
                </RowActions>
              </Row>
            );
          })}
        </RowList>
      ) : null}

      <Modal
        presentation="task"
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? 'Edit activity' : 'Add activity'}
      >
        <FormGrid>
          {!editTarget && (recentSuggestions.length > 0 || (presetsQuery.data?.items?.length ?? 0) > 0) ? (
            <QuickAddSection>
              <QuickAddLabel>Quick add</QuickAddLabel>
              <ChipRow>
                {(presetsQuery.data?.items ?? []).map((preset) => (
                  <Chip key={preset.id}>
                    <ChipLabel
                      type="button"
                      onClick={() =>
                        applySuggestion({
                          activityType: preset.activityType,
                          // "Other" is the one type with a required name
                          // field — the preset's own title is the only
                          // sensible default for it, otherwise applying the
                          // shortcut would leave Save permanently disabled
                          // until the user retyped the name by hand.
                          title: preset.activityType === 'other' ? preset.title : null,
                          durationSeconds: preset.defaultDurationSeconds,
                          distanceValue: preset.defaultDistanceValue,
                          distanceUnit: preset.defaultDistanceUnit,
                        })
                      }
                    >
                      {preset.title}
                    </ChipLabel>
                    <ChipRemove
                      type="button"
                      aria-label={`Remove ${preset.title} shortcut`}
                      onClick={() => deletePresetMutation.mutate(preset.id)}
                    >
                      ×
                    </ChipRemove>
                  </Chip>
                ))}
                {recentSuggestions.map((suggestion, index) => (
                  <ChipButton key={`recent-${index}`} type="button" onClick={() => applySuggestion(suggestion)}>
                    {suggestionLabel(suggestion)}
                  </ChipButton>
                ))}
              </ChipRow>
            </QuickAddSection>
          ) : null}
          <Select
            label="Activity"
            options={activityTypeOptions}
            value={draft.activityType}
            onChange={(event) => setDraft((prev) => ({ ...prev, activityType: event.target.value as AdditionalActivityType }))}
          />
          {visibleFields.has('title') ? (
            <Input
              label="Activity name"
              value={draft.title}
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            />
          ) : null}
          {visibleFields.has('duration') ? (
            <DurationInput
              value={draft.duration}
              onChange={(duration) => setDraft((prev) => ({ ...prev, duration }))}
            />
          ) : null}
          {visibleFields.has('distance') ? (
            <Input
              label="Distance"
              unit={draft.distanceUnit}
              type="number"
              inputMode="decimal"
              value={draft.distanceValue}
              onChange={(event) => setDraft((prev) => ({ ...prev, distanceValue: event.target.value }))}
            />
          ) : null}
          {visibleFields.has('startTime') ? (
            <Input
              label="Start time"
              type="time"
              value={draft.startTime}
              onChange={(event) => setDraft((prev) => ({ ...prev, startTime: event.target.value }))}
            />
          ) : null}
          {visibleFields.has('notes') ? (
            <Input
              label="Notes"
              value={draft.notes}
              onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
            />
          ) : null}
          {!editTarget ? (
            <SavePresetRow>
              <Input
                label="Save as quick activity"
                placeholder="e.g. Post-meal walk"
                value={presetTitleDraft}
                onChange={(event) => setPresetTitleDraft(event.target.value)}
              />
              <Button
                variant="secondary"
                onClick={() => savePresetMutation.mutate()}
                disabled={!presetTitleDraft.trim() || !canSave || savePresetMutation.isPending}
              >
                Save shortcut
              </Button>
            </SavePresetRow>
          ) : null}
          <Actions>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => (editTarget ? updateMutation.mutate() : createMutation.mutate())}
              disabled={!canSave || createMutation.isPending || updateMutation.isPending}
              status={createMutation.isPending || updateMutation.isPending ? 'loading' : 'idle'}
            >
              Save
            </Button>
          </Actions>
        </FormGrid>
      </Modal>

      <Modal
        presentation="compact"
        open={pendingDelete != null}
        onClose={() => setPendingDelete(null)}
        title="Remove this activity?"
        description={pendingDelete ? `${activityTypeLabels[pendingDelete.activityType]} will be removed from today.` : undefined}
      >
        <Actions>
          <Button variant="secondary" onClick={() => setPendingDelete(null)}>
            Cancel
          </Button>
          <Button onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)} disabled={deleteMutation.isPending}>
            Remove
          </Button>
        </Actions>
      </Modal>
    </SectionCard>
  );
}
