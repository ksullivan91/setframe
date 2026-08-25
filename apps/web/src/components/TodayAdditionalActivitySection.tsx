import { useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { AdditionalActivity, AdditionalActivityType } from '@setframe/schemas';
import { radius, spacing } from '@setframe/design-tokens';
import { Button } from './Button';
import { Card } from './Card';
import { IconButton } from './IconButton';
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

function formatActivityDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function formatActivityTime(startedAt: string | null): string | null {
  if (!startedAt) return null;
  return new Date(startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

interface ActivityDraft {
  activityType: AdditionalActivityType;
  durationMinutes: string;
  distanceValue: string;
  distanceUnit: 'm' | 'km' | 'mi';
  startTime: string;
  notes: string;
}

function emptyDraft(): ActivityDraft {
  return { activityType: 'walk', durationMinutes: '', distanceValue: '', distanceUnit: 'mi', startTime: '', notes: '' };
}

// The <input type="time"> field works in local wall-clock time, but
// `startedAt` is stored/returned as a UTC ISO string — slicing its UTC
// hour directly (rather than converting) shows/re-saves the wrong time
// whenever the browser's timezone isn't UTC.
function draftFromActivity(activity: AdditionalActivity): ActivityDraft {
  const local = activity.startedAt ? new Date(activity.startedAt) : null;
  return {
    activityType: activity.activityType,
    durationMinutes: activity.durationSeconds != null ? String(Math.round(activity.durationSeconds / 60)) : '',
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

/**
 * Story 41 — a distinct, visually-secondary section for supplemental
 * movement (walks, yoga, mobility) outside the scheduled workout. Fetches
 * independently of Today's main dashboard query, so a failed activity
 * request degrades this section alone and never blocks the scheduled
 * workout from rendering (per the story's steering doc).
 *
 * The add/edit form here is intentionally generic (every field, always
 * visible) — Story 42 replaces it with type-driven "relevant fields only"
 * inputs. Edit/delete on existing rows is this story's own scope.
 */
export function TodayAdditionalActivitySection({ localDate }: { localDate: string }) {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdditionalActivity | null>(null);
  const [draft, setDraft] = useState<ActivityDraft>(emptyDraft());
  const [pendingDelete, setPendingDelete] = useState<AdditionalActivity | null>(null);

  const query = useQuery({
    queryKey: ['additional-activities', localDate],
    queryFn: () => api.get<{ items: AdditionalActivity[] }>(`/additional-activities?localDate=${localDate}`),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['additional-activities', localDate] });

  function openAdd() {
    setEditTarget(null);
    setDraft(emptyDraft());
    setFormOpen(true);
  }

  function openEdit(activity: AdditionalActivity) {
    setEditTarget(activity);
    setDraft(draftFromActivity(activity));
    setFormOpen(true);
  }

  function buildBody() {
    return {
      activityType: draft.activityType,
      durationSeconds: draft.durationMinutes ? Math.round(Number(draft.durationMinutes) * 60) : null,
      distanceValue: draft.distanceValue ? Number(draft.distanceValue) : null,
      distanceUnit: draft.distanceValue ? draft.distanceUnit : null,
      // `${localDate}T${startTime}:00` (no offset) parses as local wall-clock
      // time in the browser; converting to an ISO string is both what the
      // API's z.string().datetime() requires and the correct UTC instant.
      startedAt: draft.startTime ? new Date(`${localDate}T${draft.startTime}:00`).toISOString() : null,
      notes: draft.notes || null,
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

  const items = query.data?.items ?? [];

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
                  <RowTitle>{activityTypeLabels[activity.activityType]}</RowTitle>
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
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? 'Edit activity' : 'Add activity'}
      >
        <FormGrid>
          <Select
            label="Activity"
            options={activityTypeOptions}
            value={draft.activityType}
            onChange={(event) => setDraft((prev) => ({ ...prev, activityType: event.target.value as AdditionalActivityType }))}
          />
          <Input
            label="Duration"
            unit="min"
            type="number"
            inputMode="numeric"
            value={draft.durationMinutes}
            onChange={(event) => setDraft((prev) => ({ ...prev, durationMinutes: event.target.value }))}
          />
          <Input
            label="Distance"
            unit="mi"
            type="number"
            inputMode="decimal"
            value={draft.distanceValue}
            onChange={(event) => setDraft((prev) => ({ ...prev, distanceValue: event.target.value }))}
          />
          <Input
            label="Start time"
            type="time"
            value={draft.startTime}
            onChange={(event) => setDraft((prev) => ({ ...prev, startTime: event.target.value }))}
          />
          <Input
            label="Notes"
            value={draft.notes}
            onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
          />
          <Actions>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => (editTarget ? updateMutation.mutate() : createMutation.mutate())}
              disabled={createMutation.isPending || updateMutation.isPending}
              status={createMutation.isPending || updateMutation.isPending ? 'loading' : 'idle'}
            >
              Save
            </Button>
          </Actions>
        </FormGrid>
      </Modal>

      <Modal
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
