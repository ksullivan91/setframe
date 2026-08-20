import { useState } from 'react';
import styled from 'styled-components';
import { GripVertical, Plus } from 'lucide-react';
import { spacing, radius } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import type { ProgressionRuleType } from '@setline/schemas';
import { Card, Select, Badge } from '../components';

/**
 * ProgramEditor — prescription-type-aware editor + plain-language
 * progression rule description (style guide §10, §18 Idea 3). Web is
 * richer than mobile per §13/§14 (mobile defers editing to web).
 * Mobile-first: the day list stacks single-column (matching the mobile
 * drill-in view); from `desktop` up it becomes a 2-column grid so the
 * weekly sequence reads more like a calendar, per the "web can be
 * richer" direction.
 */
const progressionRuleCopy: Record<ProgressionRuleType, string> = {
  double_progression:
    'Increase reps each session until you hit the top of the rep range, then add weight and reset to the bottom.',
  linear:
    'Add weight every session when you complete all prescribed reps. Best for beginners on compound lifts.',
  manual: 'Weight and reps are adjusted manually each session — no automatic progression rule applied.',
};

const progressionOptions = [
  { value: 'double_progression', label: 'Double progression' },
  { value: 'linear', label: 'Linear (+5lb per session)' },
  { value: 'manual', label: 'Manual' },
];

interface ExerciseRow {
  id: string;
  name: string;
  prescriptionSummary: string;
}

const Header = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${spacing[12]}px;
  margin-bottom: ${spacing[24]}px;
`;

const DayList = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[8]}px;
  margin-bottom: ${spacing[24]}px;

  ${mq.desktop} {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const DayRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  padding: ${spacing[12]}px;
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: ${radius.small}px;
  background: ${(p) => p.theme.surface.raised};
`;

const ExerciseRowEl = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${spacing[8]}px;
  padding: ${spacing[8]}px 0;
  border-top: 1px solid ${(p) => p.theme.border.subtle};
`;

const Description = styled.p`
  font-size: ${typeScale.helper.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
  margin: ${spacing[4]}px 0 0;
`;

const exercises: ExerciseRow[] = [
  { id: 'e1', name: 'Barbell Bench Press', prescriptionSummary: '3 × 5–8 @ 185 lb' },
  { id: 'e2', name: 'Overhead Press', prescriptionSummary: '3 × 6–10 @ 95 lb' },
  { id: 'e3', name: 'Triceps Pushdown', prescriptionSummary: '3 × 10–15' },
];

const days = ['Day 1 — Push', 'Day 2 — Pull', 'Day 3 — Legs'];

export function ProgramEditorPage() {
  const [rule, setRule] = useState<ProgressionRuleType>('double_progression');

  return (
    <div>
      <Header>
        <h1 style={{ margin: 0 }}>5-Day Upper/Lower Split</h1>
        <Badge tone="success">Active</Badge>
      </Header>

      <DayList>
        {days.map((day) => (
          <DayRow key={day}>
            <GripVertical size={16} aria-hidden="true" />
            {day}
          </DayRow>
        ))}
      </DayList>

      <Card>
        <h2 style={{ marginTop: 0 }}>Day 1 — Push</h2>
        {exercises.map((ex) => (
          <ExerciseRowEl key={ex.id}>
            <GripVertical size={16} aria-hidden="true" />
            <div style={{ flex: 1 }}>
              <strong>{ex.name}</strong>
              <div style={{ fontSize: 13 }}>{ex.prescriptionSummary}</div>
            </div>
          </ExerciseRowEl>
        ))}

        <div style={{ marginTop: spacing[16] }}>
          <Select
            label="Progression rule"
            options={progressionOptions}
            value={rule}
            onChange={(e) => setRule(e.target.value as ProgressionRuleType)}
          />
          <Description>{progressionRuleCopy[rule]}</Description>
        </div>

        <button
          type="button"
          style={{
            marginTop: spacing[16],
            width: '100%',
            padding: spacing[12],
            border: '1px dashed currentColor',
            borderRadius: radius.small,
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <Plus size={16} style={{ marginRight: spacing[4] }} /> Add exercise
        </button>
      </Card>
    </div>
  );
}
