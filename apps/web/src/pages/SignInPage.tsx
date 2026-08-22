import styled from 'styled-components';
import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { spacing, radius } from '@setframe/design-tokens';
import { typeScale } from '../theme/typeScale';

/**
 * SignIn — page chrome only around Clerk's own `<SignIn/>` mount point.
 * Per style guide §10, Clerk owns the actual auth UI/logic; we just
 * provide the centered card, wordmark, and tagline around it. Figma
 * node 17:2 centers the Clerk mount inside a 360px raised card — wrap
 * it here to match instead of relying on Clerk's own default chrome.
 */
const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing[24]}px;
  background: ${(p) => p.theme.surface.canvas};
  padding: ${spacing[24]}px;
`;

const Wordmark = styled.h1`
  font-size: ${typeScale.display.fontSize}px;
  font-weight: ${typeScale.display.fontWeight};
  color: ${(p) => p.theme.text.primary};
  margin: 0;
`;

const Tagline = styled.p`
  font-size: ${typeScale.body.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
  margin: 0;
`;

const AuthCard = styled.div`
  width: 100%;
  max-width: 360px;
  background: ${(p) => p.theme.surface.raised};
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: ${radius.large}px;
  padding: ${spacing[24]}px;
  display: flex;
  justify-content: center;
`;

export function SignInPage() {
  return (
    <Wrapper>
      <Wordmark>Setframe</Wordmark>
      <Tagline>Plan. Log. Progress.</Tagline>
      <AuthCard>
        <ClerkSignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </AuthCard>
    </Wrapper>
  );
}
