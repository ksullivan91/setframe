import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import styled from 'styled-components';
import { Info } from 'lucide-react';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/typeScale';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /**
   * Optional unit, e.g. "lb" for numeric weight fields (style guide §6).
   * Folded into the visible label ("Weight (lb)") rather than rendered as
   * an in-field suffix — at narrow widths inside a two-column form, an
   * adornment sharing the bordered input box with the value can be pushed
   * outside the field entirely (Story 22). The input itself only ever
   * holds the editable number.
   */
  unit?: string;
  /** Optional explanatory text shown via an info-icon tooltip next to the label. */
  labelHint?: string;
  error?: string;
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
`;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[4]}px;
`;

const Label = styled.label`
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const HintWrapper = styled.span`
  position: relative;
  display: inline-flex;

  &:hover > span,
  &:focus-within > span {
    opacity: 1;
    visibility: visible;
  }
`;

const HintButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  padding: 0;
  cursor: help;
  color: ${(p) => p.theme.text.disabled};

  &:hover,
  &:focus-visible {
    color: ${(p) => p.theme.text.secondary};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 2px;
    border-radius: 50%;
  }
`;

const HintBubble = styled.span`
  position: absolute;
  bottom: calc(100% + ${spacing[8]}px);
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: 220px;
  background: ${(p) => p.theme.text.primary};
  color: ${(p) => p.theme.surface.canvas};
  font-size: ${typeScale.helper.fontSize}px;
  line-height: 1.4;
  padding: ${spacing[8]}px ${spacing[12]}px;
  border-radius: ${radius.small}px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.1s ease;
  pointer-events: none;
  z-index: 10;
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

const ErrorText = styled.span`
  font-size: ${typeScale.helper.fontSize}px;
  color: ${(p) => p.theme.status.error};
`;

/** Input — labeled text/numeric field with optional unit suffix (style guide §6). */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, unit, labelHint, error, id, ...props },
  ref,
) {
  const generatedId = useId();
  const hintId = useId();
  const inputId = id ?? generatedId;
  return (
    <Wrapper>
      <LabelRow>
        <Label htmlFor={inputId}>{unit ? `${label} (${unit})` : label}</Label>
        {labelHint ? (
          <HintWrapper>
            <HintButton type="button" aria-describedby={hintId} aria-label={`What is ${label}?`}>
              <Info size={14} aria-hidden="true" />
            </HintButton>
            <HintBubble role="tooltip" id={hintId}>
              {labelHint}
            </HintBubble>
          </HintWrapper>
        ) : null}
      </LabelRow>
      <FieldRow>
        <StyledInput ref={ref} id={inputId} {...props} />
      </FieldRow>
      {error ? <ErrorText role="alert">{error}</ErrorText> : null}
    </Wrapper>
  );
});
