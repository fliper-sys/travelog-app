import { Stack } from 'expo-router';

import { C } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { WorkspaceProvider } from '@/lib/workspace';

export default function AppLayout() {
  const { identity } = useSession();
  if (!identity) return null; // the root guard is about to show the sign-in screen

  return (
    <WorkspaceProvider key={identity.id} identity={identity}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trade" options={{ presentation: 'modal' }} />
        <Stack.Screen name="review" options={{ presentation: 'modal' }} />
      </Stack>
    </WorkspaceProvider>
  );
}
