import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  computeStats,
  cumulativeR,
  emotionGroups,
  insights,
  isHighPriority,
  isPending,
  reviewQueue,
  strategyBreakdown,
  tradeDate,
  weekdayPerformance,
  byNewest,
} from '@/core/analytics';
import { EMOTION_COLOR } from '@/core/constants';
import {
  fmtPercent,
  fmtR,
  fmtRatio,
  fmtShort,
  fmtSigned,
  parseLocalDate,
  shortDate,
  todayLocal,
} from '@/core/format';
import type { Trade } from '@/core/types';
import { Donut } from '@/components/Donut';
import { PageHeader } from '@/components/PageHeader';
import { RangePicker } from '@/components/RangePicker';
import { TradeRow } from '@/components/TradeRow';
import { TrendChart } from '@/components/TrendChart';
import { Button, Card, Empty, H2, Row, Screen, Segmented, Small, Stat, Strong, T } from '@/components/ui';
import { C, R, S, toneColor } from '@/constants/theme';
import { useWorkspace } from '@/lib/workspace';

type Tab = 'analytics' | 'strategies' | 'mindset' | 'calendar';
const TABS: { value: Tab; label: string }[] = [
  { value: 'analytics', label: 'Stats' },
  { value: 'strategies', label: 'Setups' },
  { value: 'mindset', label: 'Mindset' },
  { value: 'calendar', label: 'Calendar' },
];
const INSIGHT_COLOR = { mint: C.mint, coral: C.coral, amber: C.amber, blue: C.blue } as const;

export default function Insights() {
  const [tab, setTab] = useState<Tab>('analytics');
  return (
    <Screen>
      <PageHeader title="Insights" sub="Turn results into repeatable habits." />
      <Segmented options={TABS} value={tab} onChange={setTab} label="Insight type" />
      {tab !== 'calendar' && <RangePicker />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'strategies' && <StrategiesTab />}
      {tab === 'mindset' && <MindsetTab />}
      {tab === 'calendar' && <CalendarTab />}
    </Screen>
  );
}

function AnalyticsTab() {
  const { ranged } = useWorkspace();
  const s = useMemo(() => computeStats(ranged), [ranged]);
  const rCurve = useMemo(() => cumulativeR(ranged), [ranged]);
  const weekdays = useMemo(() => weekdayPerformance(ranged), [ranged]);
  const maxAbs = Math.max(1, ...weekdays.map((w) => Math.abs(w.pnl)));
  const share = (n: number) => (s.scored ? fmtPercent(n / s.scored) : '0%');

  const minis: { label: string; value: string; color?: string }[] = [
    { label: 'Average win', value: s.avgWin == null ? '—' : fmtShort(s.avgWin), color: C.mint },
    { label: 'Average loss', value: s.avgLoss == null ? '—' : fmtShort(s.avgLoss), color: C.coral },
    { label: 'Best trade', value: s.best == null ? '—' : fmtShort(s.best), color: C.mint },
    { label: 'Worst trade', value: s.worst == null ? '—' : fmtShort(s.worst), color: C.coral },
    { label: 'Max drawdown', value: s.scored ? `-${fmtShort(s.maxDrawdown).replace('+', '')}` : '—' },
    { label: 'Expectancy', value: s.avgR == null ? '—' : `${fmtR(s.avgR, 2)} / trade`, color: toneColor(s.avgR) },
  ];

  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.md }}>
        <Stat label="Net P&L" value={fmtSigned(s.netPnl)} color={toneColor(s.netPnl)} />
        <Stat label="Win rate" value={s.winRate == null ? '—' : fmtPercent(s.winRate)} />
        <Stat label="Profit factor" value={fmtRatio(s.profitFactor)} />
        <Stat label="Average R" value={fmtR(s.avgR, 2)} color={toneColor(s.avgR)} />
      </View>

      <Card>
        <H2>Cumulative R</H2>
        <TrendChart data={rCurve} format={(v) => fmtR(v)} label="Cumulative R" color={C.blue} />
      </Card>

      <Card>
        <H2>Trade outcomes</H2>
        <Row style={{ gap: S.lg }}>
          <Donut
            segments={[
              { value: s.wins, color: C.mint },
              { value: s.losses, color: C.coral },
              { value: s.breakeven, color: '#627d9a' },
            ]}
            center={s.scored}
            label="Trades"
          />
          <View style={{ flex: 1, gap: 8 }}>
            <View>
              <Strong color={C.mint}>● Winning</Strong>
              <Small>{s.wins} trades · {share(s.wins)}</Small>
            </View>
            <View>
              <Strong color={C.coral}>● Losing</Strong>
              <Small>{s.losses} trades · {share(s.losses)}</Small>
            </View>
            {s.breakeven > 0 && (
              <View>
                <Strong color={C.muted}>● Break-even</Strong>
                <Small>{s.breakeven} trades</Small>
              </View>
            )}
          </View>
        </Row>
      </Card>

      <Card>
        <H2>Trade statistics</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
          {minis.map((m) => (
            <View key={m.label} style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: C.field, borderRadius: R.field, padding: S.md }}>
              <Small>{m.label}</Small>
              <T style={{ fontWeight: '800', fontSize: 17 }} color={m.color}>
                {m.value}
              </T>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <H2>Performance by weekday</H2>
        {weekdays.map((w) => (
          <View key={w.day} style={{ gap: 4, marginVertical: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T>
                {w.day} <Small>· {w.trades}</Small>
              </T>
              <T color={toneColor(w.pnl)}>{fmtShort(w.pnl)}</T>
            </Row>
            <Bar ratio={Math.abs(w.pnl) / maxAbs} color={w.pnl < 0 ? C.coral : C.mint} />
          </View>
        ))}
      </Card>
    </>
  );
}

function Bar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: C.field, overflow: 'hidden' }}>
      <View style={{ height: 8, width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

function StrategiesTab() {
  const { ranged } = useWorkspace();
  const rows = useMemo(() => strategyBreakdown(ranged), [ranged]);
  return (
    <Card>
      <H2 right={<Small>Ranked by net P&L</Small>}>Strategy performance</H2>
      {rows.length === 0 ? (
        <Empty>No closed trades in this range.</Empty>
      ) : (
        rows.map((r) => (
          <View key={r.strategy} style={{ gap: 5, paddingVertical: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Strong>{r.strategy}</Strong>
              <T color={toneColor(r.netPnl)}>{fmtShort(r.netPnl)}</T>
            </Row>
            <Bar ratio={r.winRate ?? 0} color={C.mint} />
            <Small>
              {r.trades} trade{r.trades === 1 ? '' : 's'} · {Math.round((r.winRate ?? 0) * 100)}% win · Avg {fmtR(r.avgR, 2)}
              {r.profitFactor != null ? ` · PF ${fmtRatio(r.profitFactor)}` : ''}
            </Small>
          </View>
        ))
      )}
    </Card>
  );
}

function MindsetTab() {
  const { ranged } = useWorkspace();
  const groups = useMemo(() => emotionGroups(ranged), [ranged]);
  const notes = useMemo(() => insights(ranged), [ranged]);
  const total = groups.reduce((sum, g) => sum + g.trades, 0);

  return (
    <>
      <Card>
        <H2>Emotional state</H2>
        {total === 0 ? (
          <Empty>Review a few trades and log how you felt to see this chart.</Empty>
        ) : (
          <Row style={{ gap: S.lg }}>
            <Donut segments={groups.map((g) => ({ value: g.trades, color: EMOTION_COLOR[g.emotion] }))} center={total} label="Trades" />
            <View style={{ flex: 1, gap: 6 }}>
              {groups
                .filter((g) => g.trades > 0)
                .map((g) => (
                  <View key={g.emotion}>
                    <Strong color={EMOTION_COLOR[g.emotion]}>● {g.emotion}</Strong>
                    <Small>{g.trades} trades · {Math.round((g.trades / total) * 100)}%</Small>
                  </View>
                ))}
            </View>
          </Row>
        )}
      </Card>

      <Card>
        <H2>Key insights</H2>
        {notes.length === 0 ? (
          <Empty>Review a few more trades to unlock insights.</Empty>
        ) : (
          notes.map((n) => (
            <Row key={n.title + n.detail} style={{ alignItems: 'flex-start', paddingVertical: 4 }}>
              <T style={{ fontSize: 20 }} color={INSIGHT_COLOR[n.tone]}>
                {n.icon}
              </T>
              <View style={{ flex: 1 }}>
                <Strong>{n.title}</Strong>
                <Small>{n.detail}</Small>
              </View>
            </Row>
          ))
        )}
      </Card>

      <Card>
        <H2>Results by emotional state</H2>
        {groups.map((g) => (
          <Row key={g.emotion} style={{ paddingVertical: 6 }}>
            <T color={EMOTION_COLOR[g.emotion]}>●</T>
            <View style={{ flex: 1 }}>
              <Strong>{g.emotion}</Strong>
              <Small>
                {g.trades} trades · avg {fmtR(g.avgR, 2)} · {Math.round((g.winRate ?? 0) * 100)}% win
              </Small>
            </View>
            <T color={toneColor(g.netPnl)}>{g.trades ? fmtSigned(g.netPnl) : '—'}</T>
          </Row>
        ))}
      </Card>
    </>
  );
}

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = (n: number) => String(n).padStart(2, '0');

function CalendarTab() {
  const { data } = useWorkspace();
  const [cursor, setCursor] = useState(() => {
    const d = parseLocalDate(todayLocal());
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of data.trades) {
      const key = tradeDate(t);
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [data.trades]);

  const { year, month } = cursor;
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayLocal();
  const queue = useMemo(() => reviewQueue(data.trades), [data.trades]);
  const list = selected ? (byDay.get(selected) ?? []) : queue.slice(0, 5);

  function shift(step: number) {
    const d = new Date(year, month + step, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(null);
  }
  function latest() {
    const newest = [...data.trades].sort(byNewest)[0];
    const d = parseLocalDate(newest ? tradeDate(newest) : today);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(null);
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <Card>
      <H2>{new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</H2>
      <Row>
        <Button small label="←" onPress={() => shift(-1)} />
        <Button small label="Latest" onPress={latest} style={{ flex: 1 }} />
        <Button small label="→" onPress={() => shift(1)} />
      </Row>

      <View style={{ flexDirection: 'row', marginTop: S.sm }}>
        {DAY_NAMES.map((n, i) => (
          <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center' }}>
            <Small>{n}</Small>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (day == null) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 46 }} />;
          const key = `${year}-${pad(month + 1)}-${pad(day)}`;
          const trades = byDay.get(key) ?? [];
          const waiting = trades.filter(isPending);
          const dot = !trades.length ? null : waiting.some(isHighPriority) ? C.coral : waiting.length ? C.amber : C.mint;
          const on = key === selected;
          return (
            <Pressable
              key={key}
              onPress={() => setSelected(on ? null : key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${shortDate(key)}${trades.length ? `, ${trades.length} trade${trades.length === 1 ? '' : 's'}, ${waiting.length} to review` : ''}`}
              style={{ width: `${100 / 7}%`, height: 46, padding: 2 }}>
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: on ? C.mint : key === today ? C.blue : 'transparent',
                  backgroundColor: on ? C.mint + '22' : 'transparent',
                }}>
                <Text style={{ color: C.text, fontSize: 14 }}>{day}</Text>
                <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: dot ?? 'transparent' }} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <Row style={{ flexWrap: 'wrap', gap: S.md }}>
        <Small color={C.mint}>● Reviewed</Small>
        <Small color={C.amber}>● Pending</Small>
        <Small color={C.coral}>● High priority</Small>
      </Row>

      <H2>{selected ? `Trades on ${shortDate(selected)}` : 'Upcoming reviews'}</H2>
      {list.length === 0 ? (
        <Empty>{selected ? 'No trades on this day.' : 'No pending reviews.'}</Empty>
      ) : (
        list.map((t) => (
          <TradeRow
            key={t.id}
            trade={t}
            pending={data.pendingIds.has(t.id)}
            onPress={() =>
              router.push({ pathname: isPending(t) ? '/review' : '/trade', params: { id: t.id } })
            }
          />
        ))
      )}
    </Card>
  );
}
