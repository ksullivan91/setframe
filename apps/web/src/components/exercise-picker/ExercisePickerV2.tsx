import { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  ALL_FILTER,
  availableFilters,
  describeExercise,
  filterExercises,
  formatAddLabel,
  selectionOrder,
  toggleSelection,
  type PickableExercise,
} from '@setframe/domain';
import { exercisePicker } from '@setframe/design-tokens';

/**
 * The exercise picker — one surface, used everywhere something adds an
 * exercise.
 *
 * Figma: `Explore/Mobile/Build 5 · Search and pick exercises` (163:708).
 *
 * **Multi-select with a running count.** The teardown's finding, verbatim:
 * today's picker adds one and closes, so building a day means reopening it
 * per exercise. The badge shows the **pick order**, not a checkmark, because
 * the footer promises "they are added in the order you picked them" and a
 * check would make that promise unverifiable.
 *
 * All search, filtering and ordering lives in `packages/domain`, so mobile
 * renders the identical state with different primitives.
 */

const Screen = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: ${({ theme }) => theme.surface.canvas};
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${exercisePicker.header.gap}px;
  padding: ${exercisePicker.header.paddingTop}px ${exercisePicker.header.paddingX}px
    ${exercisePicker.header.paddingBottom}px;
  background: ${({ theme }) => theme.surface.raised};
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const TextButton = styled.button`
  border: none;
  background: none;
  padding: 0;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.action.primary};
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.action.primary};
    outline-offset: 2px;
  }
`;

const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${exercisePicker.header.gap / 12}px;
  min-width: 0;
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${exercisePicker.header.titleSize}px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};
`;

const Subtitle = styled.span`
  font-size: ${exercisePicker.header.subtitleSize}px;
  font-weight: 500;
  color: ${({ theme }) => theme.text.secondary};
`;

const Search = styled.input`
  width: 100%;
  height: ${exercisePicker.search.height}px;
  padding: 0 ${exercisePicker.search.paddingX}px;
  border: none;
  border-radius: ${exercisePicker.search.radius}px;
  background: ${({ theme }) => theme.surface.sunken};
  color: ${({ theme }) => theme.text.primary};
  /* 16px is the iOS Safari zoom threshold — below it the viewport zooms on
     focus and never returns (story 28). The design says 15; this is the one
     place the design loses, because the alternative is a broken viewport. */
  font-size: 16px;
  &::placeholder {
    color: ${({ theme }) => theme.text.disabled};
  }
`;

const Filters = styled.div`
  display: flex;
  gap: ${exercisePicker.filter.gap}px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const FilterChip = styled.button<{ $active: boolean }>`
  flex: 0 0 auto;
  height: ${exercisePicker.filter.height}px;
  padding: 0 ${exercisePicker.filter.paddingX}px;
  border: none;
  border-radius: ${exercisePicker.filter.radius}px;
  font-size: ${exercisePicker.filter.labelSize}px;
  font-weight: 500;
  cursor: pointer;
  background: ${({ theme, $active }) => ($active ? theme.action.primary : theme.surface.sunken)};
  color: ${({ theme, $active }) => ($active ? theme.action.primaryText : theme.text.primary)};
`;

const Results = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`;

const Row = styled.button<{ $selected: boolean }>`
  width: 100%;
  height: ${exercisePicker.rowHeight}px;
  display: flex;
  align-items: center;
  gap: ${exercisePicker.rowGap}px;
  padding: ${exercisePicker.rowPaddingY}px ${exercisePicker.rowPaddingX}px;
  border: none;
  text-align: left;
  cursor: pointer;
  background: ${({ theme, $selected }) =>
    $selected ? theme.action.primary + '0F' : theme.surface.raised};
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.action.primary};
    outline-offset: -2px;
  }
`;

const Tile = styled.span`
  flex: 0 0 ${exercisePicker.tileSize}px;
  width: ${exercisePicker.tileSize}px;
  height: ${exercisePicker.tileSize}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${exercisePicker.tileRadius}px;
  background: ${({ theme }) => theme.surface.sunken};
  color: ${({ theme }) => theme.text.secondary};
  font-size: 15px;
  font-weight: 600;
`;

const RowText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${exercisePicker.textGap}px;
`;

const Name = styled.span`
  font-size: ${exercisePicker.nameSize}px;
  font-weight: 500;
  color: ${({ theme }) => theme.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Meta = styled.span`
  font-size: ${exercisePicker.metaSize}px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Badge = styled.span<{ $selected: boolean }>`
  flex: 0 0 ${exercisePicker.badgeSize}px;
  width: ${exercisePicker.badgeSize}px;
  height: ${exercisePicker.badgeSize}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${exercisePicker.badgeRadius}px;
  font-size: ${exercisePicker.badgeLabelSize}px;
  font-weight: 600;
  background: ${({ theme, $selected }) => ($selected ? theme.action.primary : 'transparent')};
  border: ${({ theme, $selected }) =>
    $selected ? 'none' : `1px solid ${theme.border.default}`};
  color: ${({ theme }) => theme.action.primaryText};
`;

const Footer = styled.footer`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${exercisePicker.footer.gap}px;
  padding: ${exercisePicker.footer.paddingTop}px ${exercisePicker.footer.paddingX}px
    max(${exercisePicker.footer.paddingBottom}px, env(safe-area-inset-bottom));
  background: ${({ theme }) => theme.surface.raised};
`;

const Cta = styled.button`
  width: 100%;
  height: ${exercisePicker.footer.ctaHeight}px;
  border: none;
  border-radius: ${exercisePicker.footer.ctaRadius}px;
  background: ${({ theme }) => theme.action.primary};
  color: ${({ theme }) => theme.action.primaryText};
  font-size: ${exercisePicker.footer.ctaLabelSize}px;
  font-weight: 600;
  cursor: pointer;
  &:disabled {
    background: ${({ theme }) => theme.surface.sunken};
    color: ${({ theme }) => theme.text.disabled};
    cursor: default;
  }
`;

const Hint = styled.p`
  margin: 0;
  font-size: ${exercisePicker.footer.hintSize}px;
  color: ${({ theme }) => theme.text.secondary};
  text-align: center;
`;

const EmptyState = styled.p`
  margin: 0;
  padding: 32px 16px;
  text-align: center;
  font-size: 14px;
  color: ${({ theme }) => theme.text.secondary};
`;

export interface ExercisePickerV2Props {
  exercises: readonly PickableExercise[];
  /** e.g. "Add to Upper A". */
  title: string;
  /** e.g. "Step 3 of 4". Omitted outside a wizard — a session is not one. */
  subtitle?: string;
  onCancel: () => void;
  onCreateNew?: () => void;
  onAdd: (exerciseIds: string[]) => void;
  busy?: boolean;
}

export function ExercisePickerV2({
  exercises,
  title,
  subtitle,
  onCancel,
  onCreateNew,
  onAdd,
  busy = false,
}: ExercisePickerV2Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(ALL_FILTER.key);
  const [selected, setSelected] = useState<string[]>([]);

  const filters = useMemo(() => availableFilters(exercises), [exercises]);
  const results = useMemo(
    () => filterExercises({ exercises, query, filter }),
    [exercises, query, filter],
  );

  return (
    <Screen data-testid="exercise-picker">
      <Header>
        <TitleRow>
          <TextButton type="button" onClick={onCancel}>
            Cancel
          </TextButton>
          <TitleGroup>
            <Title>{title}</Title>
            {subtitle ? <Subtitle>{subtitle}</Subtitle> : null}
          </TitleGroup>
          {/* Kept in the layout even when there is no handler, so the title
              stays optically centred between two equal-weight controls. */}
          {onCreateNew ? (
            <TextButton type="button" onClick={onCreateNew}>
              New
            </TextButton>
          ) : (
            <span aria-hidden="true" style={{ width: 31 }} />
          )}
        </TitleRow>

        <Search
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search exercises"
          aria-label="Search exercises"
          data-testid="picker-search"
        />

        <Filters role="tablist" aria-label="Filter by movement">
          {filters.map((option) => (
            <FilterChip
              key={option.key}
              type="button"
              role="tab"
              aria-selected={filter === option.key}
              $active={filter === option.key}
              onClick={() => setFilter(option.key)}
              data-testid={`picker-filter-${option.key}`}
            >
              {option.label}
            </FilterChip>
          ))}
        </Filters>
      </Header>

      <Results>
        {results.length === 0 ? (
          <EmptyState>
            Nothing matches “{query}”. Try a different search, or add it as a new exercise.
          </EmptyState>
        ) : (
          results.map((item) => {
            const order = selectionOrder(selected, item.id);
            return (
              <Row
                key={item.id}
                type="button"
                $selected={order != null}
                onClick={() => setSelected((current) => toggleSelection(current, item.id))}
                aria-pressed={order != null}
                data-testid={`picker-row-${item.id}`}
                data-selected={order != null ? 'true' : 'false'}
              >
                <Tile aria-hidden="true">{initials(item.name)}</Tile>
                <RowText>
                  <Name>{item.name}</Name>
                  <Meta>{describeExercise(item)}</Meta>
                </RowText>
                <Badge $selected={order != null} data-testid={`picker-badge-${item.id}`}>
                  {order ?? ''}
                </Badge>
              </Row>
            );
          })
        )}
      </Results>

      <Footer>
        <Cta
          type="button"
          disabled={selected.length === 0 || busy}
          onClick={() => onAdd(selected)}
          data-testid="picker-add"
        >
          {formatAddLabel(selected.length)}
        </Cta>
        <Hint>They are added in the order you picked them.</Hint>
      </Footer>
    </Screen>
  );
}

/**
 * Stand-in for the illustration the design shows.
 *
 * The catalogue has no artwork, and inventing a per-exercise SVG set is its
 * own piece of work — the tile keeps its 44px footprint so the row geometry
 * is right now and dropping real art in later changes nothing else.
 */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}
