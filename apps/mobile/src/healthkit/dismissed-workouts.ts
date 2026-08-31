import * as SecureStore from 'expo-secure-store';

/**
 * Dismissed workout suggestions, kept on the device.
 *
 * Device-local by decision, and **persistent**: the requirement was that a
 * dismissed suggestion must not come back when the app is closed and
 * reopened. In-memory state would have satisfied a single session and
 * failed the actual ask, so this writes through to storage on every
 * dismissal rather than at some later flush.
 *
 * Scoped to one local date. Discovery only looks at today, so yesterday's
 * dismissals are dead weight — storing the date alongside the ids means the
 * record clears itself at midnight instead of growing forever.
 *
 * `expo-secure-store` rather than AsyncStorage: it is already a direct
 * dependency and already native-linked here (the Clerk token cache uses
 * it), whereas AsyncStorage is only present transitively through a wallet
 * adapter and could vanish on any dependency bump.
 */
const KEY = 'setframe.dismissedWorkouts.v1';

interface Stored {
  localDate: string;
  ids: string[];
}

function parse(raw: string | null, localDate: string): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || parsed.localDate !== localDate || !Array.isArray(parsed.ids)) return new Set();
    return new Set(parsed.ids.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export async function loadDismissedWorkouts(localDate: string): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return [...parse(raw, localDate)];
  } catch {
    // Storage being unavailable must never block Today from rendering.
    return [];
  }
}

/**
 * Records one dismissal and returns the full set for the day.
 *
 * Re-reads before writing so a dismissal is not lost to a stale snapshot
 * if two suggestions are dismissed in quick succession.
 */
export async function dismissWorkout(localDate: string, externalId: string): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const ids = parse(raw, localDate);
    ids.add(externalId);
    const next: Stored = { localDate, ids: [...ids] };
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    return next.ids;
  } catch {
    return [externalId];
  }
}
