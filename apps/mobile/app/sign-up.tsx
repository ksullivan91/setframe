import { View, Text, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth, useSignUp } from '@clerk/clerk-expo';
import { useState, useEffect } from 'react';
import { describeClerkError, describeIncompleteSignUp } from '../src/lib/clerk-errors';
import { releaseSplash } from '../src/lib/appReady';
import { Card } from '../src/components/Card';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing, typeScale } from '../src/theme/getTheme';

/**
 * `Screen/Mobile/SignUp` per style guide §14 — same Clerk-chrome pattern
 * as SignIn (§10/§13), narrower `AuthCard` than the web version. CTA
 * reads "Create Account"; footer links back to Sign In.
 */
export default function SignUpScreen() {
  // Nothing to wait for here, so the logo should not linger over it.
  useEffect(releaseSplash, []);

  const theme = useTheme();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signUp, setActive, isLoaded } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isSignedIn) return <Redirect href="/(tabs)/today" />;

  async function handleSignUp() {
    if (!isLoaded) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await signUp.create({ emailAddress: email, password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)/today');
        return;
      }
      // Same silent dead-end as sign-in: `missing_requirements` (email
      // verification pending) resolved here and did nothing visible.
      setError(describeIncompleteSignUp(result.status));
    } catch (err) {
      setError(describeClerkError(err, 'Could not create your account. Please try again.'));
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
        <Button label="Create Account" onPress={handleSignUp} loading={submitting} />
      </Card>
      <Text style={[styles.footer, { color: theme.text.secondary }]} onPress={() => router.push('/sign-in')}>
        Already have an account? Sign in
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
