import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import styled from 'styled-components';
import { radius, spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Optional unit suffix, e.g. "lb" for numeric weight fields (style guide §6). */
  unit?: string;
  error?: string;
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
`;

const Label = styled.label`
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const FieldRow = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid ${(p) => p.theme.border.default};
  border-radius: ${radius.small}px;
  background: ${(p) => p.theme.surface.raised};
  padding: 0 ${spacing[12]}px;

  &:focus-within {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 1px;
  }
`;

const StyledInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  height: 40px;
  font-size: ${typeScale.body.fontSize}px;
  color: ${(p) => p.theme.text.primary};

  &::placeholder {
    color: ${(p) => p.theme.text.disabled};
  }
`;

const Unit = styled.span`
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const ErrorText = styled.span`
  font-size: ${typeScale.helper.fontSize}px;
  color: ${(p) => p.theme.status.error};
`;

/** Input — labeled text/numeric field with optional unit suffix (style guide §6). */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, unit, error, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Wrapper>
      <Label htmlFor={inputId}>{label}</Label>
      <FieldRow>
        <StyledInput ref={ref} id={inputId} {...props} />
        {unit ? <Unit>{unit}</Unit> : null}
      </FieldRow>
      {error ? <ErrorText role="alert">{error}</ErrorText> : null}
    </Wrapper>
  );
});
