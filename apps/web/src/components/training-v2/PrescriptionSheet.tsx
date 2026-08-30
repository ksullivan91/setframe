import { useState } from 'react';
import styled from 'styled-components';
import type { Prescription } from '@setframe/schemas';
import { getPrescriptionDefinition, parseOptionalNumber } from '@setframe/domain';
import { workoutEditor } from '@setframe/design-tokens';

/**
 * The prescription sheet — what an exercise's `⋯` opens.
 *
 * Figma: `Explore/Mobile/Training 4 · Set an exercise's targets` (152:708).
 *
 * Three rules the design states and this enforces:
 *
 * - **Kind is read-only.** Shown as a pill reading "set when added". Changing
 *   kind would change what every already-logged set *means* — the same
 *   columns read as a different representation.
 * - **Blank is allowed.** Story 19 made planned values optional, and the hint
 *   says so rather than leaving it to be discovered.
 * - **Replace is not remove-then-add.** Replacing swaps which exercise the
 *   slot points at and keeps the prescription; remove-then-add loses it.
 */

const Scrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
`;

const Sheet = styled.div`
  width: 100%;
  padding: ${workoutEditor.sheet.paddingTop}px 0
    max(${workoutEditor.sheet.paddingBottom}px, env(safe-area-inset-bottom));
  background: ${({ theme }) => theme.surface.raised};
  border-radius: 16px 16px 0 0;
`;

const GrabberRow = styled.div`
  display: flex;
  justify-content: center;
  padding-bottom: 8px;
`;

const Grabber = styled.span`
  width: ${workoutEditor.sheet.grabberWidth}px;
  height: ${workoutEditor.sheet.grabberHeight}px;
  border-radius: 999px;
  background: ${({ theme }) => theme.border.default};
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${workoutEditor.sheet.header.gap}px;
  padding: ${workoutEditor.sheet.header.paddingTop}px ${workoutEditor.sheet.header.paddingX}px
    ${workoutEditor.sheet.header.paddingBottom}px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${workoutEditor.sheet.header.titleSize}px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: ${workoutEditor.sheet.header.subtitleSize}px;
  color: ${({ theme }) => theme.text.secondary};
`;

const KindRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${workoutEditor.sheet.kind.gap}px;
  padding: 0 ${workoutEditor.sheet.header.paddingX}px ${workoutEditor.sheet.kind.paddingBottom}px;
`;

const KindPill = styled.span`
  padding: ${workoutEditor.sheet.kind.pillPaddingY}px ${workoutEditor.sheet.kind.pillPaddingX}px;
  border-radius: 999px;
  background: ${({ theme }) => theme.surface.sunken};
  color: ${({ theme }) => theme.text.primary};
  font-size: ${workoutEditor.sheet.kind.pillLabelSize}px;
  font-weight: 600;
`;

const KindNote = styled.span`
  font-size: ${workoutEditor.sheet.kind.noteSize}px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Fields = styled.div`
  display: flex;
  gap: ${workoutEditor.sheet.field.gap}px;
  padding: 0 ${workoutEditor.sheet.header.paddingX}px 16px;
`;

const Field = styled.label`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${workoutEditor.sheet.field.labelGap}px;
`;

const FieldLabel = styled.span`
  font-size: ${workoutEditor.sheet.field.labelSize}px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.text.disabled};
`;

const Input = styled.input`
  width: 100%;
  height: ${workoutEditor.sheet.field.inputHeight}px;
  padding: 0 12px;
  border: none;
  border-radius: ${workoutEditor.sheet.field.inputRadius}px;
  background: ${({ theme }) => theme.surface.canvas};
  color: ${({ theme }) => theme.text.primary};
  /* 16px is the iOS zoom threshold (story 28), and happens to be the
     design's value here too. */
  font-size: ${workoutEditor.sheet.field.valueSize}px;
  font-weight: 600;
  text-align: center;
`;

const Hint = styled.p`
  margin: 0;
  padding: 0 ${workoutEditor.sheet.header.paddingX}px 14px;
  font-size: ${workoutEditor.sheet.hintSize}px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Divider = styled.hr`
  margin: 0;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.surface.sunken};
`;

const Action = styled.button<{ $destructive?: boolean }>`
  width: 100%;
  height: ${workoutEditor.sheet.actionHeight}px;
  padding: 0 ${workoutEditor.sheet.header.paddingX}px;
  border: none;
  background: none;
  text-align: left;
  font-size: ${workoutEditor.sheet.actionLabelSize}px;
  font-weight: 500;
  cursor: pointer;
  color: ${({ theme, $destructive }) => ($destructive ? theme.status.error : theme.text.primary)};
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.action.primary};
    outline-offset: -2px;
  }
`;

/** The editable numeric fields, by prescription kind. */
const FIELDS_BY_KIND: Record<string, { key: string; label: string }[]> = {
  sets_reps: [
    { key: 'sets', label: 'Sets' },
    { key: 'repsMin', label: 'Reps' },
    { key: 'weightValue', label: 'Weight' },
  ],
  top_set_backoff: [
    { key: 'sets', label: 'Sets' },
    { key: 'repsMin', label: 'Reps' },
    { key: 'weightValue', label: 'Weight' },
  ],
  per_side: [
    { key: 'sets', label: 'Sets' },
    { key: 'repsMin', label: 'Reps' },
  ],
  bodyweight_reps: [
    { key: 'sets', label: 'Sets' },
    { key: 'repsMin', label: 'Reps' },
  ],
  timed: [{ key: 'durationMinutes', label: 'Minutes' }],
  duration: [{ key: 'durationMinutes', label: 'Minutes' }],
  distance: [{ key: 'distanceMiles', label: 'Miles' }],
  distanceDuration: [
    { key: 'distanceMiles', label: 'Miles' },
    { key: 'durationMinutes', label: 'Minutes' },
  ],
};

export interface PrescriptionSheetProps {
  exerciseName: string;
  workoutName: string;
  prescription: Prescription | null;
  onClose: () => void;
  onSave: (prescription: Prescription) => void;
  onReplace: () => void;
  onRemove: () => void;
}

export function PrescriptionSheet({
  exerciseName,
  workoutName,
  prescription,
  onClose,
  onSave,
  onReplace,
  onRemove,
}: PrescriptionSheetProps) {
  const kind = prescription?.kind ?? 'sets_reps';
  const definition = getPrescriptionDefinition(prescription);
  const fields = FIELDS_BY_KIND[kind] ?? FIELDS_BY_KIND.sets_reps!;
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => {
        const value = (prescription as Record<string, unknown> | null)?.[field.key];
        return [field.key, value == null ? '' : String(value)];
      }),
    ),
  );

  const commit = () => {
    /* Blank means "no target", not zero. parseOptionalNumber turns '' into
       undefined so the field is absent from the prescription rather than
       stored as a 0 the logger would render as a real target. */
    const next: Record<string, unknown> = { kind };
    for (const field of fields) {
      const parsed = parseOptionalNumber(draft[field.key] ?? '');
      if (parsed != null) next[field.key] = parsed;
    }
    onSave(next as Prescription);
  };

  return (
    <Scrim onClick={onClose} data-testid="prescription-scrim">
      <Sheet
        role="dialog"
        aria-modal="true"
        aria-label={`${exerciseName} targets`}
        onClick={(event) => event.stopPropagation()}
        data-testid="prescription-sheet"
      >
        <GrabberRow>
          <Grabber aria-hidden="true" />
        </GrabberRow>

        <Header>
          <Title>{exerciseName}</Title>
          <Subtitle>How this is prescribed inside {workoutName}</Subtitle>
        </Header>

        <KindRow>
          {/* Read-only: changing kind would change what every already-logged
              set means, since the same columns read as a different
              representation. */}
          <KindPill data-testid="prescription-kind">{definition.label}</KindPill>
          <KindNote>set when added</KindNote>
        </KindRow>

        <Fields>
          {fields.map((field) => (
            <Field key={field.key}>
              <FieldLabel>{field.label}</FieldLabel>
              <Input
                inputMode="numeric"
                value={draft[field.key] ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                }
                onBlur={commit}
                data-testid={`prescription-${field.key}`}
              />
            </Field>
          ))}
        </Fields>

        <Hint>Leave any of these blank to log it freely — planned targets are optional.</Hint>

        <Divider />
        {/* Replace keeps the prescription; remove-then-add would lose it. */}
        <Action type="button" onClick={onReplace} data-testid="prescription-replace">
          Replace exercise
        </Action>
        <Action type="button" $destructive onClick={onRemove} data-testid="prescription-remove">
          Remove from this workout
        </Action>
      </Sheet>
    </Scrim>
  );
}
