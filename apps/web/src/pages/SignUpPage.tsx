import styled from 'styled-components';
import { SignUp as ClerkSignUp } from '@clerk/clerk-react';
import { spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';

/** SignUp — same Clerk-chrome pattern as SignInPage, per style guide §13. */
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

export function SignUpPage() {
  return (
    <Wrapper>
      <Wordmark>Setline</Wordmark>
      <Tagline>Create your account to start tracking.</Tagline>
      <ClerkSignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </Wrapper>
  );
}
