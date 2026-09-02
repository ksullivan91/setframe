import { View, Image, StyleSheet } from 'react-native';

/**
 * The launch screen, continued in-app.
 *
 * Deliberately identical to the native splash — same background, same mark
 * at the same size — so when the splash's safety cap fires mid-decision
 * the handover is invisible. Anywhere the app would otherwise render
 * `null` while it works out what to show, it renders this instead.
 *
 * Not a second loading style. A branded hold that looks different from the
 * launch screen tells the user something happened, when nothing did.
 *
 * Values mirror the expo-splash-screen config in app.json; they are
 * duplicated because a native config cannot be imported, so a change to
 * one has to be made in both.
 */
const SPLASH_BACKGROUND = '#364bf2';
const SPLASH_IMAGE_WIDTH = 180;

export function AppLoading() {
  return (
    <View style={styles.fill} testID="app-loading">
      <Image
        source={require('../../assets/splash-icon.png')}
        style={styles.mark}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Setframe"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { width: SPLASH_IMAGE_WIDTH, height: SPLASH_IMAGE_WIDTH },
});
