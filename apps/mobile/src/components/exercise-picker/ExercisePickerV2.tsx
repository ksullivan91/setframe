import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The exercise picker. Counterpart of
 * `apps/web/src/components/exercise-picker/ExercisePickerV2.tsx`.
 *
 * Figma: `Explore/Mobile/Build 5 · Search and pick exercises` (163:708).
 *
 * **Multi-select, and the badge shows pick ORDER rather than a checkmark** —
 * the footer promises "they are added in the order you picked them", which a
 * check would make unverifiable.
 *
 * Search, filtering and ordering all come from `packages/domain`, identical
 * to web.
 */

export interface ExercisePickerV2Props {
  exercises: readonly PickableExercise[];
  title: string;
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
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(ALL_FILTER.key);
  const [selected, setSelected] = useState<string[]>([]);

  const filters = useMemo(() => availableFilters(exercises), [exercises]);
  const results = useMemo(
    () => filterExercises({ exercises, query, filter }),
    [exercises, query, filter],
  );

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.surface.canvas }]}
      testID="exercise-picker"
    >
      <View style={[styles.header, { backgroundColor: theme.surface.raised }]}>
        <View style={styles.titleRow}>
          <Pressable onPress={onCancel} accessibilityRole="button">
            <Text style={[styles.textButton, { color: theme.action.primary }]}>Cancel</Text>
          </Pressable>
          <View style={styles.titleGroup}>
            <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: theme.text.secondary }]}>{subtitle}</Text>
            ) : null}
          </View>
          {/* Held in the layout even without a handler, so the title stays
              optically centred between two equal-weight controls. */}
          {onCreateNew ? (
            <Pressable onPress={onCreateNew} accessibilityRole="button">
              <Text style={[styles.textButton, { color: theme.action.primary }]}>New</Text>
            </Pressable>
          ) : (
            <View style={{ width: 31 }} />
          )}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          placeholderTextColor={theme.text.disabled}
          accessibilityLabel="Search exercises"
          testID="picker-search"
          style={[
            styles.search,
            { backgroundColor: theme.surface.sunken, color: theme.text.primary },
          ]}
        />

        <View style={styles.filters}>
          {filters.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setFilter(option.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === option.key }}
              testID={`picker-filter-${option.key}`}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    filter === option.key ? theme.action.primary : theme.surface.sunken,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterLabel,
                  {
                    color:
                      filter === option.key ? theme.action.primaryText : theme.text.primary,
                  },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.text.secondary }]}>
            Nothing matches “{query}”. Try a different search, or add it as a new exercise.
          </Text>
        }
        renderItem={({ item }) => {
          const order = selectionOrder(selected, item.id);
          return (
            <Pressable
              onPress={() => setSelected((current) => toggleSelection(current, item.id))}
              accessibilityRole="button"
              accessibilityState={{ selected: order != null }}
              testID={`picker-row-${item.id}`}
              style={[
                styles.row,
                {
                  backgroundColor:
                    order != null ? theme.action.primary + '0F' : theme.surface.raised,
                },
              ]}
            >
              <View style={[styles.tile, { backgroundColor: theme.surface.sunken }]}>
                <Text style={[styles.tileLabel, { color: theme.text.secondary }]}>
                  {initials(item.name)}
                </Text>
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: theme.text.primary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.meta, { color: theme.text.secondary }]}>
                  {describeExercise(item)}
                </Text>
              </View>
              <View
                testID={`picker-badge-${item.id}`}
                style={[
                  styles.badge,
                  order != null
                    ? { backgroundColor: theme.action.primary }
                    : { borderWidth: 1, borderColor: theme.border.default },
                ]}
              >
                <Text style={[styles.badgeLabel, { color: theme.action.primaryText }]}>
                  {order ?? ''}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { backgroundColor: theme.surface.raised }]}>
        <Pressable
          disabled={selected.length === 0 || busy}
          onPress={() => onAdd(selected)}
          accessibilityRole="button"
          testID="picker-add"
          style={[
            styles.cta,
            {
              backgroundColor:
                selected.length === 0 || busy ? theme.surface.sunken : theme.action.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.ctaLabel,
              {
                color:
                  selected.length === 0 || busy ? theme.text.disabled : theme.action.primaryText,
              },
            ]}
          >
            {formatAddLabel(selected.length)}
          </Text>
        </Pressable>
        <Text style={[styles.hint, { color: theme.text.secondary }]}>
          They are added in the order you picked them.
        </Text>
      </View>
    </View>
  );
}

/** Stand-in for the illustration; keeps the 44px footprint so real art can
    drop in later without moving anything. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: exercisePicker.header.paddingX,
    paddingTop: exercisePicker.header.paddingTop,
    paddingBottom: exercisePicker.header.paddingBottom,
    gap: exercisePicker.header.gap,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleGroup: { alignItems: 'center', gap: 1 },
  title: { fontSize: exercisePicker.header.titleSize, fontWeight: '600' },
  subtitle: { fontSize: exercisePicker.header.subtitleSize, fontWeight: '500' },
  textButton: { fontSize: 14, fontWeight: '500' },
  search: {
    height: exercisePicker.search.height,
    borderRadius: exercisePicker.search.radius,
    paddingHorizontal: exercisePicker.search.paddingX,
    /* 16px is the iOS zoom threshold on web; kept here so both platforms
       read the same size (story 28). */
    fontSize: 16,
  },
  filters: { flexDirection: 'row', gap: exercisePicker.filter.gap, flexWrap: 'wrap' },
  filterChip: {
    height: exercisePicker.filter.height,
    paddingHorizontal: exercisePicker.filter.paddingX,
    borderRadius: exercisePicker.filter.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterLabel: { fontSize: exercisePicker.filter.labelSize, fontWeight: '500' },
  row: {
    height: exercisePicker.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: exercisePicker.rowGap,
    paddingHorizontal: exercisePicker.rowPaddingX,
    paddingVertical: exercisePicker.rowPaddingY,
  },
  tile: {
    width: exercisePicker.tileSize,
    height: exercisePicker.tileSize,
    borderRadius: exercisePicker.tileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: 15, fontWeight: '600' },
  rowText: { flex: 1, gap: exercisePicker.textGap },
  name: { fontSize: exercisePicker.nameSize, fontWeight: '500' },
  meta: { fontSize: exercisePicker.metaSize },
  badge: {
    width: exercisePicker.badgeSize,
    height: exercisePicker.badgeSize,
    borderRadius: exercisePicker.badgeRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: { fontSize: exercisePicker.badgeLabelSize, fontWeight: '600' },
  footer: {
    paddingHorizontal: exercisePicker.footer.paddingX,
    paddingTop: exercisePicker.footer.paddingTop,
    paddingBottom: exercisePicker.footer.paddingBottom,
    gap: exercisePicker.footer.gap,
    alignItems: 'center',
  },
  cta: {
    width: '100%',
    height: exercisePicker.footer.ctaHeight,
    borderRadius: exercisePicker.footer.ctaRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { fontSize: exercisePicker.footer.ctaLabelSize, fontWeight: '600' },
  hint: { fontSize: exercisePicker.footer.hintSize },
  empty: { padding: 32, textAlign: 'center', fontSize: 14 },
});
