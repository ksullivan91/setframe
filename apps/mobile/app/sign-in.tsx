import { View, Text, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth, useSignIn } from '@clerk/clerk-expo';
import { useState } from 'react';
import { Card } from '../src/components/Card';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing, typeScale } from '../src/theme/getTheme';

/**
 * `Screen/Mobile/SignIn` per style guide §14 — narrower `AuthCard` (342px
 * equivalent) around Clerk's own sign-in flow. Per §11.5 this does NOT
 * reimplement Clerk's `<SignIn/>` UI; it's page chrome (wordmark, tagline,
 * centered card) hosting `useSignIn()`'s email/password flow directly.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isSignedIn) return <Redirect href="/(tabs)/today" />;

  async function handleSignIn() {
    if (!isLoaded) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)/today');
      }
    } catch {
      setError('Could not sign in. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface.canvas }]}>
      <Text style={[styles.wordmark, { color: theme.text.primary }]}>Setframe</Text>
      <Text style={[styles.tagline, { color: theme.text.secondary }]}>
        Train with intent. Sync with Apple Health.
      </Text>
      <Card style={styles.card}>
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        {error ? <Text style={{ color: theme.status.error }}>{error}</Text> : null}
        <Button label="Sign In" onPress={handleSignIn} loading={submitting} />
      </Card>
      <Text style={[styles.footer, { color: theme.text.secondary }]} onPress={() => router.push('/sign-up')}>
        Don't have an account? Sign up
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[24],
    gap: spacing[16],
  },
  wordmark: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  tagline: {
    fontSize: typeScale.body.fontSize,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 342,
  },
  footer: {
    fontSize: typeScale.compactBody.fontSize,
  },
});
