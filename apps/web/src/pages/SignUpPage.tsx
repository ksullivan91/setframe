import styled from 'styled-components';
import { SignUp as ClerkSignUp } from '@clerk/clerk-react';
import { spacing } from '@setframe/design-tokens';

/** SignUp — Clerk's stock `<SignUp/>`, centered. See SignInPage for why the
 *  custom `appearance` theming and card chrome were removed. */
const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${spacing[24]}px;
`;

export function SignUpPage() {
  return (
    <Wrapper>
      <ClerkSignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </Wrapper>
  );
}
