import styled from 'styled-components';
import { spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { Card } from '../components';

/**
 * Progress — trend cards (label + headline + delta + sparkline) and the
 * consistency-streak widget, per style guide §11/§19.3. Mobile-first:
 * base layout stacks trend cards single-column (matching
 * `Screen/Mobile/Progress`); from `tablet` up they wrap into a
 * multi-column row (matching the web version's `layoutWrap: "WRAP"`
 * note in §19.3), and the consistency streak grid only needs the fixed
 * 8-column layout once there's enough width for it not to feel cramped.
 */
const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[16]}px;
  margin-bottom: ${spacing[24]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(2, 1fr);
  }

  ${mq.desktop} {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
`;

const TrendLabel = styled.div`
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const TrendValue = styled.div`
  font-size: ${typeScale.numericMetric.fontSize}px;
  font-weight: ${typeScale.numericMetric.fontWeight};
  font-variant-numeric: tabular-nums;
  margin: ${spacing[4]}px 0;
`;

const TrendDelta = styled.div`
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.status.success};
`;

const Sparkline = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 32px;
  margin-top: ${spacing[8]}px;
`;

const Bar = styled.div<{ $height: number }>`
  width: 8px;
  height: ${(p) => p.$height}%;
  background: ${(p) => p.theme.action.accentSubtle};
  border-radius: 2px;
`;

const StreakGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${spacing[8]}px;
  margin-top: ${spacing[12]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(8, 1fr);
  }
`;

const WeekColumn = styled.div`
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  gap: 4px;
  justify-items: center;
`;

const Dot = styled.div<{ $filled: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${(p) => (p.$filled ? p.theme.action.primary : p.theme.action.accentSubtle)};
`;

const trends = [
  { label: 'Body weight (30 days)', value: '182.4 lb', delta: '-3.1 lb since Jul 21', bars: [40, 55, 50, 60, 45, 65] },
  { label: 'Bench press top set', value: '195 × 6', delta: 'Est. 1RM 232 lb, +12 lb this month', bars: [30, 40, 50, 55, 60, 70] },
  { label: 'Weekly volume', value: '18,240 lb', delta: '+8% vs last week', bars: [50, 45, 60, 55, 65, 75] },
  { label: 'Squat Est. 1RM', value: '285 lb', delta: '+15 lb this month', bars: [35, 45, 55, 60, 65, 80] },
  { label: 'Workouts this month', value: '14', delta: 'vs 11 last month', bars: [20, 40, 60, 55, 70, 90] },
];

// 8 weeks × 4 sessions/week planned; filled = completed session.
const completedPerWeek = [4, 4, 3, 4, 4, 2, 3, 3];

export function ProgressPage() {
  const totalCompleted = completedPerWeek.reduce((a, b) => a + b, 0);
  const totalPlanned = completedPerWeek.length * 4;

  return (
    <div>
      <h1>Progress</h1>

      <CardGrid>
        {trends.map((trend) => (
          <Card key={trend.label}>
            <TrendLabel>{trend.label}</TrendLabel>
            <TrendValue>{trend.value}</TrendValue>
            <TrendDelta>{trend.delta}</TrendDelta>
            <Sparkline>
              {trend.bars.map((h, i) => (
                <Bar key={i} $height={h} />
              ))}
            </Sparkline>
          </Card>
        ))}
      </CardGrid>

      <Card>
        <h2 style={{ marginTop: 0 }}>Consistency (last 8 weeks)</h2>
        <StreakGrid>
          {completedPerWeek.map((completed, weekIndex) => (
            <WeekColumn key={weekIndex}>
              {Array.from({ length: 4 }).map((_, dotIndex) => (
                <Dot key={dotIndex} $filled={dotIndex < completed} />
              ))}
            </WeekColumn>
          ))}
        </StreakGrid>
        <p style={{ fontWeight: 600, marginBottom: 0 }}>
          4-week streak · {totalCompleted} of {totalPlanned} planned sessions completed
        </p>
      </Card>
    </div>
  );
}
