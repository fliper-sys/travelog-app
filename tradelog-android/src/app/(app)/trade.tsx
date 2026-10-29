import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { calcR, tradeDate } from '@/core/analytics';
import { DEFAULT_STRATEGIES, PAIRS, TIMEFRAMES } from '@/core/constants';
import { dateToIso, fmtPair, fmtR, normalizePair, todayLocal } from '@/core/format';
import type { Direction, TradeInput, TradeStatus } from '@/core/types';
import { ModalHeader } from '@/components/ModalHeader';
import { Banner, Button, Chips, Empty, Field, Input, Screen, Segmented, Small, T } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useWorkspace } from '@/lib/workspace';

type Key = 'pair' | 'date' | 'entry' | 'exit' | 'stop' | 'target' | 'lot' | 'pnl' | 'r';
type Errors = Partial<Record<Key, string>>;

const str = (v: number | null | undefined) => (v == null ? '' : String(v));

/** "" -> null, a number -> number, anything else -> NaN. Accepts a decimal comma. */
function parse(value: string): number | null {
  const v = value.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
const isNum = (n: number | null): n is number => n != null && !Number.isNaN(n);

/** Keep the original timestamps when the trade date is unchanged. */
function buildDates(date: string, status: TradeStatus, initialOpened: string | null, initialClosed: string | null, initialDate: string | null) {
  const unchanged = initialDate === date;
  const opened = unchanged && initialOpened ? initialOpened : dateToIso(date);
  const closed = status === 'closed' ? (unchanged && initialClosed ? initialClosed : dateToIso(date)) : null;
  return { opened, closed };
}

export default function TradeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data } = useWorkspace();
  const initial = id ? (data.trades.find((t) => t.id === id) ?? null) : null;

  if (id && !initial) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ModalHeader title="Trade" />
        <Empty>This trade is no longer on this phone.</Empty>
      </Screen>
    );
  }
  return <TradeForm key={initial?.id ?? 'new'} initial={initial} />;
}

function TradeForm({ initial }: { initial: ReturnType<typeof useWorkspace>['data']['trades'][number] | null }) {
  const { data, toast } = useWorkspace();

  const [pair, setPair] = useState(initial ? fmtPair(initial.pair) : '');
  const [direction, setDirection] = useState<Direction>(initial?.direction ?? 'Buy');
  const [status, setStatus] = useState<TradeStatus>(initial?.status ?? 'closed');
  const [strategy, setStrategy] = useState(initial?.strategy ?? '');
  const [timeframe, setTimeframe] = useState(initial?.timeframe ?? '1H');
  const [date, setDate] = useState(() => (initial ? tradeDate(initial) : todayLocal()));
  const [entry, setEntry] = useState(str(initial?.entry_price));
  const [exit, setExit] = useState(str(initial?.exit_price));
  const [stop, setStop] = useState(str(initial?.stop_loss));
  const [target, setTarget] = useState(str(initial?.take_profit));
  const [lot, setLot] = useState(str(initial?.lot_size));
  const [pnl, setPnl] = useState(str(initial?.pnl));
  const [notes, setNotes] = useState(initial?.notes ?? '');

  // R multiple: calculated unless the user types their own value.
  const initialAuto = initial
    ? calcR(
        initial.direction,
        Number(initial.entry_price),
        initial.exit_price == null ? null : Number(initial.exit_price),
        initial.stop_loss == null ? null : Number(initial.stop_loss),
      )
    : null;
  const [rInput, setRInput] = useState(str(initial?.r_multiple));
  const [rManual, setRManual] = useState(
    initial?.r_multiple != null && (initialAuto == null || Math.abs(initialAuto - Number(initial.r_multiple)) > 0.005),
  );

  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const entryN = parse(entry);
  const exitN = parse(exit);
  const stopN = parse(stop);
  const targetN = parse(target);
  const pnlN = parse(pnl);

  const autoR = isNum(entryN) ? calcR(direction, entryN, isNum(exitN) ? exitN : null, isNum(stopN) ? stopN : null) : null;
  const rShown = rManual ? rInput : autoR != null ? String(autoR) : '';
  const rValue = parse(rShown);
  const riskReward =
    isNum(entryN) && isNum(stopN) && isNum(targetN) && entryN !== stopN
      ? Math.abs(targetN - entryN) / Math.abs(entryN - stopN)
      : null;

  const warnings: string[] = [];
  if (isNum(entryN) && isNum(stopN)) {
    if (direction === 'Buy' && stopN >= entryN) warnings.push('For a Buy, the stop loss is normally below entry.');
    if (direction === 'Sell' && stopN <= entryN) warnings.push('For a Sell, the stop loss is normally above entry.');
  }
  if (isNum(entryN) && isNum(targetN)) {
    if (direction === 'Buy' && targetN <= entryN) warnings.push('For a Buy, the take profit is normally above entry.');
    if (direction === 'Sell' && targetN >= entryN) warnings.push('For a Sell, the take profit is normally below entry.');
  }
  if (isNum(pnlN) && isNum(rValue) && pnlN !== 0 && rValue !== 0 && pnlN > 0 !== rValue > 0) {
    warnings.push('P&L and R multiple have opposite signs. Check both.');
  }

  const knownStrategies = useMemo(
    () => [...new Set([...DEFAULT_STRATEGIES, ...data.trades.map((t) => t.strategy).filter((x): x is string => !!x)])],
    [data.trades],
  );

  function validate(): Errors {
    const e: Errors = {};
    const p = normalizePair(pair);
    if (!p) e.pair = 'Choose or type a pair.';
    else if (!/^[A-Z0-9/]{3,12}$/.test(p)) e.pair = 'Use a pair like EUR/USD.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
      e.date = 'Use the format YYYY-MM-DD.';
    }
    if (entry.trim() === '') e.entry = 'Entry price is required.';
    else if (!isNum(entryN) || entryN <= 0) e.entry = 'Enter a number above 0.';
    if (exit.trim() !== '' && (!isNum(exitN) || exitN <= 0)) e.exit = 'Enter a number above 0.';
    if (stop.trim() !== '' && (!isNum(stopN) || stopN <= 0)) e.stop = 'Enter a number above 0.';
    if (target.trim() !== '' && (!isNum(targetN) || targetN <= 0)) e.target = 'Enter a number above 0.';
    const lotN = parse(lot);
    if (lot.trim() !== '' && (!isNum(lotN) || lotN <= 0)) e.lot = 'Enter a number above 0.';
    if (status === 'closed' && pnl.trim() === '') e.pnl = 'Enter the net P&L (after fees).';
    else if (pnl.trim() !== '' && !isNum(pnlN)) e.pnl = 'Enter a number, like 245 or -85.';
    if (rManual && rInput.trim() !== '' && !isNum(parse(rInput))) e.r = 'Enter a number, like 1.5 or -1.';
    return e;
  }

  async function save() {
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSubmitError('Fix the highlighted fields and try again.');
      return;
    }
    const dates = buildDates(date, status, initial?.opened_at ?? null, initial?.closed_at ?? null, initial ? tradeDate(initial) : null);
    const lotN = parse(lot);
    const input: TradeInput = {
      pair: normalizePair(pair),
      direction,
      status,
      entry_price: entryN as number,
      exit_price: isNum(exitN) ? exitN : null,
      stop_loss: isNum(stopN) ? stopN : null,
      take_profit: isNum(targetN) ? targetN : null,
      lot_size: isNum(lotN) ? lotN : null,
      pnl: isNum(pnlN) ? pnlN : null,
      r_multiple: isNum(rValue) ? rValue : null,
      strategy: strategy.trim() || null,
      timeframe,
      notes: notes.trim() || null,
      opened_at: dates.opened,
      closed_at: dates.closed,
    };

    setBusy(true);
    try {
      await data.saveTrade(input, initial);
      toast(data.online ? 'Trade saved.' : 'Saved on this phone. It will upload when you are online.');
      router.back();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not save the trade.');
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!initial) return;
    Alert.alert('Delete this trade?', `${fmtPair(initial.pair)} ${initial.direction} · ${tradeDate(initial)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            try {
              await data.removeTrade(initial);
              toast('Trade deleted.', { label: 'Undo', run: () => void data.restoreTrade(initial) });
              router.back();
            } catch {
              setSubmitError('Could not delete the trade.');
            }
          })(),
      },
    ]);
  }

  const num = { keyboardType: 'decimal-pad' as const };

  return (
    <Screen edges={['top', 'bottom']}>
      <ModalHeader title={initial ? 'Edit trade' : 'Add a trade'} />
      {submitError && <Banner kind="error">{submitError}</Banner>}

      <Field label="Currency pair" required error={errors.pair}>
        <Input
          value={pair}
          onChangeText={setPair}
          onBlur={() => setPair(normalizePair(pair))}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="EUR/USD"
          invalid={!!errors.pair}
        />
        <Chips options={PAIRS} value={normalizePair(pair)} onChange={setPair} />
      </Field>

      <Field label="Direction">
        <Segmented
          label="Direction"
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'Buy', label: 'BUY', tint: C.mint },
            { value: 'Sell', label: 'SELL', tint: C.coral },
          ]}
        />
      </Field>

      <Field label="Trade status">
        <Segmented
          label="Trade status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'closed', label: 'Closed' },
            { value: 'open', label: 'Open' },
          ]}
        />
      </Field>

      <Field label="Trade date" required error={errors.date} hint="Year-month-day, like 2026-03-14">
        <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" invalid={!!errors.date} />
        <Chips options={['Today']} value="" onChange={() => setDate(todayLocal())} />
      </Field>

      <Field label="Strategy" hint="Pick one or type a new one.">
        <Input value={strategy} onChangeText={setStrategy} placeholder="Breakout" />
        <Chips options={knownStrategies} value={strategy.trim()} onChange={setStrategy} />
      </Field>

      <Field label="Timeframe">
        <Chips options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
      </Field>

      <T color={C.muted} style={{ marginTop: S.sm, fontWeight: '700' }}>
        PRICES
      </T>
      <Field label="Entry price" required error={errors.entry}>
        <Input value={entry} onChangeText={setEntry} placeholder="1.08250" invalid={!!errors.entry} {...num} />
      </Field>
      <Field label="Exit price" error={errors.exit}>
        <Input value={exit} onChangeText={setExit} placeholder="1.08620" invalid={!!errors.exit} {...num} />
      </Field>
      <Field label="Stop loss" error={errors.stop}>
        <Input value={stop} onChangeText={setStop} placeholder="1.07900" invalid={!!errors.stop} {...num} />
      </Field>
      <Field label="Take profit" error={errors.target}>
        <Input value={target} onChangeText={setTarget} placeholder="1.09000" invalid={!!errors.target} {...num} />
      </Field>

      <T color={C.muted} style={{ marginTop: S.sm, fontWeight: '700' }}>
        RESULT
      </T>
      <Field label="Net P&L ($)" required={status === 'closed'} error={errors.pnl} hint="After fees and commission.">
        <Input value={pnl} onChangeText={setPnl} placeholder="245" invalid={!!errors.pnl} keyboardType="numbers-and-punctuation" />
      </Field>
      <Field
        label="R multiple"
        error={errors.r}
        hint={
          rManual
            ? 'Your own value. Clear it to calculate automatically.'
            : autoR != null
              ? `Calculated from entry, stop and exit: ${fmtR(autoR, 2)}`
              : 'Add stop loss and exit price to calculate it, or type your own.'
        }>
        <Input
          value={rShown}
          onChangeText={(v) => {
            setRInput(v);
            setRManual(v.trim() !== '');
          }}
          placeholder="Auto"
          invalid={!!errors.r}
          keyboardType="numbers-and-punctuation"
        />
      </Field>
      <Field label="Lot size" error={errors.lot}>
        <Input value={lot} onChangeText={setLot} placeholder="0.50" invalid={!!errors.lot} {...num} />
      </Field>
      <Field label="Risk : reward (planned)">
        <T>{riskReward != null ? `1 : ${riskReward.toFixed(2)}` : 'Add entry, stop and target'}</T>
      </Field>

      <Field label="Notes / setup context">
        <Input value={notes} onChangeText={setNotes} placeholder="Why did you take this trade?" multiline />
      </Field>

      {warnings.length > 0 && (
        <Banner kind="warn">{warnings.join('\n')}</Banner>
      )}

      <View style={{ gap: S.sm, marginTop: S.sm }}>
        <Button kind="primary" label={initial ? 'Save changes' : 'Save trade'} onPress={() => void save()} busy={busy} />
        {initial && <Button kind="danger" label="Delete trade" onPress={confirmDelete} disabled={busy} />}
        <Small>Saved on this phone first. It uploads automatically when you have a connection.</Small>
      </View>
    </Screen>
  );
}
