import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { GripVertical } from 'lucide-react-native';
import { Card } from '../src/components/Card';
import { Badge } from '../src/components/Badge';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing, typeScale } from '../src/theme/getTheme';
import type { ProgressionRuleType } from '@setline/schemas';

/**
 * Plain-language progression-rule copy per style guide §18 Idea 3 —
 * reused for the mobile read-only description block below. Kept as a
 * local lookup for now; move to packages/domain once the web editor
 * needs the same copy (currently only written out in the design doc).
 *
 * NOTE: `progressionRuleTypeSchema` (packages/schemas) only enumerates
 * 'manual' | 'double_progression' | 'linear' — the style guide's third
 * example copy ("Percentage-based (%1RM)") is mapped onto the 'manual'
 * type here as the closest fit until a dedicated percentage-based rule
 * type is added to the schema.
 */
const progressionRuleCopy: Record<ProgressionRuleType, { label: string; description: string }> = {
  double_progression: {
    label: 'Double progression',
    description:
      'Increase reps each session until you hit the top of the rep range, then add weight and reset to the bottom.',
  },
  linear: {
    label: 'Linear (+5lb per session)',
    description: 'Add weight every session when you complete all prescribed reps. Best for beginners on compound lifts.',
  },
  manual: {
    label: 'Percentage-based (%1RM)',
    description: "Sets are prescribed as a % of your estimated max. Adjusts automatically as your strength improves.",
  },
};

/**
 * `Screen/Mobile/ProgramEditor` per style guide §14/§18 — the "lighter"
 * mobile editing experience §13 explicitly calls for: program
 * title/status pill, weekly day sequence (view + reorder handles), one
 * expanded day's exercise list as view-only prescriptions, a read-only
 * progression-rule line + plain-language description (§18 Idea 3), and
 * an explicit note redirecting reorder/prescription/progression editing
 * to web.
 */
export default function ProgramEditorScreen() {
  const theme = useTheme();
  const rule = progressionRuleCopy.double_progression;

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Push/Pull/Legs</Text>
        <Badge label="Active" tone="success" />
      </View>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Weekly sequence</Text>
        {['Day 1 — Push', 'Day 2 — Pull', 'Day 3 — Legs'].map((day) => (
          <View key={day} style={styles.dayRow}>
            <GripVertical size={16} color={theme.text.secondary} />
            <Text style={{ color: theme.text.primary, flex: 1 }}>{day}</Text>
            <Text style={{ color: theme.text.secondary }}>5 exercises</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Day 1 — Push</Text>
        {['Barbell Bench Press · 3 × 6-8', 'Overhead Press · 3 × 8-10', 'Incline DB Press · 3 × 10-12'].map(
          (exercise) => (
            <Text key={exercise} style={{ color: theme.text.secondary }}>
              {exercise}
            </Text>
          ),
        )}
        <Text style={[styles.ruleLabel, { color: theme.text.primary }]}>Progression rule: {rule.label}</Text>
        <Text style={[styles.ruleDescription, { color: theme.text.secondary }]}>{rule.description}</Text>
      </Card>

      <Text style={[styles.editNote, { color: theme.text.secondary }]}>
        Edit on web for reorder, prescriptions, and progression rules.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    paddingVertical: spacing[4],
  },
  ruleLabel: {
    fontWeight: '600',
    marginTop: spacing[8],
  },
  ruleDescription: {
    fontSize: typeScale.compactBody.fontSize,
  },
  editNote: {
    fontSize: typeScale.caption.fontSize,
    textAlign: 'center',
  },
});
