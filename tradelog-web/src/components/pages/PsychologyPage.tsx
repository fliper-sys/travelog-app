"use client";

import { useMemo } from "react";
import { emotionGroups, insights } from "@/lib/analytics";
import { EMOTION_COLOR } from "@/lib/constants";
import { fmtR, fmtSigned, tone } from "@/lib/format";
import Donut from "../Donut";
import type { PageProps } from "./shared";

const INSIGHT_COLOR = {
  mint: undefined,
  coral: "var(--coral)",
  amber: "var(--amber)",
  blue: "var(--blue)",
} as const;

export default function PsychologyPage({ ranged }: PageProps) {
  const groups = useMemo(() => emotionGroups(ranged), [ranged]);
  const notes = useMemo(() => insights(ranged), [ranged]);
  const total = groups.reduce((s, g) => s + g.trades, 0);

  return (
    <>
      <div className="grid layout2">
        <div className="card">
          <h2>Emotional state</h2>
          {total === 0 ? (
            <div className="empty">Review a few trades and log how you felt to see this chart.</div>
          ) : (
            <div className="donut-row">
              <Donut
                segments={groups.map((g) => ({ value: g.trades, color: EMOTION_COLOR[g.emotion] }))}
                center={total}
                label="Trades"
              />
              <div>
                {groups.map((g) => (
                  <div key={g.emotion} style={{ margin: "8px 0" }}>
                    <div className="strong">
                      <span className="dotc" style={{ background: EMOTION_COLOR[g.emotion] }} />
                      {g.emotion}
                    </div>
                    <div className="small">
                      {g.trades} trades · {Math.round((g.trades / total) * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Key insights</h2>
          {notes.length === 0 ? (
            <div className="empty">Review a few more trades to unlock insights.</div>
          ) : (
            notes.map((n) => (
              <div className="queue-item" key={n.title + n.detail}>
                <span className="pair-icon" style={INSIGHT_COLOR[n.tone] ? { color: INSIGHT_COLOR[n.tone] } : undefined}>
                  {n.icon}
                </span>
                <div>
                  <div className="strong">{n.title}</div>
                  <div className="small">{n.detail}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card gap">
        <h2>Results by emotional state</h2>
        {groups.map((g) => (
          <div className="queue-item" key={g.emotion}>
            <span className="dotc" style={{ background: EMOTION_COLOR[g.emotion], margin: "0 4px" }} />
            <div className="grow">
              <div className="strong">{g.emotion}</div>
              <div className="small">
                {g.trades} trades · avg {fmtR(g.avgR, 2)} · {Math.round((g.winRate ?? 0) * 100)}% win
              </div>
            </div>
            <div className={tone(g.netPnl)}>{g.trades ? fmtSigned(g.netPnl) : "—"}</div>
          </div>
        ))}
      </div>
    </>
  );
}
