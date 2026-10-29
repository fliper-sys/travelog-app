import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { Banner, Button, Card, Field, Input, Screen, Small, T } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const { beforeSignIn } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const isLogin = mode === 'login';

  async function submit() {
    if (!supabase || busy) return;
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!isLogin && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    beforeSignIn();
    try {
      if (isLogin) {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) setError(err.message);
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
        if (err) setError(err.message);
        else if (!data.session) {
          setInfo('Account created. Check your email to confirm it, then sign in.');
          setMode('login');
          setPassword('');
          setConfirm('');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Check your connection and try again.');
    }
    setBusy(false);
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ alignItems: 'center', marginTop: 32, marginBottom: S.lg }}>
          <Text style={{ color: C.mint, fontSize: 30, fontWeight: '900', letterSpacing: 2 }}>▥ TRADELOG</Text>
        </View>
        <Card style={{ gap: S.md }}>
          <Text style={{ color: C.text, fontSize: 24, fontWeight: '800' }}>
            {isLogin ? 'Welcome back' : 'Create your account'}
          </Text>
          <T color={C.muted}>
            {isLogin ? 'Sign in to your trading journal.' : 'Record. Review. Refine. Your trades stay private to you.'}
          </T>

          {error && <Banner kind="error">{error}</Banner>}
          {info && <Banner>{info}</Banner>}

          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              returnKeyType={isLogin ? 'go' : 'next'}
              onSubmitEditing={() => {
                if (isLogin) void submit();
              }}
            />
          </Field>
          {!isLogin && (
            <Field label="Confirm password">
              <Input
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!show}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
              />
            </Field>
          )}
          <Pressable onPress={() => setShow((v) => !v)} accessibilityRole="button" hitSlop={8}>
            <Small color={C.blue}>{show ? 'Hide password' : 'Show password'}</Small>
          </Pressable>

          <Button
            kind="primary"
            label={isLogin ? 'Sign in' : 'Create account'}
            onPress={() => void submit()}
            busy={busy}
          />
          <Button
            kind="ghost"
            label={isLogin ? 'New here? Create an account' : 'Have an account? Sign in'}
            onPress={() => {
              setMode(isLogin ? 'register' : 'login');
              setError(null);
              setInfo(null);
              setConfirm('');
            }}
          />
          <Small>Signing in needs a connection. After that, the app works offline.</Small>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}
