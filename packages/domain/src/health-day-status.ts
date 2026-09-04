import type { AppleHealthDay } from '@setframe/schemas';

export type SyncStatus = 'missing' | 'partial' | 'complete' | 'stale' | 'unavailable' | 'error';

/**
 * When a local day ends, as an instant.
 *
 * Built from the day's own timezone offset rather than the server's clock:
 * the whole daily-record model stores `local_date` plus the timezone that
 * defined it precisely so a day survives travel and DST, and deciding when
 * that day closed is the one place that would quietly undo it.
 */
export function endOfLocalDay(localDate: string, timezone: string): Date {
  /* Midnight *the next* day, expressed in the record's own zone. Computed by
     asking Intl what that zone's offset was at that moment rather than by
     assuming a fixed one, so a DST boundary inside the day is handled. */
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const naiveNextMidnight = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0);
  const offsetMs = zoneOffsetMs(new Date(naiveNextMidnight), timezone);
  return new Date(naiveNextMidnight - offsetMs);
}

/** The zone's UTC offset at a given instant, in milliseconds. */
function zoneOffsetMs(at: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
    const asUTC = Date.UTC(
      get('year'), get('month') - 1, get('day'),
      get('hour') % 24, get('minute'), get('second'),
    );
    return asUTC - at.getTime();
  } catch {
    /* An unknown zone should not make the day unsettleable; treat it as UTC
       and let the day close on time rather than never. */
    return 0;
  }
}

/** Whether the payload carried any measurement at all. */
export function hasAnyMeasurement(day: AppleHealthDay): boolean {
  const values = [
    ...Object.values(day.activity ?? {}),
    ...Object.values(day.nutrition ?? {}),
  ];
  return values.some((v) => typeof v === 'number' && Number.isFinite(v));
}

/**
 * What one reconciled day settles to.
 *
 * The rule the self-healing sweep depends on: only `partial`, `stale` and
 * `error` are worth asking about again. A day that is over and held nothing
 * is `missing` and stays `missing` — re-querying an empty Tuesday forever is
 * how a "self-healing" sweep becomes a battery bug.
 */
export function deriveDayStatus(day: AppleHealthDay, now: Date = new Date()): SyncStatus {
  if (day.outcome === 'unavailable') return 'unavailable';
  if (day.outcome === 'error') return 'error';

  const dayEnd = endOfLocalDay(day.localDate, day.timezone);
  const syncedThrough = new Date(day.syncedThrough);
  const dayIsOver = now.getTime() >= dayEnd.getTime();
  const readCoversWholeDay = syncedThrough.getTime() >= dayEnd.getTime();

  if (!hasAnyMeasurement(day)) {
    /* Nothing found. If the day is still running that is unremarkable —
       ask again later. If it is over, there was nothing to find. */
    return dayIsOver && readCoversWholeDay ? 'missing' : 'partial';
  }

  if (!dayIsOver) return 'partial';
  /* The day is over but this read stopped before it did — a mid-day sync
     that never came back. Worth one more look for late Watch writes. */
  if (!readCoversWholeDay) return 'stale';
  return 'complete';
}

/** The statuses a sweep should re-query. */
export const RESYNC_STATUSES: readonly SyncStatus[] = ['partial', 'stale', 'error'];

export function needsResync(status: SyncStatus): boolean {
  return RESYNC_STATUSES.includes(status);
}
