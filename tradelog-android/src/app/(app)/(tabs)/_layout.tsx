import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { C } from '@/constants/theme';

const glyph = (g: string) =>
  function Icon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 20 }}>{g}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.mint,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.panel, borderTopColor: C.line, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
        sceneStyle: { backgroundColor: C.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: glyph('◫') }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: glyph('▤') }} />
      <Tabs.Screen name="reviews" options={{ title: 'Reviews', tabBarIcon: glyph('☑') }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: glyph('⌁') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: glyph('⚙') }} />
    </Tabs>
  );
}
