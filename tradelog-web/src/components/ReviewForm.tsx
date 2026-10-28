"use client";

import { useState, type FormEvent } from "react";
import type { Adherence, Emotion, ReviewInput, Trade } from "@/lib/types";
import { ADHERENCE, EMOTIONS, MISTAKES } from "@/lib/constants";
import { tradeDate, tradeR } from "@/lib/analytics";
import { fmtPair, fmtR, fmtSigned, shortDate, tone } from "@/lib/format";
import Modal from "./Modal";

interface Props {
  trade: Trade;
  onCancel: () => void;
  /** Resolves to an error message, or null on success. */
  onSave: (review: ReviewInput) => Promise<string | null>;
}

export default function ReviewForm({ trade, onCancel, onSave }: Props) {
  const [adherence, setAdherence] = useState<Adherence>(trade.adherence ?? "Yes");
  const [emotion, setEmotion] = useState<Emotion>(trade.emotion ?? "Calm");
  const [confidence, setConfidence] = useState(trade.confidence ?? 3);
  const [mistake, setMistake] = useState(trade.mistake ?? "None");
  const [lesson, setLesson] = useState(trade.lesson ?? "");
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pnl = trade.pnl == null ? null : Number(trade.pnl);
  const r = tradeR(trade);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitError(null);
    if (!lesson.trim()) {
      setLessonError("Add a lesson learned to complete the review.");
      document.getElementById("rf-lesson")?.focus();
      return;
    }
    setLessonError(null);

    setBusy(true);
    const message = await onSave({
      adherence,
      emotion,
      confidence,
      mistake,
      lesson: lesson.trim(),
      review_status: "reviewed",
      reviewed_at: new Date().toISOString(),
    });
    setBusy(false);
    if (message) setSubmitError(message);
  }

  return (
    <Modal
      title={`Review ${fmtPair(trade.pair)} · ${shortDate(tradeDate(trade))}`}
      onClose={onCancel}
      initialFocus="#rf-lesson"
    >
      <div className="summary">
        <span className="strong">
          {fmtPair(trade.pair)} {trade.direction.toUpperCase()}
        </span>
        {trade.strategy ? ` · ${trade.strategy}` : ""}
        {trade.timeframe ? ` · ${trade.timeframe}` : ""} ·{" "}
        <span className={`${tone(pnl)} strong`}>
          {fmtSigned(pnl)}
          {r != null ? ` (${fmtR(r)})` : ""}
        </span>
        {trade.notes && <div className="small" style={{ marginTop: 4 }}>{trade.notes}</div>}
      </div>

      <form onSubmit={onSubmit} noValidate>
        {submitError && (
          <div className="alert" role="alert">
            {submitError}
          </div>
        )}

        <div className="formgrid">
          <div className="field">
            <label htmlFor="rf-adherence">Plan adherence</label>
            <select id="rf-adherence" value={adherence} onChange={(e) => setAdherence(e.target.value as Adherence)}>
              {ADHERENCE.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="rf-emotion">Emotional state</label>
            <select id="rf-emotion" value={emotion} onChange={(e) => setEmotion(e.target.value as Emotion)}>
              {EMOTIONS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="label" id="rf-confidence-label">
              Confidence
            </span>
            <div className="seg" role="group" aria-labelledby="rf-confidence-label">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-pressed={confidence === n} onClick={() => setConfidence(n)}>
                  {n}
                </button>
              ))}
            </div>
            <span className="hint">1 = low, 5 = high</span>
          </div>

          <div className="field">
            <label htmlFor="rf-mistake">Mistake (if any)</label>
            <select id="rf-mistake" value={mistake} onChange={(e) => setMistake(e.target.value)}>
              {MISTAKES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className={`field full${lessonError ? " invalid" : ""}`}>
            <label htmlFor="rf-lesson">
              Lesson learned <span className="req">*</span>
            </label>
            <textarea
              id="rf-lesson"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              placeholder="What will you repeat or change next time?"
              aria-invalid={lessonError ? true : undefined}
              aria-describedby="rf-lesson-note"
            />
            {lessonError && (
              <span className="err" id="rf-lesson-note" role="alert">
                {lessonError}
              </span>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save review"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
