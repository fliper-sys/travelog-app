import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tradeDate, tradeR } from '@/core/analytics';
import { fmtPair, fmtR, fmtSigned, shortDate } from '@/core/format';
import type { Trade } from '@/core/types';
import { C, R, S, toneColor } from '@/constants/theme';
import { Small, Tag } from './ui';

/** One trade in a list. `pending` shows that its latest change is not uploaded yet. */
export function TradeRow({
  trade,
  pending,
  onPress,
  onLongPress,
}: {
  trade: Trade;
  pending?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const pnl = trade.pnl == null ? null : Number(trade.pnl);
  const r = tradeR(trade);
  const buy = trade.direction === 'Buy';
  const needsReview = trade.status === 'closed' && trade.review_status === 'pending';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${fmtPair(trade.pair)} ${trade.direction}, ${shortDate(tradeDate(trade))}, ${
        pnl == null ? 'open' : fmtSigned(pnl)
      }${pending ? ', not uploaded yet' : ''}`}
      android_ripple={{ color: '#ffffff14' }}
      style={st.row}>
      <View style={[st.badge, { backgroundColor: (buy ? C.mint : C.coral) + '22' }]}>
        <Text style={[st.badgeText, { color: buy ? C.mint : C.coral }]}>{buy ? 'B' : 'S'}</Text>
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <View style={st.line}>
          <Text style={st.pair}>{fmtPair(trade.pair)}</Text>
          {trade.status === 'open' && <Tag label="OPEN" color={C.blue} />}
          {needsReview && <Tag label="REVIEW" color={C.amber} />}
          {pending && <Tag label="NOT SYNCED" color={C.violet} />}
        </View>
        <Small>
          {shortDate(tradeDate(trade))}
          {trade.strategy ? ` · ${trade.strategy}` : ''}
          {trade.timeframe ? ` · ${trade.timeframe}` : ''}
        </Small>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[st.pnl, { color: toneColor(pnl) }]}>{pnl == null ? '—' : fmtSigned(pnl)}</Text>
        <Small color={toneColor(r)}>{r == null ? '' : fmtR(r)}</Small>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: S.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  badge: { width: 38, height: 38, borderRadius: R.field, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '800', fontSize: 15 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pair: { color: C.text, fontWeight: '700', fontSize: 15 },
  pnl: { fontWeight: '800', fontSize: 15 },
});
