import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, R } from '@/constants/theme';
import type { TradeData } from '@/lib/use-trade-data';

const LOOK: Record<TradeData['state'], { color: string; label: string }> = {
  synced: { color: C.mint, label: 'Synced' },
  syncing: { color: C.blue, label: 'Syncing…' },
  pending: { color: C.amber, label: 'Waiting to upload' },
  offline: { color: C.amber, label: 'Offline' },
  problem: { color: C.coral, label: 'Sync problem' },
};

/** Small status chip: tap it to sync now. */
export function SyncPill({ data }: { data: TradeData }) {
  const look = LOOK[data.state];
  let label = look.label;
  if (data.state === 'syncing' && data.slow) label = 'Waiting for connection…';
  else if (data.state === 'offline' && data.pendingCount > 0) label = `Offline · ${data.pendingCount} saved`;
  else if (data.state === 'pending') label = `${data.pendingCount} to upload`;

  return (
    <Pressable
      onPress={() => void data.syncNow()}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Tap to sync now.`}
      style={[st.pill, { borderColor: look.color + '88', backgroundColor: look.color + '18' }]}>
      <View style={[st.dot, { backgroundColor: look.color }]} />
      <Text style={[st.text, { color: look.color }]}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: R.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '700' },
});
