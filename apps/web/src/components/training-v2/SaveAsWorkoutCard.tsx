import { useState } from 'react';
import styled from 'styled-components';
import { describeDerivedExercise, type DerivedExercise } from '@setframe/domain';
import { training } from '@setframe/design-tokens';

/**
 * "Do this one again?" — the offer to turn a performed session into a
 * reusable workout.
 *
 * Figma: `Explore/Mobile/Just 4 · Finished, save it?` (168:834) and
 * `Just 5 · Name and save it` (169:838).
 *
 * **The offer sits under the completion banner, never in a modal over it.**
 * The workout is already recorded; this is an optional extra, and blocking
 * the acknowledgement of what was just done to ask for it would be the wrong
 * trade.
 *
 * Saving creates a *new* `day_type` and never writes back into an existing
 * one (ADR 0005), and it creates no plan — `day_type` is keyed on `userId`
 * alone, so a saved workout needs nothing to live in.
 */

const Card = styled.section`
  width: ${training.cardWidth}px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: ${training.cardRadius}px;
  background: ${({ theme }) => theme.surface.raised};
  box-shadow: inset 0 0 0 1.5px ${({ theme }) => theme.action.primary};
`;

const Title = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};
`;

const Body = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
`;

const Primary = styled.button`
  flex: 1;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: ${({ theme }) => theme.action.primary};
  color: ${({ theme }) => theme.action.primaryText};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const Secondary = styled.button`
  flex: 0 0 104px;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: ${({ theme }) => theme.surface.sunken};
  color: ${({ theme }) => theme.text.secondary};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
`;

const Note = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.text.disabled};
`;

const Label = styled.span`
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.text.disabled};
`;

const Input = styled.input`
  width: 100%;
  height: 52px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1.5px solid ${({ theme }) => theme.action.primary};
  background: ${({ theme }) => theme.surface.raised};
  color: ${({ theme }) => theme.text.primary};
  /* 16px is the iOS zoom threshold (story 28). */
  font-size: 16px;
  font-weight: 500;
`;

const Preview = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0 0;
`;

const PreviewRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PreviewName = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: ${({ theme }) => theme.text.primary};
`;

const PreviewMeta = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.text.secondary};
`;

export interface SaveAsWorkoutCardProps {
  /** What will be copied, derived from the session. */
  derived: readonly (DerivedExercise & { name: string })[];
  /**
   * True when the user has no plan yet.
   *
   * Saving then creates the plan first, so the workout has somewhere to live
   * and cannot end up somewhere the user never looks. A workout saved with no
   * plan is legal in the schema but was reported as "I'm not sure it actually
   * saved" — the naming step is what makes the outcome visible.
   */
  needsProgram?: boolean;
  onSave: (input: { workoutName: string; programName?: string }) => void;
  onDismiss: () => void;
  busy?: boolean;
}

export function SaveAsWorkoutCard({
  derived,
  needsProgram = false,
  onSave,
  onDismiss,
  busy,
}: SaveAsWorkoutCardProps) {
  /* `offer` → (`program`, only with no plan) → `workout`. */
  const [step, setStep] = useState<'offer' | 'program' | 'workout'>('offer');
  const [name, setName] = useState('');
  const [programName, setProgramName] = useState('');

  if (step === 'offer') {
    return (
      <Card data-testid="save-as-workout">
        <Title>Do this one again?</Title>
        <Body>
          Save it as a workout and it becomes something you can start with one tap, or put on a day
          of the week.
        </Body>
        <Row>
          <Primary
            type="button"
            onClick={() => setStep(needsProgram ? 'program' : 'workout')}
            data-testid="save-as-workout-open"
          >
            Save as a workout
          </Primary>
          <Secondary type="button" onClick={onDismiss} data-testid="save-as-workout-dismiss">
            Not now
          </Secondary>
        </Row>
        {/* Says the session is already safe, so the offer cannot read as a
            condition of keeping it. */}
        <Note>Either way, this workout is already saved to your history.</Note>
      </Card>
    );
  }

  if (step === 'program') {
    return (
      <Card data-testid="save-as-program-form">
        <Title>First, name your plan</Title>
        {/* Says what a plan IS and why this step exists. Asking a novice to
            name something they have never heard of, with no explanation, is
            the kind of wall this whole flow was designed to avoid. */}
        <Body>
          A plan is where your workouts live. It is what puts them on days of the week, so Today
          knows what is next and your history stays grouped with the training it came from.
        </Body>
        <Label>Plan name</Label>
        <Input
          value={programName}
          onChange={(event) => setProgramName(event.target.value)}
          placeholder="My training"
          aria-label="Plan name"
          data-testid="save-as-program-name"
          autoFocus
        />
        <Note>You only do this once. You can rename it, or add more plans, whenever you like.</Note>
        <Primary
          type="button"
          disabled={!programName.trim()}
          onClick={() => setStep('workout')}
          data-testid="save-as-program-continue"
        >
          Continue
        </Primary>
      </Card>
    );
  }

  return (
    <Card data-testid="save-as-workout-form">
      <Title>What is this workout?</Title>
      <Label>Workout name</Label>
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Leg Day"
        aria-label="Workout name"
        data-testid="save-as-workout-name"
        autoFocus
      />

      {/* Shows exactly what is copied — "save as a workout" is otherwise an
          opaque promise. */}
      <Label>What gets saved</Label>
      <Preview>
        {derived.map((item) => (
          <PreviewRow key={item.exerciseId}>
            <PreviewName>{item.name}</PreviewName>
            <PreviewMeta>{describeDerivedExercise(item)}</PreviewMeta>
          </PreviewRow>
        ))}
      </Preview>
      <Note>Weights are not saved as targets — you will log those fresh each time.</Note>

      <Primary
        type="button"
        disabled={!name.trim() || busy}
        onClick={() =>
          onSave({
            workoutName: name.trim(),
            programName: needsProgram ? programName.trim() : undefined,
          })
        }
        data-testid="save-as-workout-confirm"
      >
        Save workout
      </Primary>
    </Card>
  );
}
