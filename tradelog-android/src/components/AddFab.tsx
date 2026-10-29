import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { C } from '@/constants/theme';

/** Floating "add trade" button. */
export function AddFab() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a trade"
      onPress={() => router.push('/trade')}
      android_ripple={{ color: '#00000033', borderless: true }}
      style={st.fab}>
      <Text style={st.plus}>＋</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.mint,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  plus: { color: C.onMint, fontSize: 28, fontWeight: '700', marginTop: -2 },
});
