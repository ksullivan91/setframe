import styled from 'styled-components';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { spacing } from '@setline/design-tokens';
import { Card, Skeleton, SkeletonStack } from '../components';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { useApiClient } from '../lib/api-client';

interface ProgressOverviewResponse {
  cards: {
    key: string;
    label: string;
    value: string;
    detail: string | null;
    trend: number[];
    status: 'neutral' | 'positive' | 'informational';
  }[];
  consistency: {
    weeks: {
      weekStart: string;
      plannedCount: number;
      completedCount: number;
      completionRatio: number | null;
    }[];
    summary: {
      currentStreakWeeks: number;
      longestStreakWeeks: number;
      totalCompleted: number;
      totalPlanned: number;
    };
  };
  bodyWeight: {
    points: { localDate: string; weightValue: number; weightUnit: 'lb' | 'kg' }[];
    trendLabel: string | null;
  };
  featuredExercise: {
    exerciseId: string;
    exerciseName: string;
    trendLabel: string | null;
    points: {
      sessionId: string;
      localDate: string;
      sessionName: string;
      topWeight: number | null;
      topReps: number | null;
      estimatedOneRepMax: number | null;
      volume: number;
      isWeightPr: boolean;
      isRepPr: boolean;
    }[];
  } | null;
  recentSessions: {
    sessionId: string;
    localDate: string;
    completedAt: string | null;
    sessionName: string;
    exerciseCount: number;
    setCount: number;
    volume: number;
    prCount: number;
  }[];
}

const Page = styled.div`
  display: grid;
  gap: ${spacing[24]}px;
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[16]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(2, 1fr);
  }

  ${mq.desktop} {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
`;

const CardLabel = styled.div`
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const CardValue = styled.div`
  font-size: ${typeScale.numericMetric.fontSize}px;
  font-weight: ${typeScale.numericMetric.fontWeight};
  margin: ${spacing[4]}px 0;
`;

const CardDetail = styled.div<{ $status: 'neutral' | 'positive' | 'informational' }>`
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) =>
    p.$status === 'positive'
      ? p.theme.status.success
      : p.$status === 'informational'
        ? p.theme.text.secondary
        : p.theme.text.primary};
  min-height: 18px;
`;

const Sparkline = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 36px;
  margin-top: ${spacing[12]}px;
`;

const Bar = styled.div<{ $height: number }>`
  flex: 1;
  min-width: 8px;
  height: ${(p) => p.$height}%;
  border-radius: 999px;
  background: ${(p) => p.theme.action.primary};
`;

const SectionTitle = styled.h2`
  margin: 0 0 ${spacing[12]}px;
  font-size: ${typeScale.sectionTitle.fontSize}px;
`;

const TwoColumn = styled.div`
  display: grid;
  gap: ${spacing[16]}px;

  ${mq.desktop} {
    grid-template-columns: 1.2fr 0.8fr;
  }
`;

const StreakGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${spacing[8]}px;
  margin: ${spacing[12]}px 0;

  ${mq.tablet} {
    grid-template-columns: repeat(8, 1fr);
  }
`;

const WeekColumn = styled.div`
  display: grid;
  gap: 4px;
  justify-items: center;
`;

const Dot = styled.div<{ $filled: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${(p) => (p.$filled ? p.theme.action.primary : p.theme.action.accentSubtle)};
`;

const TrendList = styled.div`
  display: grid;
  gap: ${spacing[12]}px;
`;

const TrendRow = styled.div`
  display: grid;
  gap: ${spacing[4]}px;
`;

const TrendMeta = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const HelperText = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const EmptyState = styled(Card)`
  display: grid;
  gap: ${spacing[8]}px;
`;

const EmptyPreviewGrid = styled.div`
  display: grid;
  gap: ${spacing[12]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const EmptyPreviewCard = styled.div`
  display: grid;
  gap: ${spacing[8]}px;
  padding: ${spacing[16]}px;
  border: 1px dashed ${(p) => p.theme.border.default};
  border-radius: 12px;
  background: ${(p) => p.theme.surface.sunken};
`;

const EmptyPreviewTitle = styled.h3`
  margin: 0;
  font-size: ${typeScale.body.fontSize}px;
`;

const SessionList = styled.div`
  display: grid;
  gap: ${spacing[12]}px;
`;

const SessionMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[12]}px;
  font-size: ${typeScale.compactBody.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

function renderTrendBars(values: number[]) {
  if (!values.length || values.every((value) => value === 0)) {
    return <HelperText>No trend yet.</HelperText>;
  }
  const max = Math.max(...values, 1);
  return (
    <Sparkline>
      {values.map((value, index) => (
        <Bar key={`${index}-${value}`} $height={Math.max((value / max) * 100, 8)} />
      ))}
    </Sparkline>
  );
}

function formatDate(localDate: string) {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function ProgressPage() {
  const api = useApiClient();
  const query = useQuery({
    queryKey: ['progress-overview'],
    queryFn: () => api.get<ProgressOverviewResponse>('/progress/overview?weeks=8'),
  });

  const maxWeekDots = useMemo(
    () => Math.max(1, ...((query.data?.consistency.weeks ?? []).map((week) => Math.max(week.plannedCount, week.completedCount)))),
    [query.data],
  );

  if (query.isLoading) {
    return (
      <Page>
        <div>
          <h1>Progress</h1>
          <HelperText>Review trends that help you understand what is changing — and what to do next.</HelperText>
        </div>
        <CardGrid>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <SkeletonStack>
                <Skeleton $width="60%" $height={13} />
                <Skeleton $width="45%" $height={24} />
                <Skeleton $width="80%" $height={13} />
              </SkeletonStack>
            </Card>
          ))}
        </CardGrid>
        <TwoColumn>
          <Card>
            <SkeletonStack $gap={12}>
              <Skeleton $width="40%" $height={18} />
              <Skeleton $height={80} />
            </SkeletonStack>
          </Card>
          <Card>
            <SkeletonStack $gap={12}>
              <Skeleton $width="30%" $height={18} />
              <Skeleton $height={120} />
            </SkeletonStack>
          </Card>
        </TwoColumn>
      </Page>
    );
  }
  if (query.isError || !query.data) return <span>Couldn't load progress.</span>;

  const hasAnyHistory =
    query.data.consistency.summary.totalCompleted > 0 ||
    query.data.bodyWeight.points.length > 0 ||
    (query.data.featuredExercise?.points.length ?? 0) > 0;

  return (
    <Page>
      <div>
        <h1>Progress</h1>
        <HelperText>Review trends that help you understand what is changing — and what to do next.</HelperText>
      </div>

      {!hasAnyHistory ? (
        <EmptyState>
          <SectionTitle>No training history yet</SectionTitle>
          <HelperText>Complete a workout or log a morning weight to unlock your trends.</HelperText>
          <EmptyPreviewGrid>
            <EmptyPreviewCard>
              <EmptyPreviewTitle>Strength</EmptyPreviewTitle>
              <HelperText>Track top sets, PRs, and estimated strength.</HelperText>
            </EmptyPreviewCard>
            <EmptyPreviewCard>
              <EmptyPreviewTitle>Body weight</EmptyPreviewTitle>
              <HelperText>Follow your morning weight trend.</HelperText>
            </EmptyPreviewCard>
            <EmptyPreviewCard>
              <EmptyPreviewTitle>Consistency</EmptyPreviewTitle>
              <HelperText>See how regularly you've been training.</HelperText>
            </EmptyPreviewCard>
          </EmptyPreviewGrid>
        </EmptyState>
      ) : (
        <>
          <CardGrid>
            {query.data.cards.map((card) => (
              <Card key={card.key}>
                <CardLabel>{card.label}</CardLabel>
                <CardValue>{card.value}</CardValue>
                <CardDetail $status={card.status}>{card.detail ?? ' '}</CardDetail>
                {renderTrendBars(card.trend)}
              </Card>
            ))}
          </CardGrid>

          <TwoColumn>
            <Card>
              <SectionTitle>Consistency (last 8 weeks)</SectionTitle>
              {query.data.consistency.weeks.length === 0 ? (
                <HelperText>No workout history yet. Complete a workout and your streak will appear here.</HelperText>
              ) : (
                <>
                  <StreakGrid>
                    {query.data.consistency.weeks.map((week) => (
                      <WeekColumn key={week.weekStart}>
                        {Array.from({ length: Math.max(maxWeekDots, 1) }).map((_, dotIndex) => (
                          <Dot key={`${week.weekStart}-${dotIndex}`} $filled={dotIndex < week.completedCount} />
                        ))}
                      </WeekColumn>
                    ))}
                  </StreakGrid>
                  <HelperText>
                    {query.data.consistency.summary.totalCompleted} completed sessions across the last 8 weeks · current streak{' '}
                    {query.data.consistency.summary.currentStreakWeeks} week{query.data.consistency.summary.currentStreakWeeks === 1 ? '' : 's'}
                  </HelperText>
                </>
              )}
            </Card>

            <Card>
              <SectionTitle>Body weight</SectionTitle>
              {query.data.bodyWeight.points.length === 0 ? (
                <HelperText>No morning weigh-ins yet. Log your morning weight on Today to see the trend over time.</HelperText>
              ) : (
                <TrendList>
                  <TrendRow>
                    <TrendMeta>
                      <strong>
                        {query.data.bodyWeight.points.at(-1)!.weightValue.toFixed(1)} {query.data.bodyWeight.points.at(-1)!.weightUnit}
                      </strong>
                      <span>{formatDate(query.data.bodyWeight.points.at(-1)!.localDate)}</span>
                    </TrendMeta>
                    <HelperText>{query.data.bodyWeight.trendLabel}</HelperText>
                    {renderTrendBars(query.data.bodyWeight.points.slice(-8).map((point) => point.weightValue))}
                  </TrendRow>
                </TrendList>
              )}
            </Card>
          </TwoColumn>

          <TwoColumn>
            <Card>
              <SectionTitle>{query.data.featuredExercise?.exerciseName ?? 'Exercise strength trend'}</SectionTitle>
              {!query.data.featuredExercise || query.data.featuredExercise.points.length === 0 ? (
                <HelperText>No exercise history yet. Complete a workout with working sets to see estimated 1RM and volume trends.</HelperText>
              ) : (
                <TrendList>
                  {query.data.featuredExercise.points.slice(-5).reverse().map((point) => (
                    <TrendRow key={point.sessionId}>
                      <TrendMeta>
                        <strong>{formatDate(point.localDate)}</strong>
                        <span>
                          {point.estimatedOneRepMax != null ? `${point.estimatedOneRepMax} lb est. 1RM` : 'Need load + reps'}
                        </span>
                      </TrendMeta>
                      <HelperText>
                        {point.topWeight != null && point.topReps != null
                          ? `Top set ${point.topWeight} × ${point.topReps} · volume ${point.volume.toLocaleString()} lb`
                          : `Volume ${point.volume.toLocaleString()} lb`}
                      </HelperText>
                    </TrendRow>
                  ))}
                  <HelperText>{query.data.featuredExercise.trendLabel ?? 'Not enough history yet to show a longer trend.'}</HelperText>
                </TrendList>
              )}
            </Card>

            <Card>
              <SectionTitle>Recent completed sessions</SectionTitle>
              {query.data.recentSessions.length === 0 ? (
                <HelperText>No completed workouts yet. Finish a session and it will appear here with sets, volume, and PRs.</HelperText>
              ) : (
                <SessionList>
                  {query.data.recentSessions.map((session) => (
                    <div key={session.sessionId}>
                      <strong>{session.sessionName}</strong>
                      <HelperText>{formatDate(session.localDate)}</HelperText>
                      <SessionMeta>
                        <span>{session.exerciseCount} exercises</span>
                        <span>{session.setCount} sets</span>
                        <span>{session.volume.toLocaleString()} lb volume</span>
                        <span>{session.prCount} PR{session.prCount === 1 ? '' : 's'}</span>
                      </SessionMeta>
                    </div>
                  ))}
                </SessionList>
              )}
            </Card>
          </TwoColumn>
        </>
      )}
    </Page>
  );
}
