import { SetDraftStore } from '../lib/setDraftStore';
import type { SetRowValues } from '../components/workout-v2/SetRowV2';

const vals = (over: Partial<SetRowValues> = {}): SetRowValues => ({
  weight: '', reps: '', duration: '', distance: '', rpe: '', ...over,
});

/** Complete enough to write: this app's rule is weight AND reps. */
const writable = (_id: string, v: SetRowValues) => v.weight !== '' && v.reps !== '';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('what the user typed is never lost', () => {
  it('remembers a half-filled row instead of dropping it', async () => {
    /* The erasure people hit most: the row recorded itself as committed,
       the save was skipped for being incomplete, and the next resync from
       the server wiped the typed number. */
    const save = jest.fn().mockResolvedValue(undefined);
    const store = new SetDraftStore(save, writable, 0);

    store.edit('s1', vals({ weight: '225' }));
    await tick();

    expect(save).not.toHaveBeenCalled();
    expect(store.valuesFor('s1', vals()).weight).toBe('225');
    expect(store.statusFor('s1')).toBe('idle');
  });

  it('never lets server data overwrite an unsaved draft', () => {
    const store = new SetDraftStore(jest.fn(), writable, 0);
    store.edit('s1', vals({ weight: '235', reps: '8' }));

    // The server still holds the old row; the draft wins until it is written.
    expect(store.valuesFor('s1', vals({ weight: '225', reps: '8' })).weight).toBe('235');
  });

  it('keeps the draft when the save fails', async () => {
    const save = jest.fn().mockRejectedValue(new Error('offline'));
    const store = new SetDraftStore(save, writable, 0);

    store.edit('s1', vals({ weight: '225', reps: '8' }));
    await store.flush();

    expect(store.statusFor('s1')).toBe('error');
    expect(store.valuesFor('s1', vals()).weight).toBe('225');
  });

  it('retries a failed save on the next flush', async () => {
    const save = jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const store = new SetDraftStore(save, writable, 0);

    store.edit('s1', vals({ weight: '225', reps: '8' }));
    await store.flush();
    await store.flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(store.hasDraft('s1')).toBe(false);
  });
});

describe('typing quickly', () => {
  it('sends one write per set, not one per keystroke', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const store = new SetDraftStore(save, writable, 5);

    store.edit('s1', vals({ weight: '2', reps: '8' }));
    store.edit('s1', vals({ weight: '22', reps: '8' }));
    store.edit('s1', vals({ weight: '225', reps: '8' }));
    await store.flush();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('s1', expect.objectContaining({ weight: '225' }));
  });

  it('never lets an older response land on a newer value', async () => {
    /* The race behind the reported weirdness: two writes for one set in
       flight together, the slower one finishing last and winning. */
    let release: (() => void) | null = null;
    /* Only the FIRST write is held open. Holding every write open hangs the
       drain pass, which is the store working, not failing. */
    const save = jest
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }))
      .mockResolvedValue(undefined);
    const store = new SetDraftStore(save, writable, 0);

    store.edit('s1', vals({ weight: '225', reps: '8' }));
    const flushing = store.flush();
    await tick();
    expect(save).toHaveBeenCalledTimes(1);

    // Typed again while the first write is still open.
    store.edit('s1', vals({ weight: '235', reps: '8' }));
    release!();
    await flushing;
    await tick();

    /* Two writes, in order, the newer last — and the draft is gone only
       because the newer value reached the server. Asserting the draft still
       held '235' would be asserting that the store failed to write it. */
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ weight: '225' }));
    expect(save.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ weight: '235' }));
    expect(store.hasDraft('s1')).toBe(false);
  });

  it('keeps each set\u2019s entry to itself', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const store = new SetDraftStore(save, writable, 0);

    store.edit('s1', vals({ weight: '225', reps: '8' }));
    store.edit('s2', vals({ weight: '235', reps: '6' }));

    expect(store.valuesFor('s1', vals()).weight).toBe('225');
    expect(store.valuesFor('s2', vals()).weight).toBe('235');
    await store.flush();
    expect(save).toHaveBeenCalledTimes(2);
  });
});

describe('after a successful write', () => {
  it('hands the row back to the server’s copy', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const store = new SetDraftStore(save, writable, 0);

    store.edit('s1', vals({ weight: '225', reps: '8' }));
    await store.flush();

    // No draft left, so a later correction from the server is respected.
    expect(store.hasDraft('s1')).toBe(false);
    expect(store.valuesFor('s1', vals({ weight: '226', reps: '8' })).weight).toBe('226');
  });

  it('counts what is still outstanding', async () => {
    const save = jest.fn().mockRejectedValue(new Error('offline'));
    const store = new SetDraftStore(save, writable, 0);

    store.edit('s1', vals({ weight: '225', reps: '8' }));
    store.edit('s2', vals({ weight: '235', reps: '6' }));
    await store.flush();

    expect(store.pendingCount).toBe(2);
  });
});
