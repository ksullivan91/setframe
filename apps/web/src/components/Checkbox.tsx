import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import styled from 'styled-components';
import { Check } from 'lucide-react';
import { spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/typeScale';

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Wrapper = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[8]}px;
  cursor: pointer;
`;

const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 24px;
  height: 24px;
  margin: 0;
  cursor: pointer;

  &:focus-visible + span {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 2px;
  }
`;

/**
 * Circular checkbox glyph. Fixed 24x24 on both axes (not AUTO-hugged) —
 * the style guide flagged an earlier lopsided 13x24 render caused by an
 * auto-layout frame hugging the checkmark asymmetrically; this keeps a
 * true 1:1 circle in every state.
 */
const CircleGlyph = styled.span<{ $checked: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1.5px solid
    ${(p) => (p.$checked ? p.theme.action.primary : p.theme.border.default)};
  background: ${(p) => (p.$checked ? p.theme.action.primary : 'transparent')};
  color: ${(p) => p.theme.action.primaryText};
  flex-shrink: 0;
`;

const LabelText = styled.span`
  font-size: ${typeScale.body.fontSize}px;
  color: ${(p) => p.theme.text.primary};
`;

/** Checkbox — clean circular checkbox (style guide §6 bug fix note). */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, id, checked, ...props },
  ref,
) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  return (
    <Wrapper htmlFor={checkboxId}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <HiddenInput ref={ref} id={checkboxId} type="checkbox" checked={checked} {...props} />
        <CircleGlyph $checked={!!checked} aria-hidden="true">
          {checked ? <Check size={14} strokeWidth={3} /> : null}
        </CircleGlyph>
      </span>
      {label ? <LabelText>{label}</LabelText> : null}
    </Wrapper>
  );
});
