import { candidatesForSession, ATTACH_WINDOW_SECONDS } from '../healthkit/useSessionWatchWorkouts';
import type { DiscoveredWorkout } from '../healthkit/workout-discovery';

/**
 * Which Watch workouts belong to a session.
 *
 * The lift is the overlap; the run and the walk home are the window after.
 * The window is the number most likely to want changing once it meets real
 * days, which is why it is one exported constant.
 */
const SESSION = {
  startedAt: '2026-09-01T17:32:00.000Z',
  completedAt: '2026-09-01T18:36:00.000Z',
};

function workout(over: Partial<DiscoveredWorkout> = {}): DiscoveredWorkout {
  return {
    externalId: 'hk-1',
    appleType: 52,
    activityType: 'walk',
    title: 'Outdoor Walk',
    startedAt: '2026-09-01T18:45:00.000Z',
    endedAt: '2026-09-01T19:00:00.000Z',
    durationSeconds: 900,
    distanceValue: 0.8,
    distanceUnit: 'mi',
    caloriesKcal: 64,
    ...over,
  };
}

it('claims a workout that overlaps the session', () => {
  const lift = workout({
    externalId: 'hk-lift',
    appleType: 50,
    startedAt: '2026-09-01T17:35:00.000Z',
    endedAt: '2026-09-01T18:34:00.000Z',
  });
  const [candidate] = candidatesForSession([lift], SESSION, []);
  expect(candidate?.relation).toBe('overlaps');
});

it('claims a workout starting inside the window after it', () => {
  // Nine minutes after the last set — the run out of the gym.
  const [candidate] = candidatesForSession([workout()], SESSION, []);
  expect(candidate?.relation).toBe('after');
});

it('leaves a workout beyond the window alone', () => {
  /* An evening stroll is not part of a morning lift. Sixty minutes is long
     enough for a run and the walk home and short enough to stop there. */
  const late = workout({
    startedAt: '2026-09-01T19:45:00.000Z',
    endedAt: '2026-09-01T20:00:00.000Z',
  });
  expect(candidatesForSession([late], SESSION, [])).toEqual([]);
});

it('takes the window exactly at its boundary', () => {
  const atEdge = workout({
    startedAt: new Date(Date.parse(SESSION.completedAt) + ATTACH_WINDOW_SECONDS * 1000).toISOString(),
    endedAt: '2026-09-01T19:50:00.000Z',
  });
  expect(candidatesForSession([atEdge], SESSION, [])).toHaveLength(1);
});

it('ignores a workout that finished before the session began', () => {
  /* The window looks forward only. A morning run is a separate thing, not
     part of the evening's lift, however close it sits. */
  const earlier = workout({
    startedAt: '2026-09-01T16:00:00.000Z',
    endedAt: '2026-09-01T16:30:00.000Z',
  });
  expect(candidatesForSession([earlier], SESSION, [])).toEqual([]);
});

it('does not reach backwards, even when the session is short', () => {
  /* The window is measured from the session's END, so for a long session a
     backwards match is unreachable — anything close enough would overlap.
     A short session is where a symmetric window would wrongly claim a
     workout that finished beforehand, and it is the case that catches it. */
  const shortSession = {
    startedAt: '2026-09-01T18:00:00.000Z',
    completedAt: '2026-09-01T18:10:00.000Z',
  };
  const before = workout({
    startedAt: '2026-09-01T17:30:00.000Z',
    endedAt: '2026-09-01T17:45:00.000Z',
  });
  expect(candidatesForSession([before], shortSession, [])).toEqual([]);
});

it('never re-offers something already attached', () => {
  expect(candidatesForSession([workout()], SESSION, ['hk-1'])).toEqual([]);
});

it('offers candidates in the order they happened', () => {
  const run = workout({ externalId: 'hk-run', startedAt: '2026-09-01T18:41:00.000Z', endedAt: '2026-09-01T19:03:00.000Z' });
  const walk = workout({ externalId: 'hk-walk', startedAt: '2026-09-01T19:10:00.000Z', endedAt: '2026-09-01T19:24:00.000Z' });
  const result = candidatesForSession([walk, run], SESSION, []);
  expect(result.map((c) => c.workout.externalId)).toEqual(['hk-run', 'hk-walk']);
});

it('returns nothing for a session that never started', () => {
  expect(candidatesForSession([workout()], { startedAt: null, completedAt: null }, [])).toEqual([]);
});

it('treats an in-progress session as ending at its start', () => {
  /* Nothing has finished yet, so the window runs from the start. A workout
     already underway still overlaps and is offered. */
  const inProgress = { startedAt: '2026-09-01T17:32:00.000Z', completedAt: null };
  const during = workout({
    startedAt: '2026-09-01T17:40:00.000Z',
    endedAt: '2026-09-01T18:00:00.000Z',
  });
  expect(candidatesForSession([during], inProgress, [])).toHaveLength(1);
});
