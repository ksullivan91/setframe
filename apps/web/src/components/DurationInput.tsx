import { useId } from 'react';
import styled from 'styled-components';
import { spacing } from '@setframe/design-tokens';
import { validateDurationDraft, type DurationDraft } from '@setframe/domain';
import { Input } from './Input';
import { typeScale } from '../theme/typeScale';

/**
 * Two-field duration entry — minutes and seconds under one Duration label.
 *
 * Story 63. A single `Duration (min)` field caused a real user to type
 * `2309` meaning 23:09; the input looked like it accepted any number while
 * the model meant whole minutes, and nothing reconciled the two. Two labelled
 * boxes make the model self-evident without a hint, which is the actual fix —
 * a longer helper string under one ambiguous box would not have been.
 *
 * Deliberately **not** an hours field. Minutes stay primary even past an
 * hour (`75 min 20 sec`), because that is how the product's user describes
 * activity length and a unit that changes shape at sixty minutes is harder
 * to scan than one that does not.
 *
 * Composed from `Input` rather than raw `<input>` so it inherits Story 28's
 * 16px minimum font size, which is what stops iOS Safari zooming on focus and
 * leaving the viewport stuck.
 */

const Group = styled.fieldset`
  border: 0;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${spacing[4]}px;
`;

const GroupLabel = styled.legend`
  padding: 0;
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

/**
 * Two columns at every width. The fields are short and the pairing is the
 * whole point — stacking them would read as two unrelated questions, which is
 * the ambiguity this component exists to remove.
 */
const Fields = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${spacing[8]}px;
  align-items: start;
`;

export interface DurationInputProps {
  value: DurationDraft;
  onChange: (next: DurationDraft) => void;
  /** Group label; the two inputs are named relative to it. */
  label?: string;
  /** Shown under the group when the caller requires a duration and has none. */
  error?: string;
  disabled?: boolean;
}

const Message = styled.p`
  margin: 0;
  font-size: ${typeScale.helper.fontSize}px;
  color: ${(p) => p.theme.status.error};
`;

export function DurationInput({
  value,
  onChange,
  label = 'Duration',
  error,
  disabled,
}: DurationInputProps) {
  const groupId = useId();
  const validation = validateDurationDraft(value);

  return (
    <Group aria-describedby={error ? `${groupId}-error` : undefined}>
      <GroupLabel>{label}</GroupLabel>
      <Fields>
        <Input
          /* Named relative to the group rather than both being "Duration":
             two controls announced identically are indistinguishable to a
             screen-reader user, who then cannot tell which box they are in. */
          label={`${label} minutes`}
          unit="min"
          value={value.minutes}
          onChange={(event) => onChange({ ...value, minutes: event.target.value })}
          error={validation.errors.minutes}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          data-testid="duration-minutes"
        />
        <Input
          label={`${label} seconds`}
          unit="sec"
          value={value.seconds}
          onChange={(event) => onChange({ ...value, seconds: event.target.value })}
          error={validation.errors.seconds}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          data-testid="duration-seconds"
        />
      </Fields>
      {error ? (
        <Message id={`${groupId}-error`} role="alert" data-testid="duration-error">
          {error}
        </Message>
      ) : null}
    </Group>
  );
}
