import { useState } from 'react';
import styled from 'styled-components';
import { Copy, Minus, Plus } from 'lucide-react';
import { detectWeightPR, detectRepPR } from '@setline/domain';
import { spacing, radius } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { Card, Checkbox, Input, IconButton, Button, PRBadge } from '../components';

/**
 * WorkoutLogger — the master spec's most emphasized screen. Implements
 * style guide §9 (SetRow/Editable: checkbox + weight + reps + duplicate/
 * remove) and §17 (ghost "prev X" last-session text + PR trophy badge,
 * computed optimistically client-side via packages/domain per master
 * spec §9's "safe to call identically from API and clients" note).
 *
 * Mobile-first: each SetRow wraps onto two lines on narrow viewports
 * (checkbox/label/PR badge on one line, weight/reps/actions below) to
 * avoid cramming 6 columns into a 390px-wide frame; from `tablet` up it
 * becomes the single-row grid.
 */
interface SetRow {
  id: string;
  weightValue: number | null;
  reps: number | null;
  completed: boolean;
  prevWeight: number;
  prevReps: number;
}

const ExerciseName = styled.h2`
  font-size: ${typeScale.sectionTitle.fontSize}px;
  margin: 0 0 ${spacing[8]}px;
`;

const Prescription = styled.p`
  font-size: ${typeScale.compactBody.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
  margin: 0 0 ${spacing[16]}px;
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${spacing[8]}px;
  padding: ${spacing[8]}px 0;
  border-top: 1px solid ${(p) => p.theme.border.subtle};

  ${mq.tablet} {
    display: grid;
    grid-template-columns: auto auto 1fr 1fr auto auto;
  }
`;

const SetLabel = styled.span`
  font-size: ${typeScale.body.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
  width: 48px;
`;

const GhostText = styled.span`
  display: block;
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.disabled};
`;

const NumericInput = styled.input`
  width: 100%;
  height: 40px;
  border: 1px solid ${(p) => p.theme.border.default};
  border-radius: ${radius.small}px;
  padding: 0 ${spacing[8]}px;
  font-size: ${typeScale.numericWorkoutSet.fontSize}px;
  font-variant-numeric: tabular-nums;
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
`;

const InputGroup = styled.div`
  flex: 1 1 40%;

  ${mq.tablet} {
    flex: initial;
  }
`;

const RowActions = styled.div`
  display: flex;
  gap: ${spacing[4]}px;
  margin-left: auto;
`;

const AddExercise = styled.button`
  width: 100%;
  margin-top: ${spacing[16]}px;
  padding: ${spacing[12]}px;
  border: 1px dashed ${(p) => p.theme.border.default};
  border-radius: ${radius.small}px;
  background: transparent;
  color: ${(p) => p.theme.text.secondary};
  cursor: pointer;
`;

const initialSets: SetRow[] = [
  { id: 's1', weightValue: 185, reps: 5, completed: true, prevWeight: 185, prevReps: 5 },
  { id: 's2', weightValue: 185, reps: 5, completed: true, prevWeight: 185, prevReps: 5 },
  { id: 's3', weightValue: 195, reps: 6, completed: false, prevWeight: 185, prevReps: 8 },
];

export function WorkoutLoggerPage() {
  const [sets, setSets] = useState(initialSets);

  const history = sets
    .filter((s) => s.completed)
    .map((s) => ({ weightValue: s.prevWeight, reps: s.prevReps }));

  function updateSet(id: string, patch: Partial<SetRow>) {
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function duplicateSet(id: string) {
    const source = sets.find((s) => s.id === id);
    if (!source) return;
    setSets((prev) => [
      ...prev,
      { ...source, id: crypto.randomUUID(), completed: false },
    ]);
  }

  function removeSet(id: string) {
    setSets((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      <h1>Push Day</h1>
      <Card>
        <ExerciseName>Barbell Bench Press</ExerciseName>
        <Prescription>Target: 3 sets × 5–8 reps</Prescription>

        {sets.map((set, i) => {
          const candidate = { weightValue: set.weightValue, reps: set.reps };
          const isPr =
            set.completed &&
            (detectWeightPR(candidate, history) || detectRepPR(candidate, history));

          return (
            <Row key={set.id}>
              <Checkbox
                aria-label={`Mark set ${i + 1} complete`}
                checked={set.completed}
                onChange={(e) => updateSet(set.id, { completed: e.target.checked })}
              />
              <SetLabel>Set {i + 1}</SetLabel>
              <InputGroup>
                <NumericInput
                  type="number"
                  inputMode="decimal"
                  aria-label={`Set ${i + 1} weight`}
                  value={set.weightValue ?? ''}
                  onChange={(e) =>
                    updateSet(set.id, { weightValue: e.target.valueAsNumber || null })
                  }
                />
                <GhostText>prev {set.prevWeight}</GhostText>
              </InputGroup>
              <InputGroup>
                <NumericInput
                  type="number"
                  inputMode="numeric"
                  aria-label={`Set ${i + 1} reps`}
                  value={set.reps ?? ''}
                  onChange={(e) => updateSet(set.id, { reps: e.target.valueAsNumber || null })}
                />
                <GhostText>prev {set.prevReps}</GhostText>
              </InputGroup>
              {isPr ? <PRBadge /> : <span />}
              <RowActions>
                <IconButton aria-label={`Duplicate set ${i + 1}`} onClick={() => duplicateSet(set.id)}>
                  <Copy size={16} />
                </IconButton>
                <IconButton aria-label={`Remove set ${i + 1}`} onClick={() => removeSet(set.id)}>
                  <Minus size={16} />
                </IconButton>
              </RowActions>
            </Row>
          );
        })}

        <AddExercise
          onClick={() =>
            setSets((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                weightValue: null,
                reps: null,
                completed: false,
                prevWeight: 0,
                prevReps: 0,
              },
            ])
          }
        >
          <Plus size={16} style={{ marginRight: spacing[4] }} /> Add set
        </AddExercise>
      </Card>

      <Button variant="primary" style={{ marginTop: spacing[16] }}>
        Finish Workout
      </Button>
    </div>
  );
}
