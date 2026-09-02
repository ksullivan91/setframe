import * as SplashScreen from 'expo-splash-screen';

/**
 * Holds the launch screen until the first surface is genuinely ready.
 *
 * Without this the splash hides on the first rendered frame, which is the
 * auth gate returning `null` — so launch reads as splash, blank, a
 * half-populated Today, then Today. The logo is the right thing to look at
 * while that resolves.
 *
 * `hide()` is called by whichever surface wins the race: Today once its
 * data has landed, or the auth screens, which have nothing to wait for.
 * Idempotent, so it does not matter which arrives first.
 */
let hidden = false;

/**
 * The upper bound on how long the logo may stay up.
 *
 * A held splash and a hung app look identical from the outside, so the
 * hold must be a best case rather than a promise. If the data has not
 * arrived by now the screen shows its skeletons instead, which at least
 * tells the user something is happening.
 */
export const SPLASH_MAX_MS = 2500;


/** Called once at module load in the root layout. */
export function holdSplash(): void {
  void SplashScreen.preventAutoHideAsync().catch(() => {
    // Already hidden, or unavailable in this environment. Never fatal:
    // a splash that will not hold is a worse launch, not a broken app.
  });

  /* The cap belongs HERE, not in whichever screen happens to render.
     It first lived inside Today's readiness effect — so a user routed to
     onboarding instead never armed it, nothing ever called release(), and
     the app sat behind the logo forever. A held splash and a hung app look
     identical from outside, which is exactly why the guarantee has to be
     unconditional. */
  setTimeout(releaseSplash, SPLASH_MAX_MS);
}

export function releaseSplash(): void {
  if (hidden) return;
  hidden = true;
  void SplashScreen.hideAsync().catch(() => {});
}
