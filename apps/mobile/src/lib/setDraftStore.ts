import type { SetRowValues } from '../components/workout-v2/SetRowV2';

export type SetSaveStatus = 'idle' | 'queued' | 'saving' | 'saved' | 'error';

/** What the caller does with a set's values. */
export type SaveSet = (setId: string, values: SetRowValues) => Promise<void>;

interface Entry {
  values: SetRowValues;
  /** Bumped on every edit; a save that finishes stale leaves the draft dirty. */
  revision: number;
  /** The revision the in-flight save is writing. */
  savingRevision: number | null;
  /** The revision last written successfully. */
  savedRevision: number | null;
  status: SetSaveStatus;
}

/**
 * Set entry, held in memory and written behind.
 *
 * The logger used to keep a draft inside each row and resync it from props
 * whenever the server's copy changed — and every save refetched the whole
 * session, so a fast lifter generated a refetch per row, each one resetting
 * the drafts of every row not currently focused. Typing quickly erased
 * values, and rows renumbering under a reorder made it look like entries had
 * moved between sets.
 *
 * The rules that make that impossible:
 *
 * - A draft is **never** overwritten by server data. It is dropped only when
 *   the server has been told about it, and only if nothing has been typed
 *   since.
 * - One save in flight per set. Edits made during a save are coalesced and
 *   sent after it, so an older response can never land on top of a newer
 *   value.
 * - A row too incomplete to write is still remembered. It used to be
 *   dropped silently while the row recorded itself as committed, which is
 *   the erasure people hit most.
 */
export class SetDraftStore {
  private entries = new Map<string, Entry>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private disposed = false;

  constructor(
    private save: SaveSet,
    /** Whether a set is complete enough to write at all. */
    private isWritable: (setId: string, values: SetRowValues) => boolean,
    private debounceMs = 700,
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  /** The values to render: the draft if there is one, else the server's. */
  valuesFor(setId: string, serverValues: SetRowValues): SetRowValues {
    return this.entries.get(setId)?.values ?? serverValues;
  }

  statusFor(setId: string): SetSaveStatus {
    return this.entries.get(setId)?.status ?? 'idle';
  }

  hasDraft(setId: string): boolean {
    return this.entries.has(setId);
  }

  get pendingCount(): number {
    let n = 0;
    for (const entry of this.entries.values()) {
      if (entry.status === 'queued' || entry.status === 'saving' || entry.status === 'error') n += 1;
    }
    return n;
  }

  /** Record what was typed. Never blocks, never waits on the network. */
  edit(setId: string, values: SetRowValues): void {
    const existing = this.entries.get(setId);
    const revision = (existing?.revision ?? 0) + 1;
    const writable = this.isWritable(setId, values);
    this.entries.set(setId, {
      values,
      revision,
      savingRevision: existing?.savingRevision ?? null,
      savedRevision: existing?.savedRevision ?? null,
      /* An incomplete row is remembered but not queued: there is nothing
         valid to write yet, and marking it queued would show a spinner for a
         save that never comes. */
      status: writable ? 'queued' : 'idle',
    });
    this.emit();
    if (writable) this.schedule();
  }

  private schedule() {
    if (this.disposed || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  /** Write everything writable. Safe to call at any time. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const work: Promise<void>[] = [];
    for (const [setId, entry] of this.entries) {
      // One in flight per set; a later edit is picked up by the next pass.
      if (entry.savingRevision !== null) continue;
      if (entry.status !== 'queued' && entry.status !== 'error') continue;
      if (!this.isWritable(setId, entry.values)) continue;
      work.push(this.writeOne(setId));
    }
    await Promise.all(work);

    /* An edit arriving mid-flush leaves work behind. Draining here rather
       than waiting for the next keystroke means the last thing typed is not
       stranded when the user walks away. */
    const stillQueued = [...this.entries.entries()].some(
      ([setId, e]) =>
        e.savingRevision === null && e.status === 'queued' && this.isWritable(setId, e.values),
    );
    if (stillQueued) await this.flush();
  }

  private async writeOne(setId: string): Promise<void> {
    const entry = this.entries.get(setId);
    if (!entry) return;
    const revision = entry.revision;
    this.entries.set(setId, { ...entry, savingRevision: revision, status: 'saving' });
    this.emit();

    try {
      await this.save(setId, entry.values);
      const current = this.entries.get(setId);
      if (!current) return;
      if (current.revision !== revision) {
        /* Typed again while this was in flight. Keep the draft and let the
           next pass write it — dropping it here is how a newer value gets
           replaced by an older server echo. */
        this.entries.set(setId, { ...current, savingRevision: null, savedRevision: revision, status: 'queued' });
        this.emit();
        this.schedule();
        return;
      }
      /* Written and unchanged since. The draft is dropped so the row falls
         back to server data — the single source of truth once it agrees. */
      this.entries.delete(setId);
      this.emit();
    } catch {
      const current = this.entries.get(setId);
      if (!current) return;
      /* The draft survives a failure. Losing what someone typed because the
         network blinked is the one outcome this store exists to prevent. */
      this.entries.set(setId, { ...current, savingRevision: null, status: 'error' });
      this.emit();
    }
  }

  /**
   * Stop scheduling and let go of the timer.
   *
   * Called when the screen unmounts, after a final flush. Without it the
   * pending debounce keeps a handle open — which in tests holds the worker
   * open past the run, and in the app fires a write into a screen that is
   * gone.
   */
  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  /** Drop everything — used when the screen changes session. */
  reset(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.entries.clear();
    this.emit();
  }
}
