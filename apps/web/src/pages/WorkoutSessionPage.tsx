import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Check, ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  Exercise,
  Prescription,
  WorkoutSessionDetail,
  WorkoutSessionExerciseDetail,
  WorkoutSet,
  WorkoutSetPreviousPerformance,
} from '@setframe/schemas';
import {
  beginSync,
  calculateVolume,
  describeQuickLogAction,
  estimateOneRepMax,
  isExerciseComplete,
  isQuickLogComplete,
  quickLogFields,
  hasSyncError,
  isCurrentAttempt,
  isSaving,
  plannedQuickLogSeed,
  quickLogTargets as quickLogTargetsFor,
  settleSync,
  buildCompletedExerciseReadout,
  completedSetCountLabel,
  supportsQuickLog,
  visibleSessionExercises,
  type SyncMap,
} from '@setframe/domain';
import { radius, spacing } from '@setframe/design-tokens';
import { AsyncStatusIndicator, Badge, Button, Card, IconButton, Input, Menu, Modal, PRBadge, Select, Skeleton, SkeletonStack, useAsyncStatus, useToast } from '../components';
import { AddExercisePicker } from '../components/AddExercisePicker';
import { useApiClient } from '../lib/api-client';
import {
  countsTowardVolume,
  formatSessionSet,
  getPrescriptionDefinition,
  getSessionFieldLabel,
  isSessionSetLogged,
  resolveSessionFields,
  summarizePrescription,
  validateSessionSet,
  type PrescriptionDefinition,
  type SessionField,
} from '../lib/prescription';
import { typeScale } from '../theme/typeScale';
import { CompletedExerciseSummary } from '../components/CompletedExerciseCard';
import { ExerciseWorkCard } from '../components/ExerciseWorkCard';
import { mq } from '../theme/breakpoints';

type SetType = WorkoutSet['setType'];

interface DraftValues {
  setType: SetType;
  weightValue: string;
  reps: string;
  durationSeconds: string;
  distanceValue: string;
  distanceUnit: 'm' | 'km' | 'mi';
  rpe: string;
}

interface RemovalCandidate {
  setId: string;
  exerciseLogId: string;
  label: string;
}

interface ExerciseRemovalCandidate {
  exerciseLogId: string;
  name: string;
  loggedSetCount: number;
}

/**
 * Story 36: no shared height token exists for AppShell's bottom nav (it's
 * sized by its own intrinsic content, not a fixed value) — this
 * approximates its rendered height on mobile, already relied on by
 * `Page`'s own padding-bottom below. Reused for `SessionActionBar` so the
 * new sticky action bar sits directly above the nav, and by `Page` again
 * so scrolled content clears both. Safe-area is handled separately via
 * `env()`, so this deliberately excludes it.
 */
const BOTTOM_NAV_HEIGHT_PX = 72;
/** Approximate rendered height of `SessionActionBar` on mobile (padding +
 * one row of 44px buttons) — `Page` needs this on top of the nav height
 * above so the last exercise card can scroll fully clear of both. */
const SESSION_ACTION_BAR_HEIGHT_PX = 68;

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
  padding-bottom: calc(
    ${spacing[24]}px + ${BOTTOM_NAV_HEIGHT_PX}px + ${SESSION_ACTION_BAR_HEIGHT_PX}px + env(safe-area-inset-bottom)
  );

  ${mq.tablet} {
    /* AppShell's nav is the static side sidebar from here up — no bottom
       bar left to clear, and SessionActionBar switches to sticky-in-flow. */
    padding-bottom: ${spacing[24]}px;
  }

  ${mq.desktop} {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
    align-items: start;
    gap: ${spacing[24]}px;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  align-items: flex-start;
  flex-wrap: wrap;
  grid-column: 1 / -1;
`;

const HeaderMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${typeScale.pageTitle.fontSize}px;
`;

const Subtitle = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[8]}px;
  align-items: center;
  justify-content: flex-end;
`;

/**
 * Story 36: session-level actions (Add exercise / Finish workout) stay
 * reachable during a long workout instead of requiring a scroll back to
 * the header. Mobile: a compact bar fixed above AppShell's bottom nav.
 * From `tablet` width up, AppShell's nav is the static side sidebar (no
 * bottom bar left to clear), so this switches to a sticky-in-flow header
 * row instead — same markup, same handlers, just a different container
 * (per the story's "persistent reachability, not identical geometry").
 */
const SessionActionBar = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  /* The nav's own height already grows by env(safe-area-inset-bottom) on
     notched iPhones (AppShell.tsx's Sidebar), so this has to add that same
     term back on top of BOTTOM_NAV_HEIGHT_PX's non-safe-area estimate —
     without it, the bar sits low enough to overlap the top of the nav. */
  bottom: calc(${BOTTOM_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom));
  z-index: 15;
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  /* No extra safe-area padding needed here, unlike the nav bar itself —
     this bar sits above the nav (via the bottom offset above), not at
     the true screen edge, so the nav already clears the home indicator. */
  padding: ${spacing[8]}px ${spacing[16]}px;
  background: ${(p) => p.theme.surface.raised};
  border-top: 1px solid ${(p) => p.theme.border.subtle};
  grid-column: 1 / -1;

  ${mq.tablet} {
    position: sticky;
    top: ${spacing[16]}px;
    left: auto;
    right: auto;
    bottom: auto;
    z-index: 5;
    justify-content: flex-end;
    padding: ${spacing[12]}px ${spacing[16]}px;
    border: 1px solid ${(p) => p.theme.border.subtle};
    border-radius: ${radius.small}px;
  }
`;

const SessionActionBarButton = styled.div`
  flex: 1;

  ${mq.tablet} {
    flex: initial;
  }
`;

const FullWidthButton = styled(Button)`
  width: 100%;

  ${mq.tablet} {
    width: auto;
  }
`;

const SummaryCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;

  ${mq.desktop} {
    position: sticky;
    top: ${spacing[24]}px;
  }
`;

const SummaryTitle = styled.h2`
  margin: 0;
  font-size: ${typeScale.sectionTitle.fontSize}px;
`;

const SummaryStat = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: ${spacing[8]}px;
`;

const SummaryLabel = styled.span`
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const SummaryValue = styled.span`
  font-size: ${typeScale.numericMetric.fontSize}px;
  font-weight: ${typeScale.numericMetric.fontWeight};
  font-variant-numeric: tabular-nums;
`;

const ExerciseList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
  grid-column: 1;
`;

/**
 * Story 61, corrected by story 42.
 *
 * The completed surface used to be `action.accentSubtle` — the lavender that
 * means *selected* everywhere else in the product — with a hairline success
 * border. Two things were wrong with that. Semantically it said "this one is
 * picked", not "this one is done". Visually the tint was the loudest thing on
 * the screen, so finished work drew more attention than the exercise the user
 * still had to do.
 *
 * It is now a genuine success tint, and the state is carried mostly by the
 * card's *contents* (see `CompletedExerciseCard`) rather than by its fill, so
 * colour is a reinforcement rather than the message.
 */
const ExerciseCard = styled(Card)<{ $complete?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
  border: 1px solid ${(p) => (p.$complete ? p.theme.status.success : 'transparent')};
  background: ${(p) => (p.$complete ? p.theme.status.successSubtle : p.theme.surface.raised)};
  transition: background 160ms ease-out, border-color 160ms ease-out;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  /* Story 39: scrollIntoView's target for a newly-active exercise stays
     clear of the sticky session action bar (Story 36), which only
     floats over content below tablet width. */
  scroll-margin-bottom: calc(${BOTTOM_NAV_HEIGHT_PX}px + ${SESSION_ACTION_BAR_HEIGHT_PX}px);

  ${mq.tablet} {
    scroll-margin-bottom: ${spacing[16]}px;
  }
`;

/**
 * The completion stamp, in the card's leading slot.
 *
 * Story 42A put status on the left and navigation on the right so the two
 * never trade places; the work card keeps that arrangement.
 */
const CompletionMark = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: ${radius.full}px;
  background: ${(p) => p.theme.status.success};
  color: ${(p) => p.theme.action.primaryText};
  box-shadow: 0 0 0 4px ${(p) => p.theme.status.successSubtle};
`;

const ExerciseHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const ExerciseTitle = styled.h2`
  margin: 0;
  font-size: ${typeScale.sectionTitle.fontSize}px;
`;

const ExerciseTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
`;

const SupportingText = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

/**
 * Story 37: the common-value entry point above the full set editor — set
 * a value once here and apply it to every set instead of repeating it per
 * row (see `QuickEntryFooter`'s "Apply to all sets"). Only the fields
 * relevant to this exercise's representation render, same as `SetGrid`.
 */
/**
 * Story 58 — Quick Log reads as a compact action panel, not as a second copy
 * of the set editor stacked above the first.
 *
 * The previous version was a bare grid of inputs sharing the card's own
 * surface, directly above the individual set rows, which is exactly why it
 * looked like another set editor: nothing separated "log the normal case" from
 * "customise a specific set". The tint, the border and the explicit label are
 * doing the work of saying which question this region answers.
 */
const QuickLogPanel = styled.section`
  display: grid;
  gap: ${spacing[8]}px;
  padding: ${spacing[12]}px;
  border-radius: ${radius.small}px;
  border: 1px solid ${(p) => p.theme.border.subtle};
  background: ${(p) => p.theme.surface.sunken};
`;

const QuickLogHeading = styled.h3`
  margin: 0;
  font-size: ${typeScale.label.fontSize}px;
  font-weight: 600;
  color: ${(p) => p.theme.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

/**
 * One or two columns, never `auto-fit`. The previous grid packed as many
 * fields as fitted, so weight and reps landed on one row at some widths and
 * two at others, and the mobile alignment the gym test complained about was
 * a direct result. Two columns is the shape of every representation this
 * panel actually offers.
 */
const QuickLogFields = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[8]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

/** Two fields side by side even on the narrowest screen. */
const QuickLogPair = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${spacing[8]}px;
`;

/**
 * Sits below the fields at full width. A right-aligned secondary button read
 * as an afterthought; this is the primary action of the whole card.
 */
const QuickLogAction = styled.div`
  display: grid;
`;

const DetailedSetsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[8]}px;
`;

const PreviousSessionCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: ${radius.small}px;
  padding: ${spacing[12]}px;
  background: ${(p) => p.theme.surface.sunken};
`;

const PreviousSessionGrid = styled.div`
  display: grid;
  gap: ${spacing[8]}px;
`;

const PreviousSessionRow = styled.div`
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: ${spacing[8]}px;
  align-items: baseline;
`;

const PreviousSessionLabel = styled.span`
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const SetList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const SetCard = styled.div`
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: ${radius.small}px;
  padding: ${spacing[12]}px;
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const SetCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const SetTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
`;

const SetTitle = styled.h3`
  margin: 0;
  font-size: ${typeScale.body.fontSize}px;
`;

const Chips = styled.div`
  display: flex;
  gap: ${spacing[8]}px;
  flex-wrap: wrap;
  align-items: center;
`;

/**
 * The planned target, as a pill.
 *
 * Story 42C. This was a grey chip on `surface.sunken`, which put the plan in
 * the same visual register as every other passive label and left it competing
 * with the actual logged values beside it. It now uses the accent purple —
 * the product's one "this is Setframe telling you something" colour — with
 * white text.
 *
 * Deliberately state-independent: it never turns green when the set or the
 * workout completes. The pill means *planned target*, not *done*, and a
 * plan that changes colour on completion reads as a second status signal
 * competing with the real one.
 */
const CuePill = styled.span`
  padding: ${spacing[4]}px ${spacing[8]}px;
  border-radius: 999px;
  background: ${(p) => p.theme.action.primary};
  color: ${(p) => p.theme.action.primaryText};
  font-size: ${typeScale.helper.fontSize}px;
  font-weight: 600;
  /* A long representation-aware target ("3 mi · 30 min") must wrap inside the
     pill rather than push the set card into horizontal overflow. */
  overflow-wrap: anywhere;
`;

const SetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${spacing[8]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const SetFooter = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  align-items: center;
  flex-wrap: wrap;
`;

const SetActions = styled.div`
  display: flex;
  gap: ${spacing[8]}px;
  align-items: center;
  margin-left: auto;
`;

const AddSetButtonWrap = styled.div`
  width: 100%;

  ${mq.tablet} {
    width: auto;
  }
`;

const ExerciseHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  width: 100%;

  ${mq.tablet} {
    width: auto;
  }
`;

const EmptyText = styled.p`
  color: ${(p) => p.theme.text.secondary};
  margin: 0;
`;

const setTypeOptions = [
  { value: 'warmup', label: 'Warmup' },
  { value: 'working', label: 'Working' },
  { value: 'top', label: 'Top set' },
  { value: 'backoff', label: 'Backoff' },
  { value: 'drop', label: 'Drop' },
  { value: 'failure', label: 'Failure' },
];

const distanceUnitOptions = [
  { value: 'm', label: 'm' },
  { value: 'km', label: 'km' },
  { value: 'mi', label: 'mi' },
];

function formatElapsed(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const totalMinutes = Math.max(0, Math.round((end - start) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getDefaultSetType(sets: WorkoutSet[]): SetType {
  const lastType = sets.at(-1)?.setType;
  if (lastType === 'warmup') return 'working';
  return lastType ?? 'working';
}

/* Duration is always persisted in seconds. Continuous efforts (a 30 minute
   ride) are far more natural to type in minutes, so the draft holds the
   displayed unit and converts on the way in and out. */
function secondsToDisplay(seconds: number | null, definition: PrescriptionDefinition): string {
  if (seconds == null) return '';
  if (definition.units.duration !== 'minutes') return seconds.toString();
  const minutes = seconds / 60;
  return (Number.isInteger(minutes) ? minutes : Number(minutes.toFixed(2))).toString();
}

function displayToSeconds(value: string, definition: PrescriptionDefinition): number | undefined {
  const parsed = parseOptionalNumber(value);
  if (parsed == null) return undefined;
  return definition.units.duration === 'minutes' ? Math.round(parsed * 60) : parsed;
}

function getDraft(set: WorkoutSet, definition: PrescriptionDefinition): DraftValues {
  return {
    setType: set.setType,
    weightValue: set.weightValue?.toString() ?? '',
    reps: set.reps?.toString() ?? '',
    durationSeconds: secondsToDisplay(set.durationSeconds, definition),
    distanceValue: set.distanceValue?.toString() ?? '',
    distanceUnit: set.distanceUnit ?? definition.units.distance,
    rpe: set.rpe?.toString() ?? '',
  };
}

/**
 * Story 37: the quick-entry header's starting point. The first set already
 * carries the template's prefill (session-start expands the prescription
 * onto every set — weight left blank, everything else pre-populated), so
 * reusing it here means the header never has to re-derive prescription
 * defaults on its own and can't drift from what "Add set" already does.
 * An exercise with no sets yet just starts blank.
 */
/**
 * The quick-log draft's starting values.
 *
 * Story 42.3. This used to copy the first *set row*, which worked only
 * because session start wrote planned values onto those rows — the very
 * conflation 42.1 removed. With rows now empty, copying one seeds nothing, so
 * the plan is read from the prescription instead.
 *
 * Seeding is a convenience, never a claim: nothing here is persisted, and
 * completion is still derived from what the server holds. An already-logged
 * set still wins, so reopening an exercise shows what was actually done
 * rather than what was planned.
 */
function getHeaderDraft(exerciseLog: WorkoutSessionExerciseDetail, definition: PrescriptionDefinition): DraftValues {
  const firstSet = exerciseLog.sets[0];
  const fromSet = firstSet ? getDraft(firstSet, definition) : null;
  if (fromSet && isSessionSetLogged(exerciseLog.prescription, firstSet!)) return fromSet;

  const seed = plannedQuickLogSeed(exerciseLog.prescription);
  return {
    setType: 'working',
    weightValue: '',
    reps: seed.reps != null ? String(seed.reps) : '',
    durationSeconds:
      seed.durationSeconds != null ? secondsToDisplay(seed.durationSeconds, definition) : '',
    distanceValue: seed.distanceValue != null ? String(seed.distanceValue) : '',
    distanceUnit: seed.distanceUnit ?? definition.units.distance,
    rpe: '',
  };
}

/** Copies one key from a source DraftValues onto a patch, preserving its
 * type — a generic helper so `applyHeaderToAllSets` can iterate an
 * arbitrary list of touched keys without an `any` cast. */
function copyDraftKey<K extends keyof DraftValues>(target: Partial<DraftValues>, source: DraftValues, key: K) {
  target[key] = source[key];
}

/**
 * What the plan asks for, from the plan.
 *
 * Story 42.1. This used to read `exerciseLog.sets[index]` — the *persisted set
 * row* — and label whatever it found "Planned". Since session start copied
 * planned values onto those rows, plan and actual were literally the same
 * field, which is the conflation that let a planned value count as logged
 * work. Now that rows start empty, reading them would show a blank plan.
 *
 * The prescription snapshot on the exercise log is the source of truth for
 * intent (ADR 0005), and it is what a session renders from for exactly this
 * reason: editing a template later must never change how a logged session
 * reads.
 */
function getPlannedValue(exerciseLog: WorkoutSessionExerciseDetail) {
  const summary = summarizePrescription(exerciseLog.prescription).replace(/^Planned:\s*/, '');
  return summary === 'No target set' ? null : summary;
}

function getPreviousSet(
  previousSessionSet: WorkoutSetPreviousPerformance | undefined,
  exerciseLog: WorkoutSessionExerciseDetail,
) {
  if (!previousSessionSet) return null;
  return formatSessionSet(exerciseLog.prescription, previousSessionSet, { includeRpe: true }) || '—';
}

/* Only fields the user can actually see are submitted. A hidden field is
   omitted from the patch entirely rather than sent as null, so switching an
   exercise's prescription never silently wipes data the user cannot see. */
function buildPatch(existing: WorkoutSet, draft: DraftValues, visible: SessionField[], definition: PrescriptionDefinition) {
  const patch: Record<string, unknown> = {};

  if (visible.includes('setType')) patch.setType = draft.setType;
  if (visible.includes('weight')) {
    const weightValue = parseOptionalNumber(draft.weightValue);
    patch.weightValue = weightValue;
    patch.weightUnit = weightValue != null ? existing.weightUnit ?? 'lb' : undefined;
  }
  if (visible.includes('reps')) patch.reps = parseOptionalNumber(draft.reps);
  if (visible.includes('duration')) patch.durationSeconds = displayToSeconds(draft.durationSeconds, definition);
  if (visible.includes('distance')) {
    const distanceValue = parseOptionalNumber(draft.distanceValue);
    patch.distanceValue = distanceValue;
    patch.distanceUnit = distanceValue != null ? draft.distanceUnit : undefined;
  }
  if (visible.includes('rpe')) patch.rpe = parseOptionalNumber(draft.rpe);

  return patch;
}

const patchKeysByField: Record<SessionField, (keyof WorkoutSet)[]> = {
  setType: ['setType'],
  weight: ['weightValue'],
  reps: ['reps'],
  duration: ['durationSeconds'],
  distance: ['distanceValue', 'distanceUnit'],
  rpe: ['rpe'],
};

function hasChanges(existing: WorkoutSet, draft: DraftValues, visible: SessionField[], definition: PrescriptionDefinition) {
  const next = buildPatch(existing, draft, visible, definition) as Partial<Record<keyof WorkoutSet, unknown>>;
  return visible.some((field) =>
    patchKeysByField[field].some((key) => {
      if (!(key in next)) return false;
      return (next[key] ?? null) !== existing[key];
    }),
  );
}

function draftToValues(draft: DraftValues, definition: PrescriptionDefinition) {
  return {
    setType: draft.setType,
    weightValue: parseOptionalNumber(draft.weightValue) ?? null,
    reps: parseOptionalNumber(draft.reps) ?? null,
    durationSeconds: displayToSeconds(draft.durationSeconds, definition) ?? null,
    distanceValue: parseOptionalNumber(draft.distanceValue) ?? null,
    rpe: parseOptionalNumber(draft.rpe) ?? null,
  };
}

export function WorkoutSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  // Story 37: a separate, exercise-level draft for the quick-entry header —
  // distinct from any one set's own draft, since it's a value to apply, not
  // a value that's itself logged.
  const [headerDrafts, setHeaderDrafts] = useState<Record<string, DraftValues>>({});
  // Story 37: which DraftValues keys the user has actually edited in the
  // header since it was last reset — Apply to all sets must only ever
  // patch these, not every quick-entry field, or changing just reps would
  // silently blow away a sibling set's own distinct weight/duration/etc.
  // Tracked at the key level (not the coarser SessionField level) so
  // touching only the distance *unit* dropdown doesn't also drag the
  // distance *value* along — they're one field, but two independent keys.
  // Cleared after a successful Apply and whenever a set is added, so a
  // stale earlier edit can never silently reapply on a later, unrelated
  // click.
  const [headerTouchedKeys, setHeaderTouchedKeys] = useState<Record<string, (keyof DraftValues)[]>>({});
  // Story 39: single-active-exercise accordion — at most one exercise is
  // expanded at a time. `null` means none are (every exercise manually
  // collapsed, or nothing loaded yet); seeded to the first exercise once
  // the session loads (see the effect below), not left "all expanded",
  // since only one can be active from the very first render.
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const exerciseCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [elapsedTick, setElapsedTick] = useState(0);
  const [pendingRemoval, setPendingRemoval] = useState<RemovalCandidate | null>(null);
  const [pendingExerciseRemoval, setPendingExerciseRemoval] = useState<ExerciseRemovalCandidate | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const lastMutationRef = useRef<(() => Promise<unknown>) | null>(null);
  const inlineStatus = useAsyncStatus();

  const query = useQuery({
    queryKey: ['workout-session', sessionId],
    queryFn: () => api.get<WorkoutSessionDetail>(`/workout-sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<Exercise[]>('/exercises'),
  });

  useEffect(() => {
    if (query.data?.status === 'completed') return;
    const interval = setInterval(() => setElapsedTick((tick) => tick + 1), 60_000);
    return () => clearInterval(interval);
  }, [query.data?.status]);

  void elapsedTick;

  const refreshSession = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] }),
      queryClient.invalidateQueries({ queryKey: ['today'] }),
    ]);
  };

  /**
   * Story 59 — Quick Log persists. The old `Apply to all sets` only populated
   * the set inputs and left the user to expand the exercise and save each one,
   * which is why the "fast path" cost more taps than typing into the sets.
   *
   * One request rather than N sequential PATCHes, so the user is not
   * serialised behind the network for the most common case in the product.
   */
  /**
   * Story 42.4 — which exercises are mid-commit.
   *
   * `useMutation`'s own `isPending` is a single page-wide boolean, so quick
   * logging one exercise disabled the action on every other one. Mid-workout
   * that serialises the user behind the network in the place that least
   * tolerates it — the same defect story 60 fixed for per-set saves, still
   * present on the batch path.
   */
  const [quickLogPending, setQuickLogPending] = useState<Record<string, boolean>>({});

  const quickLogMutation = useMutation({
    mutationFn: ({
      exerciseLogId,
      setIds,
      values,
    }: {
      exerciseLogId: string;
      setIds: string[];
      values: Record<string, unknown>;
    }) => api.post<WorkoutSet[]>(`/workout-exercise-logs/${exerciseLogId}/quick-log`, { setIds, values }),
    /**
     * Optimistic commit. The user is between sets; waiting on a round trip
     * before the card acknowledges them is exactly the friction this story
     * exists to remove.
     *
     * The previous cache is snapshotted and restored on failure, so a rejected
     * write cannot leave the screen claiming work that was never saved —
     * "completion is never presented as durable when persistence failed".
     */
    onMutate: async (variables) => {
      setQuickLogPending((prev) => ({ ...prev, [variables.exerciseLogId]: true }));
      await queryClient.cancelQueries({ queryKey: ['workout-session', sessionId] });
      const previous = queryClient.getQueryData<WorkoutSessionDetail>(['workout-session', sessionId]);

      queryClient.setQueryData<WorkoutSessionDetail>(['workout-session', sessionId], (current) => {
        if (!current) return current;
        const targets = new Set(variables.setIds);
        return {
          ...current,
          exercises: current.exercises.map((exerciseLog) =>
            exerciseLog.id !== variables.exerciseLogId
              ? exerciseLog
              : {
                  ...exerciseLog,
                  sets: exerciseLog.sets.map((set) =>
                    targets.has(set.id) ? { ...set, ...(variables.values as Partial<WorkoutSet>) } : set,
                  ),
                },
          ),
        };
      });

      return { previous };
    },
    onSuccess: async (_, variables) => {
      /* The drafts these sets were showing are now stale — the server holds
         the truth. Clearing them stops a half-typed local value from
         reappearing over what was just logged. */
      setDrafts((prev) => {
        const next = { ...prev };
        for (const setId of variables.setIds) delete next[setId];
        return next;
      });
      setHeaderTouchedKeys((prev) => ({ ...prev, [variables.exerciseLogId]: [] }));
      await refreshSession();
    },
    onError: (_error, _variables, context) => {
      /* Roll back to exactly what was on screen before, so an optimistic
         update never outlives the request that justified it. Drafts are
         untouched — the user's typing survives a failed save. */
      if (context?.previous) {
        queryClient.setQueryData(['workout-session', sessionId], context.previous);
      }
/* Story 42.5 — reopen it. The optimistic completion auto-collapsed the
         exercise; rolling back leaves it incomplete again, and a collapsed
         card would hide both the failure and the values the user still needs
         to retry. Completion state and disclosure state have to fail
         together. */
      activateExercise(_variables.exerciseLogId);
      toast.show({ variant: 'error', message: 'Could not log those sets. Your values are still here — try again.' });
    },
    onSettled: (_data, _error, variables) => {
      setQuickLogPending((prev) => {
        const next = { ...prev };
        delete next[variables.exerciseLogId];
        return next;
      });
    },
  });

  const addSetMutation = useMutation({
    mutationFn: ({ exerciseLogId, sourceSet }: { exerciseLogId: string; sourceSet?: WorkoutSet }) =>
      api.post<WorkoutSet>(`/workout-exercise-logs/${exerciseLogId}/sets`, {
        clientId: crypto.randomUUID(),
        setType: sourceSet?.setType ?? 'working',
        weightValue: sourceSet?.weightValue ?? undefined,
        weightUnit: sourceSet?.weightValue != null ? sourceSet.weightUnit ?? 'lb' : undefined,
        reps: sourceSet?.reps ?? undefined,
        durationSeconds: sourceSet?.durationSeconds ?? undefined,
        distanceValue: sourceSet?.distanceValue ?? undefined,
        distanceUnit: sourceSet?.distanceValue != null ? sourceSet.distanceUnit ?? 'mi' : undefined,
        rpe: sourceSet?.rpe ?? undefined,
      }),
    onSuccess: async (_, variables) => {
      await refreshSession();
      // Story 37: a newly added set didn't exist when any header field was
      // marked touched, so a stale touched key could otherwise reapply to
      // it (and every other set) on the next unrelated Apply click.
      setHeaderTouchedKeys((prev) => ({ ...prev, [variables.exerciseLogId]: [] }));
      toast.show({ variant: 'success', message: 'Set added.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not add set.' }),
  });

  /**
   * Story 60 — saving one set must not block any other.
   *
   * A single `useMutation` exposes one `isPending` for every set that uses
   * it, so the previous Save button was disabled across the whole page while
   * any one set was in flight. The mutation stays shared; what is now
   * per-record is the *state*, keyed by set id in `syncMap`.
   *
   * Responses are settled by sequence number rather than by arrival, so a
   * slow first save cannot overwrite a fast second one — see `sync-status`.
   */
  const [syncMap, setSyncMap] = useState<SyncMap>({});
  /* A ref alongside the state, because sequence numbers must be allocated
     *synchronously*. Reading them from a `setState` updater does not work:
     the updater has not run by the time the request starts, so every response
     arrived carrying seq 0 and `settleSync` discarded all of them as stale —
     the error state never appeared at all. The ref is the source of truth;
     the state exists to render from. */
  const syncRef = useRef<SyncMap>({});
  const applySync = (update: (current: SyncMap) => SyncMap) => {
    syncRef.current = update(syncRef.current);
    setSyncMap(syncRef.current);
  };

  const saveSetMutation = useMutation({
    mutationFn: ({ setId, body }: { setId: string; body: ReturnType<typeof buildPatch>; seq: number }) =>
      api.patch<WorkoutSet>(`/workout-sets/${setId}`, body),
    onSuccess: async (_, variables) => {
      const current = isCurrentAttempt(syncRef.current, variables.setId, variables.seq);
      applySync((prev) => settleSync(prev, variables.setId, variables.seq, 'success'));
      /* A superseded response must not refetch over the newer edit, and must
         not clear the draft the user is still typing into. */
      if (!current) return;
      await refreshSession();
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[variables.setId];
        return next;
      });
    },
    onError: (_error, variables) => {
      // Values are deliberately left in `drafts` — a failed save must not
      // discard what the user entered.
      applySync((prev) => settleSync(prev, variables.setId, variables.seq, 'error'));
    },
  });

  /** Starts a save and hands the mutation its attempt number. */
  function saveSet(setId: string, body: ReturnType<typeof buildPatch>) {
    const begun = beginSync(syncRef.current, setId);
    syncRef.current = begun.map;
    setSyncMap(begun.map);
    return saveSetMutation.mutateAsync({ setId, body, seq: begun.seq });
  }

  const deleteSetMutation = useMutation({
    mutationFn: (setId: string) => api.del(`/workout-sets/${setId}`),
    onSuccess: async () => {
      await refreshSession();
      setPendingRemoval(null);
      toast.show({ variant: 'success', message: 'Set removed.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not remove set.' }),
  });

  /* Story 34: removal is session-scoped, so it flips the existing `skipped`
     flag on the exercise log rather than deleting it — the underlying rows
     (and any sets already logged) are untouched, the workout template and
     program are never involved, and undo is just flipping the flag back. */
  const removeExerciseMutation = useMutation({
    mutationFn: ({ exerciseLogId }: { exerciseLogId: string; name: string }) =>
      api.patch(`/workout-exercise-logs/${exerciseLogId}`, { skipped: true }),
    // Read the name from the mutation's own variables, not component state —
    // a second removal confirmed while this one is still in flight would
    // otherwise overwrite `pendingExerciseRemoval` before this callback runs,
    // misattributing the toast to the wrong exercise.
    onSuccess: async (_, { exerciseLogId, name }) => {
      await refreshSession();
      setPendingExerciseRemoval(null);
      toast.show({
        variant: 'success',
        message: `${name} removed from today's workout.`,
        actionLabel: 'Undo',
        onAction: () => restoreExerciseMutation.mutate(exerciseLogId),
      });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not remove exercise.' }),
  });

  const restoreExerciseMutation = useMutation({
    mutationFn: (exerciseLogId: string) => api.patch(`/workout-exercise-logs/${exerciseLogId}`, { skipped: false }),
    onSuccess: async () => {
      await refreshSession();
      toast.show({ variant: 'success', message: 'Exercise restored to today’s workout.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not undo.' }),
  });

  /* Story 08: the session carries its own prescription snapshot because an
     exercise added mid-session has no day-type row to inherit one from. */
  const addExerciseMutation = useMutation({
    mutationFn: ({ exerciseId, prescription }: { exerciseId: string; prescription: Prescription }) =>
      api.post(`/workout-sessions/${sessionId}/exercises`, { exerciseId, prescription }),
    onSuccess: async () => {
      await refreshSession();
      setAddExerciseOpen(false);
      toast.show({ variant: 'success', message: 'Exercise added.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not add exercise.' }),
  });

  const createExerciseMutation = useMutation({
    mutationFn: (name: string) => api.post<Exercise>('/exercises', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercises'] }),
  });

  const finishWorkoutMutation = useMutation({
    mutationFn: () => api.post(`/workout-sessions/${sessionId}/complete`),
    onSuccess: async () => {
      setFinishConfirmOpen(false);
      await refreshSession();
      toast.show({ variant: 'success', message: 'Workout finished.' });
      navigate('/today');
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not finish workout.' }),
  });

  const orderedExercises = useMemo(() => visibleSessionExercises(query.data?.exercises ?? []), [query.data]);

  // Story 39: seeds the accordion to the first exercise once the session
  // has loaded — a bare `useState(null)` would otherwise start with none
  // active, an odd first impression for a page whose whole prior history
  // (through Story 37) opened every exercise by default. Fires exactly
  // once (the ref, not `activeExerciseId == null`, gates it) so a later
  // manual collapse to none — a real, supported state — is never fought
  // by this effect re-seeding it back open.
  const hasSeededActiveExercise = useRef(false);
  useEffect(() => {
    if (!hasSeededActiveExercise.current && orderedExercises.length > 0) {
      hasSeededActiveExercise.current = true;
      /* Story 42 — the first *incomplete* exercise, not simply the first.
         Reopening a session mid-workout used to expand the editor for an
         exercise the user had already finished: the wrong place to land, and
         the one case that hides a completed exercise's own summary behind the
         editor it replaced.

         A session with nothing left to do keeps story 39's original fallback
         and opens the first exercise. There is no "next" to orient toward at
         that point — the user is here to review or to hit Finish — and
         collapsing everything by default would cost a tap for the common
         reason someone reopens a finished session, which is to correct it. */
      const next = orderedExercises.find(
        (exerciseLog) => !isExerciseComplete(exerciseLog.prescription, exerciseLog.sets),
      );
      setActiveExerciseId((next ?? orderedExercises[0]!).id);
    }
  }, [orderedExercises]);

  // Story 39: scrolls a newly-active exercise into view — but only for a
  // genuine switch between two exercises, never the initial seed above
  // (null → first) or a manual collapse (→ null), neither of which should
  // jump the page. `scroll-margin-bottom` on `ExerciseCard` keeps this
  // clear of the sticky session action bar from Story 36.
  const previousActiveExerciseId = useRef<string | null>(null);
  useEffect(() => {
    if (activeExerciseId != null && previousActiveExerciseId.current != null && previousActiveExerciseId.current !== activeExerciseId) {
      exerciseCardRefs.current[activeExerciseId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    previousActiveExerciseId.current = activeExerciseId;
  }, [activeExerciseId]);

  /**
   * Story 61 — an exercise collapses itself the moment it becomes complete.
   *
   * Keyed on the *transition*, not on the state: collapsing whenever the
   * active exercise happens to be complete would fight the user every time
   * they reopened a finished exercise to correct a set. `wasComplete` records
   * what each exercise looked like on the previous render, so this fires once
   * per completion and never again.
   *
   * Story 42 extends this into a handoff: finishing an exercise opens the
   * next unfinished one, so the workout reads as a queue that is emptying
   * rather than a list that merely changes colour. The existing scroll effect
   * then brings it into view with `block: 'nearest'`, which moves the page
   * only when the next exercise is actually off-screen — orientation, not the
   * forced jump story 62 rules out.
   *
   * When nothing is left, this collapses to none rather than reopening
   * something already finished: at that point the Finish action is the only
   * thing left to do, and every card is a summary.
   */
  const wasComplete = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const exercises = query.data ? visibleSessionExercises(query.data.exercises) : [];
    for (const exerciseLog of exercises) {
      const complete = isExerciseComplete(exerciseLog.prescription, exerciseLog.sets);
      const justCompleted = complete && wasComplete.current[exerciseLog.id] === false;
      wasComplete.current[exerciseLog.id] = complete;
      if (justCompleted) {
        const next = exercises.find(
          (candidate) =>
            candidate.id !== exerciseLog.id &&
            !isExerciseComplete(candidate.prescription, candidate.sets),
        );
        setActiveExerciseId((current) => (current === exerciseLog.id ? (next?.id ?? null) : current));
      }
    }
  }, [query.data]);

  const totalSetsLogged = useMemo(
    () =>
      orderedExercises.reduce(
        (total, exerciseLog) =>
          total +
          exerciseLog.sets.filter((set) => isSessionSetLogged(exerciseLog.prescription, set)).length,
        0,
      ),
    [orderedExercises],
  );

  // Timed, distance and bodyweight work carries no weight, so including it
  // would contribute nothing while making the total look authoritative.
  const totalVolume = useMemo(
    () =>
      calculateVolume(
        orderedExercises
          .filter((exerciseLog) => countsTowardVolume(exerciseLog.prescription))
          .flatMap((exerciseLog) => exerciseLog.sets),
      ),
    [orderedExercises],
  );

  /**
   * Story 39: fired by focusing anything inside this exercise's card (see
   * `ExerciseCard`'s `onFocus` below) — always activates, never toggles,
   * so focus already inside the active exercise can't accidentally
   * collapse it.
   */
  function activateExercise(exerciseLogId: string) {
    setActiveExerciseId((prev) => (prev === exerciseLogId ? prev : exerciseLogId));
  }

  /**
   * Story 39: the chevron's own click handler — the one place a collapse
   * can happen, so manual collapse of the currently active exercise stays
   * available. Tapping any other exercise's header switches to it.
   *
   * Clicking (or Tab+Enter/Space-ing) a button focuses it first, which
   * would otherwise reach the card's own `onFocus` before this handler
   * runs and activate `exerciseLogId` a step early — making this always
   * see "already active" and collapse on the very first interaction with
   * a previously-inactive exercise (mouse *and* keyboard, since a
   * keyboard click has no preceding mousedown to hook a workaround into
   * either). The chevron's own `onFocus` stops that propagation instead,
   * so this reads genuinely-live, not-yet-touched state.
   */
  function toggleActiveExercise(exerciseLogId: string) {
    setActiveExerciseId((prev) => (prev === exerciseLogId ? null : exerciseLogId));
  }

  /**
   * Story 42.2 — the collapse half of controlled expansion.
   *
   * Guarded on identity so a stale collapse from a card that is no longer the
   * active one cannot close whichever exercise the user has since opened.
   */
  function collapseExercise(exerciseLogId: string) {
    setActiveExerciseId((prev) => (prev === exerciseLogId ? null : prev));
  }

  /**
   * Story 37: applies the header's quick-entry values onto every set's own
   * draft. Explicit and only ever fired by this button — the cascade never
   * runs on its own, so a set the user already edited by hand is never
   * silently overwritten; the user has to knowingly re-apply over it.
   *
   * Only the exact keys the user actually edited in the header are
   * copied — not every key belonging to the same quick-entry field. That
   * distinction matters for distance specifically: touching only the unit
   * dropdown must not also drag the (untouched) distance value along.
   */
  function applyHeaderToAllSets(exerciseLog: WorkoutSessionExerciseDetail, definition: PrescriptionDefinition) {
    const header = headerDrafts[exerciseLog.id] ?? getHeaderDraft(exerciseLog, definition);
    const touchedKeys = headerTouchedKeys[exerciseLog.id] ?? [];
    setDrafts((prev) => {
      const next = { ...prev };
      for (const set of exerciseLog.sets) {
        const current = next[set.id] ?? getDraft(set, definition);
        const patch: Partial<DraftValues> = {};
        for (const key of touchedKeys) {
          copyDraftKey(patch, header, key);
        }
        next[set.id] = { ...current, ...patch };
      }
      return next;
    });
    // Cleared so a later, unrelated Apply click can't silently reapply a
    // stale edit — the next click only ever acts on what's touched after
    // this point.
    setHeaderTouchedKeys((prev) => ({ ...prev, [exerciseLog.id]: [] }));
  }

  const bestEstimated1rm = useMemo(() => {
    const estimates = orderedExercises
      .filter((exerciseLog) => countsTowardVolume(exerciseLog.prescription))
      .flatMap((exerciseLog) => exerciseLog.sets)
      .filter((set) => set.weightValue != null && set.reps != null)
      .map((set) => estimateOneRepMax(set.weightValue!, set.reps!));
    if (!estimates.length) return null;
    return Math.round(Math.max(...estimates));
  }, [orderedExercises]);

  if (query.isLoading) {
    return (
      <Page>
        <SkeletonStack $gap={16}>
          <Skeleton $width="50%" $height={26} />
          <Skeleton $width="30%" $height={16} />
        </SkeletonStack>
        <SkeletonStack $gap={16}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <SkeletonStack>
                <Skeleton $width="45%" $height={18} />
                <Skeleton $height={40} />
                <Skeleton $height={40} />
              </SkeletonStack>
            </Card>
          ))}
        </SkeletonStack>
      </Page>
    );
  }
  if (query.isError || !query.data) return <span>Couldn't load workout session.</span>;

  return (
    <Page>
      <Header>
        <HeaderMeta>
          <Title>{query.data.status === 'completed' ? 'Workout complete' : 'Workout session'}</Title>
          <Subtitle>
            {new Date(`${query.data.localDate}T12:00:00`).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Subtitle>
        </HeaderMeta>
        <Actions>
          <AsyncStatusIndicator
            status={inlineStatus.status}
            onRetry={lastMutationRef.current ? () => void inlineStatus.run(lastMutationRef.current!) : undefined}
          />
        </Actions>
      </Header>

      {/* Story 36: session-level actions stay reachable throughout a long
          workout instead of living only in the header above — see
          SessionActionBar's own comment for the mobile/tablet split. They
          disappear once the workout is completed (AC), matching the
          Header's own title change above. */}
      {query.data.status !== 'completed' ? (
        <SessionActionBar aria-label="Workout session actions">
          <SessionActionBarButton>
            <FullWidthButton variant="secondary" onClick={() => setAddExerciseOpen(true)}>
              Add exercise
            </FullWidthButton>
          </SessionActionBarButton>
          <SessionActionBarButton>
            <FullWidthButton
              onClick={() => setFinishConfirmOpen(true)}
              disabled={finishWorkoutMutation.isPending || finishConfirmOpen}
            >
              Finish workout
            </FullWidthButton>
          </SessionActionBarButton>
        </SessionActionBar>
      ) : null}

      <SummaryCard aria-label="Session summary">
        <SummaryTitle>Session summary</SummaryTitle>
        <SummaryStat>
          <SummaryLabel>Elapsed</SummaryLabel>
          <SummaryValue>{formatElapsed(query.data.startedAt, query.data.completedAt)}</SummaryValue>
        </SummaryStat>
        <SummaryStat>
          <SummaryLabel>Sets logged</SummaryLabel>
          <SummaryValue>{totalSetsLogged}</SummaryValue>
        </SummaryStat>
        <SummaryStat>
          <SummaryLabel>Volume</SummaryLabel>
          <SummaryValue>{totalVolume ? `${totalVolume.toLocaleString()} lb` : '—'}</SummaryValue>
        </SummaryStat>
        <SummaryStat>
          <SummaryLabel>Best est. 1RM</SummaryLabel>
          <SummaryValue>{bestEstimated1rm ? `${bestEstimated1rm} lb` : '—'}</SummaryValue>
        </SummaryStat>
      </SummaryCard>

      <ExerciseList>
        {orderedExercises.map((exerciseLog) => {
          const definition = getPrescriptionDefinition(exerciseLog.prescription);
          const loggedSetCount = exerciseLog.sets.filter((set) => isSessionSetLogged(exerciseLog.prescription, set)).length;
          const isComplete = isExerciseComplete(exerciseLog.prescription, exerciseLog.sets);
          /* Story 42 — the completed readout: representation-aware figures
             plus an honest comparison, derived in the domain package so web
             and mobile decide identically. Built only when complete, and
             only from server-held sets. */
          const completedReadout = isComplete
            ? buildCompletedExerciseReadout(
                exerciseLog.prescription,
                exerciseLog.sets,
                exerciseLog.previousSession?.sets ?? null,
              )
            : null;
          const isExpanded = activeExerciseId === exerciseLog.id;
          /* Story 42 — "collapsed" only means something once the accordion has
             been seeded. `activeExerciseId` is null for the first render after
             the session loads, and treating that as collapsed would flash a
             completed exercise as a summary card and then snap it back open
             when the seeding effect runs a moment later. The ref is written in
             that same effect and never read before its first commit, so this
             settles to the real value immediately. */
          const isCollapsed = hasSeededActiveExercise.current && !isExpanded;
          /* Story 42A/42B — the review boundary is the *workout* being marked
             complete, never an exercise finishing inside an active one. A
             completed exercise mid-workout still needs its editing controls
             when reopened; a completed workout has no mutations left to
             offer, so controls that would only render disabled are removed
             rather than greyed out. */
          const sessionComplete = query.data.status === 'completed';
          /* Once the workout is complete the summary card stays put whether or
             not the sets are showing, so the chevron keeps one fixed position
             instead of the card handing over to the editing header. */
          const showCompletedCard = completedReadout != null && (sessionComplete || isCollapsed);
          const headerDraft = headerDrafts[exerciseLog.id] ?? getHeaderDraft(exerciseLog, definition);

          /* Story 58/59 — what Quick Log would write, and what to call the
             button. Derived from the server's sets, never from local drafts:
             a prefilled-but-unsaved value must not make a set look logged. */
          const quickLogValues = {
            weightValue: parseOptionalNumber(headerDraft.weightValue),
            weightUnit: exerciseLog.sets[0]?.weightUnit ?? 'lb',
            reps: parseOptionalNumber(headerDraft.reps),
            durationSeconds: displayToSeconds(headerDraft.durationSeconds, definition),
            distanceValue: parseOptionalNumber(headerDraft.distanceValue),
            distanceUnit: headerDraft.distanceUnit,
          };
          const quickLogTargets = quickLogTargetsFor(exerciseLog.prescription, exerciseLog.sets);
          /* The denominator excludes warmups, so "Log all 3 sets" counts the
             three working sets rather than four rows including a warmup the
             action would never touch. */
          const loggableSetCount = exerciseLog.sets.filter((set) => set.setType !== 'warmup').length;
          const quickLogReady =
            quickLogTargets.length > 0 && isQuickLogComplete(exerciseLog.prescription, quickLogValues);
          // Touched keys are derived straight from the patch's own keys, so
          // e.g. changing only the distance unit marks just `distanceUnit`
          // touched, never `distanceValue` alongside it.
          const updateHeader = (patch: Partial<DraftValues>) => {
            setHeaderDrafts((prev) => ({ ...prev, [exerciseLog.id]: { ...headerDraft, ...patch } }));
            setHeaderTouchedKeys((prev) => {
              const existing = prev[exerciseLog.id] ?? [];
              const patched = Object.keys(patch) as (keyof DraftValues)[];
              return { ...prev, [exerciseLog.id]: [...new Set([...existing, ...patched])] };
            });
          };
          /* One definition, rendered either in the active header or demoted
             into the completed card's corner — the actions are the same
             either way, only their prominence changes.

             A function, not a shared element: handing the *same* element
             object to both branches makes React tear the menu down and build
             it again as the branch flips, which silently discards its open
             state — the menu appeared to do nothing when clicked. */
          const renderExerciseMenu = () => (
            <Menu
              label={`${exerciseLog.exercise.name} actions`}
              items={[
                {
                  label: 'Remove from today’s workout',
                  destructive: true,
                  disabled: query.data.status === 'completed',
                  onClick: () => {
                    activateExercise(exerciseLog.id);
                    setPendingExerciseRemoval({ exerciseLogId: exerciseLog.id, name: exerciseLog.exercise.name, loggedSetCount });
                  },
                },
              ]}
            />
          );
          return (
          <ExerciseWorkCard
            key={exerciseLog.id}
            id={exerciseLog.id}
            name={exerciseLog.exercise.name}
            containerRef={(node: HTMLDivElement | null) => {
              exerciseCardRefs.current[exerciseLog.id] = node;
            }}
            data-testid={isComplete ? 'exercise-card-complete' : 'exercise-card'}
            testId={isComplete ? 'exercise-card-complete' : 'exercise-card'}
            tone={isComplete ? 'complete' : 'neutral'}
            planLabel={summarizePrescription(exerciseLog.prescription)}
            /* Story 42.1 — this counts *logged* sets. It reads
               "0 of 3 sets complete" on a freshly started workout, because a
               planned value is no longer written onto a session set. */
            progressLabel={
              isComplete
                ? completedSetCountLabel(exerciseLog.sets)
                : exerciseLog.sets.length > 0
                  ? `${loggedSetCount} of ${exerciseLog.sets.length} sets complete`
                  : undefined
            }
            status={
              isComplete ? (
                <CompletionMark aria-hidden="true">
                  <Check size={20} strokeWidth={3} />
                </CompletionMark>
              ) : null
            }
            /* Story 42A — the overflow menu is gone once the workout is
               complete, because every action behind it is gone with it. The
               disclosure control is the card's own and is always present. */
            actions={sessionComplete ? null : renderExerciseMenu()}
            summary={
              completedReadout ? (
                <CompletedExerciseSummary
                  readout={completedReadout}
                  testId={`completed-exercise-${exerciseLog.id}`}
                />
              ) : null
            }
            expanded={isExpanded}
            /* Story 42.2 — expansion is controlled here, which is what makes
               opening one exercise close the previous one. The card never
               expands itself, and nothing nested inside it can. */
            onExpandedChange={(next: boolean) =>
              next ? activateExercise(exerciseLog.id) : collapseExercise(exerciseLog.id)
            }
            /* Story 58/59 — the fast path for the normal case, where every
               planned set shares the same values. It persists; it does not
               merely populate the set inputs.

               It no longer needs `onFocus={stopPropagation}`. That existed
               because the card activated an exercise whenever focus landed
               inside it, so tabbing into a quick-entry box opened the whole
               editor. The disclosure primitive removes the cause, so the
               workaround goes with it (story 42.2). */
            quickLog={
              quickLogTargets.length > 0 && supportsQuickLog(exerciseLog.prescription) ? (
            <QuickLogPanel aria-label={`Quick log ${exerciseLog.exercise.name}`}>
              <QuickLogHeading>Quick log</QuickLogHeading>
              <QuickLogFields>
              {quickLogFields(exerciseLog.prescription).map((field) => {
                /* The visible label is short — the panel above already says
                   "Quick log", so repeating it in every field reads as noise.
                   The *accessible* name still carries the prefix, because two
                   identically named inputs on one card are genuinely ambiguous
                   to a screen-reader user navigating by label. An explicit
                   `aria-label` overrides the visible <label> for that name,
                   so the two can differ deliberately.

                   "Quick log" rather than "All sets" because the action no
                   longer applies to every set: already-logged ones are left
                   alone. */
                const label = getSessionFieldLabel(field, definition);
                const accessibleName = (withUnit?: string) =>
                  `Quick log: ${withUnit ? `${label} (${withUnit})` : label}`;
                switch (field) {
                  case 'weight':
                    return (
                      <Input
                        key={field}
                        label={label}
                        value={headerDraft.weightValue}
                        onChange={(event) => updateHeader({ weightValue: event.target.value })}
                        inputMode="decimal"
                        unit={exerciseLog.sets[0]?.weightUnit ?? 'lb'}
                        aria-label={accessibleName(exerciseLog.sets[0]?.weightUnit ?? 'lb')}
                      />
                    );
                  case 'reps':
                    return (
                      <Input
                        key={field}
                        label={label}
                        value={headerDraft.reps}
                        onChange={(event) => updateHeader({ reps: event.target.value })}
                        inputMode="numeric"
                        aria-label={accessibleName()}
                      />
                    );
                  case 'duration':
                    return (
                      <Input
                        key={field}
                        label={label}
                        value={headerDraft.durationSeconds}
                        onChange={(event) => updateHeader({ durationSeconds: event.target.value })}
                        inputMode="decimal"
                        aria-label={accessibleName()}
                      />
                    );
                  case 'distance':
                    return (
                      <Fragment key={field}>
                        <Input
                          label={label}
                          value={headerDraft.distanceValue}
                          onChange={(event) => updateHeader({ distanceValue: event.target.value })}
                          inputMode="decimal"
                          aria-label={accessibleName()}
                        />
                        <Select
                          label="Unit"
                          aria-label="Quick log: Distance unit"
                          value={headerDraft.distanceUnit}
                          options={distanceUnitOptions}
                          onChange={(event) => updateHeader({ distanceUnit: event.target.value as DraftValues['distanceUnit'] })}
                        />
                      </Fragment>
                    );
                  case 'rpe':
                    return (
                      <Input
                        key={field}
                        label={label}
                        value={headerDraft.rpe}
                        onChange={(event) => updateHeader({ rpe: event.target.value })}
                        inputMode="decimal"
                      />
                    );
                  default:
                    return null;
                }
              })}
              </QuickLogFields>
              <QuickLogAction>
                <Button
                  onClick={() =>
                    quickLogMutation.mutate({
                      exerciseLogId: exerciseLog.id,
                      setIds: quickLogTargets.map((set) => set.id),
                      values: quickLogValues,
                    })
                  }
                  disabled={
                    !quickLogReady ||
                    quickLogPending[exerciseLog.id] === true ||
                    query.data.status === 'completed'
                  }
                  data-testid={`quick-log-${exerciseLog.id}`}
                >
                  {describeQuickLogAction(quickLogTargets.length, loggableSetCount)}
                </Button>
              </QuickLogAction>
            </QuickLogPanel>
              ) : null
            }
          >
            {/* Still gated on `isExpanded`, deliberately. React Aria keeps a
                collapsed panel mounted and hidden, which is right for a small
                panel and wrong here: a workout with eight exercises would
                mount forty set editors, each with its own draft state and
                inputs, for content nobody has asked to see. */}
            {isExpanded ? (
              <>
            {/* Story 58 — Detailed Sets. `Add set` lives here now: it
                customises the set list, so it belongs with the sets rather
                than in the header competing with the quick path. */}
            <DetailedSetsHeader>
              <SupportingText>Detailed sets</SupportingText>
              {/* Story 42B — adding a set to a finished workout was already
                  blocked; the button is gone rather than greyed out. */}
              {sessionComplete ? null : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    // Story 39: an explicit call, not a reliance on
                    // click-triggered focus — Safari doesn't always focus a
                    // <button> on click, unlike Chrome/Firefox.
                    activateExercise(exerciseLog.id);
                    addSetMutation.mutate({ exerciseLogId: exerciseLog.id, sourceSet: exerciseLog.sets.at(-1) });
                  }}
                  disabled={addSetMutation.isPending}
                >
                  <Plus size={16} /> Add set
                </Button>
              )}
            </DetailedSetsHeader>

            {exerciseLog.previousSession ? (
              <PreviousSessionCard>
                <SupportingText>
                  Previous session · {new Date(`${exerciseLog.previousSession.localDate}T12:00:00`).toLocaleDateString()}
                </SupportingText>
                <PreviousSessionGrid>
                  {exerciseLog.previousSession.sets.map((previousSet, index) => (
                    <PreviousSessionRow key={`${exerciseLog.previousSession!.sessionId}-${index}`}>
                      <PreviousSessionLabel>Set {index + 1}</PreviousSessionLabel>
                      <span>{getPreviousSet(previousSet, exerciseLog)}</span>
                    </PreviousSessionRow>
                  ))}
                </PreviousSessionGrid>
              </PreviousSessionCard>
            ) : null}

            {exerciseLog.sets.length ? (
              <SetList>
                {exerciseLog.sets.map((set, index) => {
                  const draft = drafts[set.id] ?? getDraft(set, definition);
                  const draftValues = draftToValues(draft, definition);
                  // Union of the prescription's fields and anything this set
                  // already stores, so legacy values stay editable.
                  const visibleFields = resolveSessionFields(exerciseLog.prescription, {
                    ...set,
                    ...draftValues,
                  });
                  const fieldErrors = validateSessionSet(exerciseLog.prescription, draftValues);
                  const plannedValue = getPlannedValue(exerciseLog);
                  const previousValue = getPreviousSet(exerciseLog.previousSession?.sets[index], exerciseLog);
                  return (
                    <SetCard key={set.id} data-testid="set-row">
                      <SetCardHeader>
                        <SetTitleGroup>
                          <SetTitle>Set {index + 1}</SetTitle>
                          <SupportingText>{set.setType === 'working' ? 'Working set' : `${setTypeOptions.find((option) => option.value === set.setType)?.label ?? set.setType}`}</SupportingText>
                        </SetTitleGroup>
                        <Chips>
                          {plannedValue ? <CuePill>Planned: {plannedValue}</CuePill> : null}
                          {previousValue ? <CuePill>Prev: {previousValue}</CuePill> : null}
                          {/* PR flags come straight from the server, which
                              resolves them against all-time history for the
                              whole exercise log after every save. The client
                              only ever saw the previous session, so guessing
                              here produced badges that contradicted the
                              persisted state. */}
                          {set.isPrWeight ? <PRBadge label="Weight PR" /> : null}
                          {set.isPrReps ? <PRBadge label="Rep PR" /> : null}
                        </Chips>
                      </SetCardHeader>

                      <SetGrid>
                        {visibleFields.map((field) => {
                          const update = (patch: Partial<DraftValues>) =>
                            setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, ...patch } }));
                          const label = getSessionFieldLabel(field, definition);
                          const error = fieldErrors[field];

                          switch (field) {
                            case 'setType':
                              return (
                                <Select
                                  key={field}
                                  label="Type"
                                  value={draft.setType}
                                  options={setTypeOptions}
                                  onChange={(event) => update({ setType: event.target.value as SetType })}
                                />
                              );
                            case 'weight':
                              return (
                                <Input
                                  key={field}
                                  label={label}
                                  value={draft.weightValue}
                                  onChange={(event) => update({ weightValue: event.target.value })}
                                  inputMode="decimal"
                                  unit={set.weightUnit ?? 'lb'}
                                  error={error}
                                />
                              );
                            case 'reps':
                              return (
                                <Input
                                  key={field}
                                  label={label}
                                  value={draft.reps}
                                  onChange={(event) => update({ reps: event.target.value })}
                                  inputMode="numeric"
                                  error={error}
                                />
                              );
                            case 'duration':
                              return (
                                <Input
                                  key={field}
                                  label={label}
                                  value={draft.durationSeconds}
                                  onChange={(event) => update({ durationSeconds: event.target.value })}
                                  inputMode="decimal"
                                  error={error}
                                />
                              );
                            case 'distance':
                              return (
                                <Fragment key={field}>
                                  <Input
                                    label={label}
                                    value={draft.distanceValue}
                                    onChange={(event) => update({ distanceValue: event.target.value })}
                                    inputMode="decimal"
                                    error={error}
                                  />
                                  <Select
                                    label="Distance unit"
                                    value={draft.distanceUnit}
                                    options={distanceUnitOptions}
                                    onChange={(event) =>
                                      update({ distanceUnit: event.target.value as DraftValues['distanceUnit'] })
                                    }
                                  />
                                </Fragment>
                              );
                            case 'rpe':
                              return (
                                <Input
                                  key={field}
                                  label={label}
                                  value={draft.rpe}
                                  onChange={(event) => update({ rpe: event.target.value })}
                                  inputMode="decimal"
                                  labelHint="How hard the set felt, from 1 to 10."
                                  error={error}
                                />
                              );
                            default:
                              return null;
                          }
                        })}
                      </SetGrid>

                      <SetFooter>
                        <SupportingText>
                          {plannedValue ? 'Planned beside actual for quick comparison.' : 'Log what you actually did.'}
                        </SupportingText>
                        <SetActions>
                          {/* Story 42B, reconciled with story 23. Correcting a
                              logged value after completion is deliberately
                              still allowed and tested, so Save cannot simply
                              be removed in review mode. Instead it appears
                              only once there is an edit to save: no dead
                              control, no lost capability. During an active
                              workout it stays put and disables as before, so
                              the button does not flicker in and out while
                              someone is typing between sets. */}
                          {sessionComplete && !hasChanges(set, draft, visibleFields, definition) ? null : (
                          <Button
                            variant="secondary"
                            disabled={
                              !hasChanges(set, draft, visibleFields, definition) ||
                              Object.keys(fieldErrors).length > 0 ||
                              // Only *this* set's own in-flight write disables
                              // it — saving one set never blocks another.
                              isSaving(syncMap, set.id)
                              // Story 23: correcting a logged set's values is
                              // allowed after completion — "completed" is not
                              // "immutable." Add/duplicate/delete stay gated
                              // below: this is a correction workflow, not a
                              // reopen-and-restructure one.
                            }
                            onClick={() => {
                              const action = () =>
                                saveSet(set.id, buildPatch(set, draft, visibleFields, definition));
                              lastMutationRef.current = action;
                              void inlineStatus.run(action);
                            }}
                          >
                            {isSaving(syncMap, set.id) ? 'Saving…' : 'Save'}
                          </Button>
                          )}
                          {/* Concise and inline, not a modal: a failed set
                              save is recoverable and the user is mid-workout.
                              The entered values are still in the draft. */}
                          {hasSyncError(syncMap, set.id) ? (
                            <SupportingText role="alert" data-testid={`sync-error-${set.id}`}>
                              Not saved — tap Save to retry.
                            </SupportingText>
                          ) : null}
                          {/* Story 42B — restructuring a finished workout was
                              always blocked (story 23); these used to render
                              greyed out to say so. A permanently disabled
                              control communicates nothing except that the
                              screen has not caught up with its own state. */}
                          {sessionComplete ? null : (
                            <>
                              <IconButton
                                aria-label={`Duplicate set ${index + 1}`}
                                onClick={() => addSetMutation.mutate({ exerciseLogId: exerciseLog.id, sourceSet: set })}
                              >
                                <Copy size={16} />
                              </IconButton>
                              <IconButton
                                aria-label={`Delete set ${index + 1}`}
                                onClick={() => setPendingRemoval({ setId: set.id, exerciseLogId: exerciseLog.id, label: `Set ${index + 1}` })}
                              >
                                <Trash2 size={16} />
                              </IconButton>
                            </>
                          )}
                        </SetActions>
                      </SetFooter>
                    </SetCard>
                  );
                })}
              </SetList>
            ) : (
              <EmptyText>No sets logged yet — add the first set to start recording actual performance.</EmptyText>
            )}
              </>
            ) : null}
          </ExerciseWorkCard>
          );
        })}
      </ExerciseList>

      <Modal
        presentation="compact"
        open={pendingRemoval != null}
        onClose={() => setPendingRemoval(null)}
        title="Remove set?"
        description="This deletes the set from the workout session. Use duplicate/add if you meant to adjust order instead."
      >
        <SupportingText>{pendingRemoval?.label}</SupportingText>
        <Actions>
          <Button variant="secondary" onClick={() => setPendingRemoval(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => pendingRemoval && deleteSetMutation.mutate(pendingRemoval.setId)}
            disabled={deleteSetMutation.isPending}
          >
            Remove set
          </Button>
        </Actions>
      </Modal>

      <Modal
        presentation="compact"
        open={pendingExerciseRemoval != null}
        onClose={() => setPendingExerciseRemoval(null)}
        title={
          pendingExerciseRemoval && pendingExerciseRemoval.loggedSetCount > 0
            ? `Remove ${pendingExerciseRemoval.name} and its ${pendingExerciseRemoval.loggedSetCount} logged set${pendingExerciseRemoval.loggedSetCount === 1 ? '' : 's'} from today's workout?`
            : `Remove ${pendingExerciseRemoval?.name ?? 'this exercise'} from today's workout?`
        }
        description={
          pendingExerciseRemoval && pendingExerciseRemoval.loggedSetCount > 0
            ? `This only changes today's session — the sets you've already logged stay on record, and ${pendingExerciseRemoval.name} will stay in the workout template.`
            : `This only changes today's session. ${pendingExerciseRemoval?.name ?? 'It'} will stay in the workout template.`
        }
      >
        <Actions>
          <Button variant="secondary" onClick={() => setPendingExerciseRemoval(null)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              pendingExerciseRemoval &&
              removeExerciseMutation.mutate({
                exerciseLogId: pendingExerciseRemoval.exerciseLogId,
                name: pendingExerciseRemoval.name,
              })
            }
            disabled={removeExerciseMutation.isPending}
          >
            Remove exercise
          </Button>
        </Actions>
      </Modal>

      {/* Story 36: Finish workout became persistently reachable, so a stray
          tap must not end the session outright — this is a new
          confirmation, since the button previously completed immediately. */}
      <Modal
        presentation="compact"
        open={finishConfirmOpen}
        onClose={() => setFinishConfirmOpen(false)}
        title="Finish workout?"
        description={`You logged ${orderedExercises.length} exercise${orderedExercises.length === 1 ? '' : 's'} and ${totalSetsLogged} set${totalSetsLogged === 1 ? '' : 's'}. You can review the workout after finishing.`}
      >
        <Actions>
          <Button variant="secondary" onClick={() => setFinishConfirmOpen(false)}>
            Keep training
          </Button>
          <Button
            onClick={() => finishWorkoutMutation.mutate()}
            disabled={finishWorkoutMutation.isPending}
            status={finishWorkoutMutation.isPending ? 'loading' : 'idle'}
          >
            Finish workout
          </Button>
        </Actions>
      </Modal>

      {addExerciseOpen ? (
        <AddExercisePicker
          exercises={exercisesQuery.data ?? []}
          exercisesLoading={exercisesQuery.isLoading}
          exercisesError={exercisesQuery.isError}
          onRetryExercises={() => void exercisesQuery.refetch()}
          onClose={() => setAddExerciseOpen(false)}
          onCreateExercise={(name) => createExerciseMutation.mutateAsync(name)}
          isCreatingExercise={createExerciseMutation.isPending}
          onAddExercise={(exerciseId, prescription) => addExerciseMutation.mutateAsync({ exerciseId, prescription })}
          isAddingExercise={addExerciseMutation.isPending}
        />
      ) : null}

    </Page>
  );
}
