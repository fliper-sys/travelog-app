import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { C, S } from '@/constants/theme';

/** Title bar for the full-screen forms, with a Close button. */
export function ModalHeader({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm }}>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: '800', flex: 1 }} accessibilityRole="header">
        {title}
      </Text>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={12}
        style={{ padding: S.sm }}>
        <Text style={{ color: C.muted, fontSize: 22 }}>✕</Text>
      </Pressable>
    </View>
  );
}
