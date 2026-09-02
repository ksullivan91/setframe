import { View, Text, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth, useSSO, useSignIn } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState, useEffect } from 'react';
import { describeClerkError, describeIncompleteSignIn } from '../src/lib/clerk-errors';
import { releaseSplash } from '../src/lib/appReady';
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
/* Dismisses the auth browser tab once the OAuth redirect lands back in the
   app. Without it the tab can linger over the app after a successful sign-in. */
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  // Nothing to wait for here, so the logo should not linger over it.
  useEffect(releaseSplash, []);

  const theme = useTheme();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [ssoPending, setSsoPending] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /* Non-null once the password is accepted but Clerk still wants a second
     factor. Holds the strategy Clerk asked for so the copy can name the
     real one (this instance uses `email_code`, not an authenticator app). */
  const [secondFactor, setSecondFactor] = useState<{ strategy: string } | null>(null);
  const [code, setCode] = useState('');

  if (isSignedIn) return <Redirect href="/" />;

  async function finish(createdSessionId: string | null) {
    // `setActive` is only present once Clerk has loaded; `isLoaded` is
    // checked by every caller, but the type stays optional.
    await setActive?.({ session: createdSessionId });
    router.replace('/');
  }

  /* Google is enabled on the Clerk instance as an `oauth_google` first
     factor and is what the web app offers; mobile only ever implemented
     email/password, so the two were meaningfully out of parity. */
  async function handleGoogle() {
    setSsoPending(true);
    setError(null);
    try {
      const { createdSessionId, setActive: setSsoActive } = await startSSOFlow({
        strategy: 'oauth_google',
        // Resolves to `setframe://` from app.json's `scheme`.
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId) {
        await setSsoActive?.({ session: createdSessionId });
        router.replace('/');
        return;
      }
      // No session means Clerk needs another step (MFA, or completing a
      // profile). Those flows are not built here yet, so say so rather than
      // failing silently the way this screen used to.
      setError('Google sign-in needs another step this app cannot finish yet. Sign in on the web at setframe.app.');
    } catch (err) {
      setError(describeClerkError(err, 'Could not sign in with Google. Try again.'));
    } finally {
      setSsoPending(false);
    }
  }

  async function handleSignIn() {
    if (!isLoaded) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await finish(result.createdSessionId);
        return;
      }

      /* The password was accepted, but this Clerk instance also requires a
         second factor. Ask Clerk to send it, then collect it — previously
         this branch did nothing at all, leaving a spinner that stopped with
         no explanation. */
      if (result.status === 'needs_second_factor') {
        const strategy = result.supportedSecondFactors?.[0]?.strategy;
        if (!strategy) {
          setError('This account needs a second verification step that the app cannot complete. Sign in on the web at setframe.app.');
          return;
        }
        // `email_code`/`phone_code` must be requested before they are sent;
        // `totp`/`backup_code` come from the user's own device, so asking
        // Clerk to "prepare" them is meaningless and errors.
        if (strategy === 'email_code' || strategy === 'phone_code') {
          await signIn.prepareSecondFactor({ strategy } as Parameters<typeof signIn.prepareSecondFactor>[0]);
        }
        setSecondFactor({ strategy });
        return;
      }

      setError(describeIncompleteSignIn(result.status));
    } catch (err) {
      setError(describeClerkError(err, 'Could not sign in. Check your email and password.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode() {
    if (!isLoaded || !secondFactor) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: secondFactor.strategy,
        code,
      } as Parameters<typeof signIn.attemptSecondFactor>[0]);
      if (result.status === 'complete') {
        await finish(result.createdSessionId);
        return;
      }
      setError(describeIncompleteSignIn(result.status));
    } catch (err) {
      setError(describeClerkError(err, 'That code was not accepted. Check it and try again.'));
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
        {secondFactor ? (
          <>
            <Text style={{ color: theme.text.secondary }}>
              {secondFactor.strategy === 'email_code'
                ? `Enter the code we emailed to ${email}.`
                : secondFactor.strategy === 'phone_code'
                  ? 'Enter the code we texted you.'
                  : 'Enter the code from your authenticator app.'}
            </Text>
            <Input
              label="Verification code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
            />
            {error ? <Text style={{ color: theme.status.error }}>{error}</Text> : null}
            <Button label="Verify" onPress={handleVerifyCode} loading={submitting} />
            <Text
              style={[styles.footer, { color: theme.text.secondary }]}
              onPress={() => {
                setSecondFactor(null);
                setCode('');
                setError(null);
              }}
            >
              Use a different account
            </Text>
          </>
        ) : (
          <>
            <Button label="Continue with Google" variant="secondary" onPress={handleGoogle} loading={ssoPending} />
            <Text style={[styles.divider, { color: theme.text.secondary }]}>or</Text>
            <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            {error ? <Text style={{ color: theme.status.error }}>{error}</Text> : null}
            <Button label="Sign In" onPress={handleSignIn} loading={submitting} />
          </>
        )}
      </Card>
      {secondFactor ? null : (
        <Text style={[styles.footer, { color: theme.text.secondary }]} onPress={() => router.push('/sign-up')}>
          Don't have an account? Sign up
        </Text>
      )}
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
  divider: {
    fontSize: typeScale.compactBody.fontSize,
    textAlign: 'center',
  },
});
