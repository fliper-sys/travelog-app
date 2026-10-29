import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { byNewest, computeStats, equityCurve, insights, reviewQueue } from '@/core/analytics';
import { fmtMoney, fmtPercent, fmtR, fmtRatio, fmtSigned } from '@/core/format';
import { AddFab } from '@/components/AddFab';
import { PageHeader } from '@/components/PageHeader';
import { RangePicker } from '@/components/RangePicker';
import { TradeRow } from '@/components/TradeRow';
import { TrendChart } from '@/components/TrendChart';
import { Button, Card, Empty, H2, Row, Screen, Small, Stat, Strong, T } from '@/components/ui';
import { C, S, toneColor } from '@/constants/theme';
import { RANGE_LABEL, useWorkspace } from '@/lib/workspace';

const INSIGHT_COLOR = { mint: C.mint, coral: C.coral, amber: C.amber, blue: C.blue } as const;

export default function Overview() {
  const { data, ranged, range } = useWorkspace();
  const stats = useMemo(() => computeStats(ranged), [ranged]);
  const curve = useMemo(() => equityCurve(ranged), [ranged]);
  const queue = useMemo(() => reviewQueue(data.trades), [data.trades]);
  const recent = useMemo(() => [...data.trades].sort(byNewest).slice(0, 5), [data.trades]);
  const notes = useMemo(() => insights(ranged).slice(0, 3), [ranged]);
  const balance = data.startBalance + computeStats(data.trades).netPnl;

  return (
    <Screen footer={<AddFab />}>
      <PageHeader title="Overview" sub="Your trading performance at a glance." />
      <RangePicker />

      <Card>
        <Small>Account balance</Small>
        <T style={{ fontSize: 30, fontWeight: '800' }}>{fmtMoney(balance)}</T>
        <Small>Starting balance {fmtMoney(data.startBalance)} · all trades on this phone</Small>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.md }}>
        <Stat label={`Net P&L · ${RANGE_LABEL[range]}`} value={fmtSigned(stats.netPnl)} color={toneColor(stats.netPnl)} />
        <Stat label="Win rate" value={stats.winRate == null ? '—' : fmtPercent(stats.winRate)} sub={`${stats.scored} trades`} />
        <Stat label="Profit factor" value={fmtRatio(stats.profitFactor)} />
        <Stat label="Average R" value={fmtR(stats.avgR, 2)} color={toneColor(stats.avgR)} />
      </View>

      <Card>
        <H2>Equity curve</H2>
        <TrendChart data={curve} format={fmtSigned} label="Equity curve" />
      </Card>

      <Card>
        <H2
          right={
            queue.length > 0 ? (
              <Button small label="Open" onPress={() => router.navigate('/reviews')} />
            ) : undefined
          }>
          Needs review
        </H2>
        {queue.length === 0 ? (
          <Empty>Nothing waiting. Nice work.</Empty>
        ) : (
          <>
            <Small>{queue.length} closed trade{queue.length === 1 ? '' : 's'} still need a review.</Small>
            {queue.slice(0, 3).map((t) => (
              <TradeRow
                key={t.id}
                trade={t}
                pending={data.pendingIds.has(t.id)}
                onPress={() => router.push({ pathname: '/review', params: { id: t.id } })}
              />
            ))}
          </>
        )}
      </Card>

      {notes.length > 0 && (
        <Card>
          <H2>Insights</H2>
          {notes.map((n) => (
            <Row key={n.title + n.detail} style={{ alignItems: 'flex-start', paddingVertical: 4 }}>
              <T style={{ fontSize: 20 }} color={INSIGHT_COLOR[n.tone]}>
                {n.icon}
              </T>
              <View style={{ flex: 1 }}>
                <Strong>{n.title}</Strong>
                <Small>{n.detail}</Small>
              </View>
            </Row>
          ))}
        </Card>
      )}

      <Card>
        <H2>Recent trades</H2>
        {recent.length === 0 ? (
          <Empty>No trades yet. Tap ＋ to add your first one — it works without a connection.</Empty>
        ) : (
          recent.map((t) => (
            <TradeRow
              key={t.id}
              trade={t}
              pending={data.pendingIds.has(t.id)}
              onPress={() => router.push({ pathname: '/trade', params: { id: t.id } })}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
