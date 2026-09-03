import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing, typeScale } from '../theme/getTheme';
import { useScreenTopPadding, useStackBottomPadding } from '../lib/useScreenInsets';
import { healthKit } from '../healthkit/HealthKitAdapter';

/**
 * The priming screen — Figma `Health 2 · Why we are asking` (193:896).
 *
 * This screen exists because of a hard iOS constraint, not for decoration:
 * the system grants an app **one** authorization prompt per data type for
 * the lifetime of the install. Decline it and we can never ask again. A
 * generic "allow health access" is what gets declined, so the only lever
 * we have is naming each metric and what it buys the user *before* Apple's
 * sheet appears.
 */
const REASONS = [
  {
    metric: 'Steps and active energy',
    why: 'So a walk counts toward your week even when you did not log it.',
  },
  {
    metric: 'Exercise minutes',
    why: 'Your rings and your training tell one story, not two.',
  },
  {
    metric: 'Food and macros',
    why: 'Read from Apple Health, so any tracker that syncs there works — MyFitnessPal, Cronometer, Lose It!, whichever you already use.',
  },
  {
    metric: 'Sleep, HRV and resting heart rate',
    why: 'How recovered you are decides whether today should be heavy or easy. Sets alone cannot tell us that.',
  },
  {
    metric: 'Weight, height and body composition',
    why: 'Context for your numbers, so progress is read against you and not an average.',
  },
  {
    metric: 'Age and biological sex',
    why: 'Used to interpret the metrics above. Never shown to anyone else.',
  },
];

export function HealthAccessScreen() {
  const theme = useTheme();
  const router = useRouter();
  const topPadding = useScreenTopPadding();
  /* This is a Stack route with headerShown:false, so nothing sits between
     the footer and the home indicator. Without this the Continue button
     ends 16pt from the bottom of the glass and crowds the indicator. */
  const bottomPadding = useStackBottomPadding();
  const [asking, setAsking] = useState(false);

  async function ask() {
    setAsking(true);
    try {
      await healthKit.requestAuthorization();
    } finally {
      setAsking(false);
      // Back to Log either way: the sheet never tells us what was
      // chosen, so the card re-reads and shows whatever actually arrives.
      router.back();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface.canvas }} testID="health-access">
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back to Log" hitSlop={8}>
          <Text style={[styles.back, { color: theme.text.secondary }]}>‹</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text.secondary }]}>Apple Health</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          What Setframe reads, and why
        </Text>
        <Text style={[styles.lede, { color: theme.text.secondary }]}>
          Everything below is read-only, and Apple asks about each one separately —
          turn down anything you would rather keep to yourself.
        </Text>

        <View style={[styles.list, { backgroundColor: theme.surface.raised, borderColor: theme.border.subtle }]}>
          {REASONS.map((reason) => (
            <View key={reason.metric} style={styles.reason} testID={`health-reason-${reason.metric}`}>
              <Text style={[styles.reasonMetric, { color: theme.text.primary }]}>{reason.metric}</Text>
              <Text style={[styles.reasonWhy, { color: theme.text.secondary }]}>{reason.why}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.promise, { backgroundColor: theme.status.successSubtle }]}>
          <Text style={[styles.promiseTitle, { color: theme.text.primary }]}>
            Setframe never writes to Apple Health.
          </Text>
          <Text style={[styles.promiseBody, { color: theme.text.secondary }]}>
            Nothing leaves your phone except the daily totals above, and you can turn any of it off
            in the Health app at any time.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.surface.raised,
            borderTopColor: theme.border.subtle,
            paddingBottom: bottomPadding,
          },
        ]}
      >
        <Pressable
          testID="health-continue"
          accessibilityRole="button"
          accessibilityLabel="Continue"
          disabled={asking}
          onPress={() => void ask()}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.action.primary, opacity: pressed || asking ? 0.85 : 1 },
          ]}
        >
          {asking ? (
            <ActivityIndicator color={theme.action.primaryText} />
          ) : (
            <Text style={[styles.primaryLabel, { color: theme.action.primaryText }]}>Continue</Text>
          )}
        </Pressable>
        <Text style={[styles.footerNote, { color: theme.text.secondary }]}>
          Apple will ask next. You choose each metric.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[12],
    paddingBottom: spacing[8],
  },
  back: { fontSize: 28, fontWeight: '600', width: 24 },
  headerTitle: { fontSize: typeScale.body.fontSize, fontWeight: '500' },
  body: {
    padding: spacing[16],
    gap: spacing[16],
  },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    lineHeight: typeScale.pageTitle.lineHeight,
    fontWeight: '600',
  },
  lede: {
    fontSize: typeScale.helper.fontSize,
    lineHeight: typeScale.helper.lineHeight,
    marginTop: -spacing[8],
  },
  list: {
    borderRadius: radius.large,
    borderWidth: 1,
    padding: spacing[16],
    gap: spacing[16],
  },
  reason: { gap: 2 },
  reasonMetric: {
    fontSize: typeScale.body.fontSize,
    lineHeight: typeScale.body.lineHeight,
    fontWeight: '600',
  },
  reasonWhy: {
    fontSize: typeScale.helper.fontSize,
    lineHeight: typeScale.helper.lineHeight,
  },
  promise: {
    borderRadius: radius.large,
    padding: spacing[16],
    gap: spacing[4],
  },
  promiseTitle: {
    fontSize: typeScale.helper.fontSize,
    lineHeight: typeScale.helper.lineHeight,
    fontWeight: '600',
  },
  promiseBody: {
    fontSize: typeScale.helper.fontSize,
    lineHeight: typeScale.helper.lineHeight,
  },
  footer: {
    padding: spacing[16],
    borderTopWidth: 1,
    gap: spacing[8],
  },
  primaryButton: {
    height: 48,
    borderRadius: radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: typeScale.button.fontSize,
    fontWeight: '600',
  },
  footerNote: {
    fontSize: typeScale.caption.fontSize,
    textAlign: 'center',
  },
});
