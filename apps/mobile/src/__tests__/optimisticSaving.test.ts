export {};

declare const __dirname: string;
interface NodeFs { readFileSync(f: string, e: string): string }
interface NodePath { join(...p: string[]): string }

const fs = require('fs') as NodeFs;

const path = require('path') as NodePath;
const log = () => fs.readFileSync(path.join(__dirname, '..', '..', 'app', '(tabs)', 'log.tsx'), 'utf8');

/**
 * Optimistic saving, and the one place it must not roll back.
 *
 * Source-level: driving a real rollback needs a failing PATCH, a populated
 * cache and a rendered screen per field, and what actually breaks is the
 * shape of the mutation rather than a render. WorkoutSessionScreenV2
 * established this contract; these assert Log follows it.
 */
describe('saving the day’s entry', () => {
  it('writes the value into the cache before the request resolves', () => {
    const s = log();
    expect(s).toContain('onMutate:');
    expect(s).toMatch(/queryClient\.setQueryData<DashboardTodayResponse>/);
  });

  it('keeps the previous copy so a failure can be undone', () => {
    const s = log();
    expect(s).toMatch(/const previous = queryClient\.getQueryData/);
    expect(s).toMatch(/onError:[\s\S]{0,400}context\?\.previous/);
  });

  it('cancels in-flight reads first, so a stale response cannot overwrite the optimistic value', () => {
    expect(log()).toMatch(/await queryClient\.cancelQueries/);
  });

  it('does not roll the journal back', () => {
    // A set row can roll back because the number is still in the input
    // beside it. A journal entry is prose typed into a field that has
    // already been committed — discarding it destroys the only copy.
    const s = log();
    expect(s).toMatch(/section === 'journal'[\s\S]{0,200}setJournal\(body\.notes\)/);
  });
});
