import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import styled from 'styled-components';
import { ChevronDown } from 'lucide-react';
import { radius, spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
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

const Field = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  svg {
    position: absolute;
    right: ${spacing[12]}px;
    pointer-events: none;
    color: ${(p) => p.theme.text.secondary};
  }
`;

const StyledSelect = styled.select`
  appearance: none;
  width: 100%;
  height: 40px;
  padding: 0 ${spacing[32]}px 0 ${spacing[12]}px;
  border: 1px solid ${(p) => p.theme.border.default};
  border-radius: ${radius.small}px;
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
  font-size: ${typeScale.body.fontSize}px;

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 1px;
  }
`;

/** Select — native `<select>`-shaped dropdown for small fixed option sets (style guide §8). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, id, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <Wrapper>
      <Label htmlFor={selectId}>{label}</Label>
      <Field>
        <StyledSelect ref={ref} id={selectId} {...props}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </StyledSelect>
        <ChevronDown size={16} aria-hidden="true" />
      </Field>
    </Wrapper>
  );
});
