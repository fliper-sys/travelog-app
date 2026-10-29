import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { byNewest, tradeTime } from '@/core/analytics';
import type { Trade } from '@/core/types';
import { AddFab } from '@/components/AddFab';
import { PageHeader } from '@/components/PageHeader';
import { TradeRow } from '@/components/TradeRow';
import { Chips, Empty, Input, Small, s } from '@/components/ui';
import { S } from '@/constants/theme';
import { useWorkspace } from '@/lib/workspace';

const STATUS = ['All', 'Needs review', 'Reviewed', 'Open'] as const;
const SORT = ['Newest', 'Oldest', 'Best', 'Worst'] as const;
type Status = (typeof STATUS)[number];
type Sort = (typeof SORT)[number];

const pnlOf = (t: Trade) => (t.pnl == null ? 0 : Number(t.pnl));

export default function Journal() {
  const { data } = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('All');
  const [sort, setSort] = useState<Sort>('Newest');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data.trades.filter((t) => {
      if (q && !`${t.pair} ${t.strategy ?? ''} ${t.notes ?? ''} ${t.lesson ?? ''}`.toLowerCase().includes(q)) return false;
      if (status === 'Open') return t.status === 'open';
      if (status === 'Needs review') return t.status === 'closed' && t.review_status === 'pending';
      if (status === 'Reviewed') return t.review_status === 'reviewed';
      return true;
    });
    const order: Record<Sort, (a: Trade, b: Trade) => number> = {
      Newest: byNewest,
      Oldest: (a, b) => tradeTime(a) - tradeTime(b),
      Best: (a, b) => pnlOf(b) - pnlOf(a),
      Worst: (a, b) => pnlOf(a) - pnlOf(b),
    };
    return rows.sort(order[sort]);
  }, [data.trades, query, status, sort]);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        data={list}
        keyExtractor={(t) => t.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: S.lg, paddingBottom: 120 }}
        ListHeaderComponent={
          <>
            <PageHeader title="Trade Journal" sub={`${list.length} of ${data.trades.length} trades`} />
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search pair, strategy or notes"
              autoCapitalize="none"
              style={{ marginTop: S.md }}
              accessibilityLabel="Search trades"
            />
            <Chips options={STATUS} value={status} onChange={setStatus} />
            <Small>Sort</Small>
            <Chips options={SORT} value={sort} onChange={setSort} />
          </>
        }
        renderItem={({ item }) => (
          <TradeRow
            trade={item}
            pending={data.pendingIds.has(item.id)}
            onPress={() => router.push({ pathname: '/trade', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <Empty>{data.trades.length === 0 ? 'No trades yet. Tap ＋ to add your first one.' : 'No trades match these filters.'}</Empty>
        }
        initialNumToRender={20}
      />
      <AddFab />
    </SafeAreaView>
  );
}
