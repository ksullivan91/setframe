import styled from 'styled-components';
import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';

/**
 * SignIn — page chrome only around Clerk's own `<SignIn/>` mount point.
 * Per style guide §10, Clerk owns the actual auth UI/logic; we just
 * provide the centered card, wordmark, and tagline around it.
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

export function SignInPage() {
  return (
    <Wrapper>
      <Wordmark>Setline</Wordmark>
      <Tagline>Training, tracked — synced with Apple Health.</Tagline>
      <ClerkSignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </Wrapper>
  );
}
