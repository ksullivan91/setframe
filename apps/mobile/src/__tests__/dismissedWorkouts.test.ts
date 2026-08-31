const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...a: unknown[]) => mockGetItemAsync(...a),
  setItemAsync: (...a: unknown[]) => mockSetItemAsync(...a),
}));

import { dismissWorkout, loadDismissedWorkouts } from '../healthkit/dismissed-workouts';

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItemAsync.mockResolvedValue(undefined);
});

it('remembers a dismissal across app restarts', async () => {
  /* The stated requirement: a dismissed suggestion must not come back when
     the app is closed and reopened. In-memory state would pass a single
     session and fail the actual ask, so the write has to reach storage. */
  mockGetItemAsync.mockResolvedValue(null);
  await dismissWorkout('2026-08-31', 'hk-1');

  expect(mockSetItemAsync).toHaveBeenCalledTimes(1);
  const [, written] = mockSetItemAsync.mock.calls[0]!;
  expect(JSON.parse(written as string)).toEqual({ localDate: '2026-08-31', ids: ['hk-1'] });

  // A fresh launch reads it back.
  mockGetItemAsync.mockResolvedValue(written);
  await expect(loadDismissedWorkouts('2026-08-31')).resolves.toEqual(['hk-1']);
});

it('does not lose a dismissal to a stale snapshot', async () => {
  mockGetItemAsync.mockResolvedValue(JSON.stringify({ localDate: '2026-08-31', ids: ['hk-1'] }));
  await dismissWorkout('2026-08-31', 'hk-2');
  const [, written] = mockSetItemAsync.mock.calls[0]!;
  expect(JSON.parse(written as string).ids).toEqual(['hk-1', 'hk-2']);
});

it('forgets yesterday, so the record cannot grow forever', async () => {
  /* Discovery only looks at today, so yesterday's ids are dead weight —
     and keeping them would mean a store that only ever grows. */
  mockGetItemAsync.mockResolvedValue(JSON.stringify({ localDate: '2026-08-30', ids: ['old'] }));
  await expect(loadDismissedWorkouts('2026-08-31')).resolves.toEqual([]);
});

it('never blocks Today when storage is unavailable', async () => {
  mockGetItemAsync.mockRejectedValue(new Error('keychain locked'));
  await expect(loadDismissedWorkouts('2026-08-31')).resolves.toEqual([]);
});

it('ignores a corrupt record instead of throwing', async () => {
  mockGetItemAsync.mockResolvedValue('{not json');
  await expect(loadDismissedWorkouts('2026-08-31')).resolves.toEqual([]);
});
