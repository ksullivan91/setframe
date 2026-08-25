/**
 * Turning Clerk's multi-step auth results into something a user can act on.
 *
 * `signIn.create()` / `signUp.create()` do NOT simply succeed or throw. They
 * resolve with a `status`, and `'complete'` is only one of several possible
 * outcomes — an account can still need email verification, a second factor,
 * or a fresh password. Branching on `status === 'complete'` alone and doing
 * nothing otherwise strands the user on a spinner that stops with no
 * navigation and no message, which is indistinguishable from the app being
 * broken.
 *
 * Clerk also throws structured API errors carrying a `longMessage` written
 * for end users. Swallowing those behind one hardcoded string tells someone
 * with an outage or a misconfigured key to "check your password".
 */

/** A Clerk API error: `{ errors: [{ message, longMessage, code }] }`. */
interface ClerkApiErrorShape {
  errors: Array<{ message?: string; longMessage?: string; code?: string }>;
}

function isClerkApiError(error: unknown): error is ClerkApiErrorShape {
  return (
    typeof error === 'object' &&
    error !== null &&
    Array.isArray((error as ClerkApiErrorShape).errors) &&
    (error as ClerkApiErrorShape).errors.length > 0
  );
}

/**
 * Clerk's own user-facing copy where it exists, so a wrong password, a rate
 * limit and an unreachable network read differently. `fallback` covers a
 * non-Clerk throw (a transport failure, typically).
 */
export function describeClerkError(error: unknown, fallback: string): string {
  if (isClerkApiError(error)) {
    const first = error.errors[0];
    const message = first?.longMessage ?? first?.message;
    if (message) return message;
  }
  return fallback;
}

/**
 * Why a flow stopped short of `'complete'`, phrased as the next action.
 *
 * These paths are deliberately explicit rather than folded into one generic
 * string: each needs a different response from the user, and several are not
 * yet implemented on this screen — saying so plainly beats a spinner that
 * stops for no visible reason. Anything genuinely unhandled still names the
 * status, so a bug report carries the one detail that identifies it.
 */
export function describeIncompleteSignIn(status: string | null | undefined): string {
  switch (status) {
    case 'needs_identifier':
      return 'Enter the email address for your account.';
    case 'needs_first_factor':
      return 'This account uses a different sign-in method. Try signing in on the web at setframe.app.';
    case 'needs_second_factor':
      return 'This account has two-factor authentication, which the mobile app does not support yet. Sign in on the web at setframe.app.';
    case 'needs_new_password':
      return 'This account needs a new password. Reset it on the web at setframe.app, then sign in here.';
    default:
      return `Sign-in could not be completed${status ? ` (${status})` : ''}. Try again, or sign in on the web at setframe.app.`;
  }
}

export function describeIncompleteSignUp(status: string | null | undefined): string {
  switch (status) {
    case 'missing_requirements':
      return 'This account needs email verification, which the mobile app does not support yet. Finish signing up on the web at setframe.app.';
    case 'abandoned':
      return 'That sign-up attempt expired. Start again.';
    default:
      return `Sign-up could not be completed${status ? ` (${status})` : ''}. Try again, or sign up on the web at setframe.app.`;
  }
}
