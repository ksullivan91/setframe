import {
  mapWorkoutType,
  isTrainingType,
  overlaps,
  partitionWorkouts,
  toCreateBody,
  workoutTitle,
  type DiscoveredWorkout,
} from '../healthkit/workout-discovery';

function workout(over: Partial<DiscoveredWorkout> = {}): DiscoveredWorkout {
  return {
    externalId: 'hk-1',
    appleType: 52,
    activityType: 'walk',
    title: 'Outdoor Walk',
    startedAt: '2026-08-31T12:42:00.000Z',
    endedAt: '2026-08-31T12:59:00.000Z',
    durationSeconds: 1020,
    distanceValue: 0.8,
    distanceUnit: 'mi',
    caloriesKcal: 64,
    avgHeartRateBpm: 118,
    peakHeartRateBpm: 141,
    ...over,
  };
}

describe('type mapping', () => {
  it('maps the types the story names', () => {
    expect(mapWorkoutType(52)).toBe('walk');
    expect(mapWorkoutType(37)).toBe('run');
    expect(mapWorkoutType(57)).toBe('yoga');
    expect(mapWorkoutType(24)).toBe('walk');
  });

  it('distinguishes indoor from outdoor cycling', () => {
    expect(mapWorkoutType(13, false)).toBe('outdoor_cycle');
    expect(mapWorkoutType(13, true)).toBe('indoor_cycle');
    expect(workoutTitle(13, true)).toBe('Indoor Cycle');
  });

  it('degrades an unknown type to other rather than guessing', () => {
    /* A wrong type is a wrong claim about the user's day. `other` is
       honest, and the prefilled sheet lets them correct it. */
    expect(mapWorkoutType(6)).toBe('other'); // basketball
    expect(mapWorkoutType(3000)).toBe('other');
    expect(workoutTitle(6)).toBe('Workout');
  });
});

describe('overlap', () => {
  it('is true only when two ranges share an instant', () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 5, end: 15 })).toBe(true);
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
    expect(overlaps({ start: 0, end: 10 }, { start: 11, end: 20 })).toBe(false);
  });
});

describe('what gets offered', () => {
  const session = {
    label: 'Lower A',
    startedAt: '2026-08-31T17:32:00.000Z',
    completedAt: '2026-08-31T18:38:00.000Z',
  };

  it('offers a workout that has nothing to do with a logged session', () => {
    const { suggestions, suppressed } = partitionWorkouts([workout()], [session]);
    expect(suggestions).toHaveLength(1);
    expect(suppressed).toHaveLength(0);
  });

  it('does not offer your own session back to you', () => {
    /* The trap the story misses. The Watch records Traditional Strength
       Training for the hour the user logged Lower A here; offering it as
       "additional" activity double-counts the session Today is built
       around. Exact-id dedupe cannot catch it — it is a different record
       that was never imported. */
    const watchRecording = workout({
      externalId: 'hk-strength',
      appleType: 50,
      activityType: 'other',
      title: 'Traditional Strength Training',
      startedAt: '2026-08-31T17:35:00.000Z',
      endedAt: '2026-08-31T18:36:00.000Z',
    });

    const { suggestions, suppressed } = partitionWorkouts([watchRecording], [session]);

    expect(suggestions).toHaveLength(0);
    expect(suppressed).toHaveLength(1);
    expect(suppressed[0]!.reason).toContain('Lower A');
  });

  it('still offers a walk that overlaps a session, because the type does not match', () => {
    /* The loose type match is what keeps suppression from swallowing a
       genuine activity that merely shares a clock with a lift. */
    const walk = workout({ startedAt: session.startedAt, endedAt: session.completedAt });
    const { suggestions, suppressed } = partitionWorkouts([walk], [session]);
    expect(suggestions).toHaveLength(1);
    expect(suppressed).toHaveLength(0);
  });

  it('offers a strength workout that does not overlap anything', () => {
    const morning = workout({
      externalId: 'hk-early',
      appleType: 50,
      startedAt: '2026-08-31T06:00:00.000Z',
      endedAt: '2026-08-31T06:45:00.000Z',
    });
    const { suggestions } = partitionWorkouts([morning], [session]);
    expect(suggestions).toHaveLength(1);
  });

  it('treats an ambiguous "other" workout over a session as the session', () => {
    const ambiguous = workout({ appleType: 3000, startedAt: session.startedAt, endedAt: session.completedAt });
    const { suppressed } = partitionWorkouts([ambiguous], [session]);
    expect(suppressed).toHaveLength(1);
    expect(isTrainingType(3000)).toBe(true);
  });

  it('never re-offers something already imported', () => {
    const { suggestions } = partitionWorkouts([workout()], [], {
      importedExternalIds: ['hk-1'],
    });
    expect(suggestions).toHaveLength(0);
  });

  it('never re-offers something dismissed, and does not explain it either', () => {
    /* Dismissed means gone, not "gone with a note about why" — a lingering
       explanation is its own kind of nagging. */
    const result = partitionWorkouts([workout()], [], { dismissedIds: ['hk-1'] });
    expect(result.suggestions).toHaveLength(0);
    expect(result.suppressed).toHaveLength(0);
  });

  it('survives a session with no start time', () => {
    const { suggestions } = partitionWorkouts(
      [workout({ appleType: 50 })],
      [{ label: 'Unstarted', startedAt: null, completedAt: null }],
    );
    expect(suggestions).toHaveLength(1);
  });

  it('treats an in-progress session as running up to its start only', () => {
    const inProgress = { label: 'Lower A', startedAt: '2026-08-31T17:32:00.000Z', completedAt: null };
    const later = workout({
      appleType: 50,
      startedAt: '2026-08-31T19:00:00.000Z',
      endedAt: '2026-08-31T19:30:00.000Z',
    });
    expect(partitionWorkouts([later], [inProgress]).suggestions).toHaveLength(1);
  });
});

describe('import body', () => {
  it('carries provenance and the dedupe key', () => {
    const body = toCreateBody(workout(), '2026-08-31', 'America/Chicago');
    expect(body.source).toBe('apple_health');
    expect(body.externalSourceId).toBe('hk-1');
    expect(body.activityType).toBe('walk');
    expect(body.durationSeconds).toBe(1020);
    expect(body.distanceValue).toBe(0.8);
  });

  it('sends a null duration rather than zero when Health recorded none', () => {
    const body = toCreateBody(workout({ durationSeconds: 0 }), '2026-08-31', 'UTC');
    // The API rejects a non-positive duration; zero would 400 the import.
    expect(body.durationSeconds).toBeNull();
  });
});
