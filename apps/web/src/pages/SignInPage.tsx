import styled from 'styled-components';
import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { spacing } from '@setframe/design-tokens';

/**
 * SignIn — Clerk's stock `<SignIn/>`, centered and otherwise untouched.
 *
 * We previously themed this via Clerk's `appearance` API and wrapped it in
 * our own card to match the Figma auth frames. The result looked worse than
 * the default: our card nested inside Clerk's own, and the token overrides
 * fought Clerk's internal layout. Until we leave Clerk's development mode
 * (which forces a "Secured by Clerk" badge we cannot style anyway) and set
 * up a production instance on a custom domain, the stock component is the
 * better-looking and lower-maintenance option.
 *
 * Deliberately no `appearance` prop and no surrounding chrome — sign-in
 * methods (email + Google) are configured in the Clerk dashboard, not here.
 */
const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${spacing[24]}px;
`;

export function SignInPage() {
  return (
    <Wrapper>
      <ClerkSignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </Wrapper>
  );
}
