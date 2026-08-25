import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/getTheme';

export interface TabItem {
  key: string;
  label: string;
}

export interface TabsProps {
  /** Accessible name for the tab group, e.g. "Training views". */
  label: string;
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

/**
 * Segmented tab control — the React Native counterpart of
 * `apps/web/src/components/Tabs.tsx`.
 *
 * Ported rather than reinvented so the two platforms present the same
 * information architecture: web splits Training into Programs / Workouts /
 * Schedule and shows one at a time, and mobile previously stacked all
 * three as full-height cards, which turned one screen into an endless
 * scroll of oversized panels.
 *
 * The selected treatment (accent-subtle fill, primary text, on a sunken
 * track) is deliberately not a solid primary button — per
 * user-experience-iteration.md #29, selected *navigation* and a primary
 * *action* must not look alike.
 */
export function Tabs({ label, items, activeKey, onChange }: TabsProps) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.list, { backgroundColor: theme.surface.sunken }]}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [
              styles.tab,
              active ? { backgroundColor: theme.action.accentSubtle } : null,
              pressed && !active ? { opacity: 0.6 } : null,
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: active ? theme.action.primary : theme.text.secondary },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    gap: spacing[4],
    padding: spacing[4],
    borderRadius: radius.small,
  },
  tab: {
    // Each tab takes an equal share: a fit-content row (web's treatment)
    // leaves an odd ragged edge on a narrow phone screen.
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // 44pt total with the track's own padding — the iOS minimum target.
    minHeight: 36,
    paddingHorizontal: spacing[8],
    borderRadius: radius.small,
  },
  tabLabel: {
    fontSize: typeScale.compactBody.fontSize,
    fontWeight: '600',
  },
});
