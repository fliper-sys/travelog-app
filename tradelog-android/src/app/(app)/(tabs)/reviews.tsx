import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { byNewest, isHighPriority, reviewQueue } from '@/core/analytics';
import { fmtPercent } from '@/core/format';
import { PageHeader } from '@/components/PageHeader';
import { TradeRow } from '@/components/TradeRow';
import { Card, Empty, H2, Screen, Small, Stat, Tag } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useWorkspace } from '@/lib/workspace';

export default function Reviews() {
  const { data } = useWorkspace();
  const queue = useMemo(() => reviewQueue(data.trades), [data.trades]);
  const done = useMemo(
    () => data.trades.filter((t) => t.review_status === 'reviewed').sort(byNewest),
    [data.trades],
  );
  const closed = data.trades.filter((t) => t.status === 'closed').length;
  const high = queue.filter(isHighPriority).length;

  return (
    <Screen>
      <PageHeader title="Trade Reviews" sub="Review decisions, execution and psychology." />

      <View style={{ flexDirection: 'row', gap: S.md }}>
        <Stat label="Waiting" value={String(queue.length)} color={queue.length ? C.amber : C.mint} />
        <Stat label="Reviewed" value={closed ? fmtPercent(done.length / closed, 0) : '—'} sub={`${done.length} of ${closed}`} />
      </View>

      <Card>
        <H2>Review queue</H2>
        {high > 0 && <Small>{high} high priority (losses and trades off-plan) are listed first.</Small>}
        {queue.length === 0 ? (
          <Empty>All caught up. Closed trades appear here until you review them.</Empty>
        ) : (
          queue.map((t) => (
            <View key={t.id}>
              <TradeRow
                trade={t}
                pending={data.pendingIds.has(t.id)}
                onPress={() => router.push({ pathname: '/review', params: { id: t.id } })}
              />
              {isHighPriority(t) && <Tag label="HIGH PRIORITY" color={C.coral} />}
            </View>
          ))
        )}
      </Card>

      <Card>
        <H2>Reviewed</H2>
        {done.length === 0 ? (
          <Empty>Completed reviews will show up here.</Empty>
        ) : (
          done.slice(0, 30).map((t) => (
            <TradeRow
              key={t.id}
              trade={t}
              pending={data.pendingIds.has(t.id)}
              onPress={() => router.push({ pathname: '/review', params: { id: t.id } })}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
