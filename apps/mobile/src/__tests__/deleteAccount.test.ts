export {};

declare const __dirname: string;
interface NodeFs { readFileSync(file: string, encoding: string): string }
interface NodePath { join(...parts: string[]): string }
const fs = require('fs') as NodeFs;
const path = require('path') as NodePath;

const src = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const app = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', '..', 'app', ...p), 'utf8');

/**
 * Account deletion is required by App Store Review Guideline 5.1.1(v), and
 * the control shipped as `onPress={() => {}}` — present, discoverable, and
 * doing nothing. These hold the parts that would fail quietly.
 */
describe('the delete control actually deletes', () => {
  /* Settings moved into the Log tab's stack so it keeps the tab bar and
     gets a back arrow (ADR 0013); the screen itself now lives in
     src/screens, with the route file a thin re-export. */
  const settings = () =>
    fs.readFileSync(path.join(__dirname, '..', 'screens', 'SettingsScreen.tsx'), 'utf8');

  it('is wired to something', () => {
    const source = settings();
    expect(source).not.toMatch(/label="Delete account"[\s\S]{0,120}onPress=\{\(\) => \{\}\}/);
    expect(source).toContain('setConfirmingDelete(true)');
  });

  it('confirms before deleting', () => {
    // A destructive, irreversible action does not fire from one tap.
    const source = settings();
    expect(source).toContain('DeleteAccountSheet');
    expect(source).toContain('onConfirm={() => deleteAccount.mutate()}');
  });

  it('signs out and clears the cache once the account is gone', () => {
    /* Every query behind this screen would 401 against a deleted account,
       so leaving the user on it renders a dead session. */
    const source = settings();
    const success = source.slice(source.indexOf('const deleteAccount'));
    expect(success.slice(0, 600)).toContain('queryClient.clear()');
    expect(success.slice(0, 600)).toContain('await signOut()');
  });

  it('says nothing was removed when deletion fails', () => {
    /* The endpoint is atomic, so a failure really does mean nothing went.
       Telling the user otherwise would be a lie in the frightening
       direction. */
    expect(settings()).toContain('Nothing was removed');
  });
});

describe('the confirmation sheet', () => {
  const sheet = () => src('components', 'DeleteAccountSheet.tsx');

  it('names what is deleted rather than saying "your data"', () => {
    const source = sheet();
    for (const line of ['Every workout and set', 'plans, workouts and schedule', 'email is freed']) {
      expect(source).toContain(line);
    }
  });

  it('says Apple Health is untouched', () => {
    /* Someone deleting their account should not be left wondering whether
       years of Health history went with it. */
    expect(sheet()).toContain('Nothing is removed from Apple Health');
  });

  it('cannot be dismissed mid-delete', () => {
    // Backing out of a running deletion leaves the user guessing.
    expect(sheet()).toContain('onRequestClose={busy ? () => {} : onCancel}');
  });
});
