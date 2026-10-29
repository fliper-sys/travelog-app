import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { C } from '@/constants/theme';
import { SessionProvider, useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Keep the splash screen up until we know who (if anyone) is signed in.
SplashScreen.preventAutoHideAsync();

export default function Root() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionProvider>
        <Navigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function Navigator() {
  const { ready, identity } = useSession();
  if (ready) SplashScreen.hide();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Protected guard={!supabase}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={!!supabase && !identity}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!identity}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
