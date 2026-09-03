import { Pressable, StyleSheet, Text, View } from 'react-native';
import { training } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The empty Training page. Counterpart of
 * `apps/web/src/components/training-v2/NoPlanRoutes.tsx`.
 *
 * Figma: `Explore/Mobile/Training 1 · No plan yet` (148:708).
 *
 * The teardown's biggest structural finding lives here: Setframe required a
 * program before Today had anything to offer — "correct, and a wall". Three
 * routes out, live ones first.
 */

export interface NoPlanRoutesProps {
  onJustStart: () => void;
  onBuildYourOwn: () => void;
  busy?: boolean;
}

export function NoPlanRoutes({ onJustStart, onBuildYourOwn, busy }: NoPlanRoutesProps) {
  const theme = useTheme();
  return (
    <View style={styles.body} testID="no-plan-routes">
      <View
        style={[
          styles.option,
          { backgroundColor: theme.surface.raised, borderColor: theme.action.primary, borderWidth: 1 },
        ]}
      >
        <Text style={[styles.title, { color: theme.text.primary }]}>Just start training</Text>
        <Text style={[styles.body2, { color: theme.text.secondary }]}>
          Log today&apos;s session now and pick exercises as you go. Nothing to set up first.
        </Text>
        <Pressable
          onPress={onJustStart}
          disabled={busy}
          accessibilityRole="button"
          testID="just-start"
          style={[styles.cta, { backgroundColor: theme.action.primary }]}
        >
          <Text style={[styles.ctaLabel, { color: theme.action.primaryText }]}>Start a workout</Text>
        </Pressable>
        <Text style={[styles.note, { color: theme.text.secondary }]}>
          Afterwards you can save it as a reusable workout in one tap — it is a real session either
          way.
        </Text>
      </View>

      <View style={[styles.option, { backgroundColor: theme.surface.raised }]}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Build your own</Text>
        <Text style={[styles.body2, { color: theme.text.secondary }]}>
          Set up a program week by week. Best if you already know what you want to run.
        </Text>
        <Pressable
          onPress={onBuildYourOwn}
          accessibilityRole="button"
          testID="build-your-own"
          style={[styles.cta, { backgroundColor: theme.surface.sunken }]}
        >
          <Text style={[styles.ctaLabel, { color: theme.action.primary }]}>Guided setup</Text>
        </Pressable>
      </View>

      <View style={[styles.option, { backgroundColor: theme.surface.raised }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text.primary }]}>Start from a template</Text>
          {/* The logger's caution pill: amber at 16% under dark text. Amber
              as a foreground is the contrast failure already fixed once. */}
          <View style={[styles.comingSoon, { backgroundColor: theme.status.caution + '29' }]}>
            <Text style={[styles.comingSoonLabel, { color: theme.text.primary }]}>Coming soon</Text>
          </View>
        </View>
        <Text style={[styles.body2, { color: theme.text.secondary }]}>
          Upper/Lower, Push Pull Legs, Full Body 3-day. Real workouts with exercises and targets
          already filled in, which you can change.
        </Text>
        {/* Inert: the starter templates do not exist yet. */}
        <View style={[styles.cta, { backgroundColor: theme.surface.sunken }]} testID="browse-templates">
          <Text style={[styles.ctaLabel, { color: theme.text.secondary }]}>Browse templates</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: training.cardGap },
  option: {
    width: training.cardWidth,
    maxWidth: '100%',
    padding: 16,
    borderRadius: training.cardRadius,
    gap: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 17, fontWeight: '600' },
  body2: { fontSize: 13 },
  cta: { height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  ctaLabel: { fontSize: 14, fontWeight: '600' },
  note: { fontSize: 12 },
  comingSoon: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  comingSoonLabel: { fontSize: 11, fontWeight: '600' },
});
