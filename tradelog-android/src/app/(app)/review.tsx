import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { tradeDate, tradeR } from '@/core/analytics';
import { ADHERENCE, EMOTIONS, EMOTION_COLOR, MISTAKES } from '@/core/constants';
import { fmtPair, fmtR, fmtSigned, shortDate } from '@/core/format';
import type { Adherence, Emotion, Trade } from '@/core/types';
import { ModalHeader } from '@/components/ModalHeader';
import { Banner, Button, Card, Chips, Empty, Field, Input, Screen, Segmented, Small, Strong, T } from '@/components/ui';
import { C, S, toneColor } from '@/constants/theme';
import { useWorkspace } from '@/lib/workspace';

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data } = useWorkspace();
  const trade = data.trades.find((t) => t.id === id);

  if (!trade) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ModalHeader title="Review" />
        <Empty>This trade is no longer on this phone.</Empty>
      </Screen>
    );
  }
  return <ReviewForm key={trade.id} trade={trade} />;
}

function ReviewForm({ trade }: { trade: Trade }) {
  const { data, toast } = useWorkspace();
  const [adherence, setAdherence] = useState<Adherence>(trade.adherence ?? 'Yes');
  const [emotion, setEmotion] = useState<Emotion>(trade.emotion ?? 'Calm');
  const [confidence, setConfidence] = useState(trade.confidence ?? 3);
  const [mistake, setMistake] = useState(trade.mistake ?? 'None');
  const [lesson, setLesson] = useState(trade.lesson ?? '');
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pnl = trade.pnl == null ? null : Number(trade.pnl);
  const r = tradeR(trade);

  async function save() {
    setSubmitError(null);
    if (!lesson.trim()) {
      setLessonError('Add a lesson learned to complete the review.');
      return;
    }
    setLessonError(null);
    setBusy(true);
    try {
      await data.saveReview(trade, {
        adherence,
        emotion,
        confidence,
        mistake,
        lesson: lesson.trim(),
        review_status: 'reviewed',
        reviewed_at: new Date().toISOString(),
      });
      toast(data.online ? 'Review saved.' : 'Review saved on this phone. It will upload when you are online.');
      router.back();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not save the review.');
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ModalHeader title={`Review ${fmtPair(trade.pair)}`} />
      <Card>
        <Strong>
          {fmtPair(trade.pair)} {trade.direction.toUpperCase()} · {shortDate(tradeDate(trade))}
        </Strong>
        <T color={toneColor(pnl)} style={{ fontWeight: '800' }}>
          {fmtSigned(pnl)}
          {r != null ? ` (${fmtR(r)})` : ''}
        </T>
        <Small>
          {[trade.strategy, trade.timeframe].filter(Boolean).join(' · ')}
          {trade.notes ? `\n${trade.notes}` : ''}
        </Small>
      </Card>

      {submitError && <Banner kind="error">{submitError}</Banner>}

      <Field label="Plan adherence">
        <Segmented
          label="Plan adherence"
          value={adherence}
          onChange={setAdherence}
          options={ADHERENCE.map((a) => ({
            value: a,
            label: a,
            tint: a === 'Yes' ? C.mint : a === 'No' ? C.coral : C.amber,
          }))}
        />
      </Field>

      <Field label="Emotional state">
        <Chips options={EMOTIONS} value={emotion} onChange={setEmotion} tints={EMOTION_COLOR} />
      </Field>

      <Field label="Confidence" hint="1 = low, 5 = high">
        <Segmented
          label="Confidence"
          value={confidence}
          onChange={setConfidence}
          options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
        />
      </Field>

      <Field label="Mistake (if any)">
        <Chips options={MISTAKES} value={mistake} onChange={setMistake} />
      </Field>

      <Field label="Lesson learned" required error={lessonError}>
        <Input
          value={lesson}
          onChangeText={setLesson}
          placeholder="What will you repeat or change next time?"
          multiline
          invalid={!!lessonError}
        />
      </Field>

      <View style={{ gap: S.sm }}>
        <Button kind="primary" label={trade.review_status === 'reviewed' ? 'Update review' : 'Save review'} onPress={() => void save()} busy={busy} />
        <Button kind="ghost" label="Edit trade details" onPress={() => router.replace({ pathname: '/trade', params: { id: trade.id } })} disabled={busy} />
      </View>
    </Screen>
  );
}
