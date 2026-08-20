import styled from 'styled-components';
import { estimateOneRepMax } from '@setline/domain';
import { spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { Card, PRBadge } from '../components';

/**
 * ExerciseHistory — web-nav-only per style guide §13/§14. Restrained
 * stat-tile row (top set, est. 1RM via Epley formula, last session
 * volume — deliberately no chart, per spec's "keep charts restrained").
 * Mobile-first: stat tiles stack single-column on narrow viewports, then
 * become a 3-up row from `tablet` up.
 */
const StatRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[12]}px;
  margin-bottom: ${spacing[24]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const StatLabel = styled.div`
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const StatValue = styled.div`
  font-size: ${typeScale.numericMetric.fontSize}px;
  font-weight: ${typeScale.numericMetric.fontWeight};
  font-variant-numeric: tabular-nums;
`;

const SessionCard = styled(Card)`
  margin-bottom: ${spacing[12]}px;
`;

const SessionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing[8]}px;
`;

const SetLine = styled.div`
  font-size: ${typeScale.compactBody.fontSize}px;
  font-variant-numeric: tabular-nums;
  color: ${(p) => p.theme.text.secondary};
`;

const topSetWeight = 195;
const topSetReps = 6;
const estimated1RM = Math.round(estimateOneRepMax(topSetWeight, topSetReps));

const sessions = [
  { date: 'Aug 18, 2026', sets: ['195 × 6', '185 × 8', '185 × 8'], hasPr: true },
  { date: 'Aug 11, 2026', sets: ['185 × 8', '185 × 8', '175 × 9'], hasPr: false },
];

export function ExerciseHistoryPage() {
  return (
    <div>
      <h1>Barbell Bench Press</h1>

      <StatRow>
        <Card>
          <StatLabel>Top Set</StatLabel>
          <StatValue>
            {topSetWeight} × {topSetReps}
          </StatValue>
        </Card>
        <Card>
          <StatLabel>Est. 1RM</StatLabel>
          <StatValue>{estimated1RM} lb</StatValue>
        </Card>
        <Card>
          <StatLabel>Last Session Volume</StatLabel>
          <StatValue>4,510 lb</StatValue>
        </Card>
      </StatRow>

      {sessions.map((session) => (
        <SessionCard key={session.date}>
          <SessionHeader>
            <strong>{session.date}</strong>
            {session.hasPr ? <PRBadge /> : null}
          </SessionHeader>
          {session.sets.map((s, i) => (
            <SetLine key={i}>
              Set {i + 1}: {s}
            </SetLine>
          ))}
        </SessionCard>
      ))}
    </div>
  );
}
