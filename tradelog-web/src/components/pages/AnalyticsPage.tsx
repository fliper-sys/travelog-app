"use client";

import { useMemo } from "react";
import { computeStats, cumulativeR, weekdayPerformance } from "@/lib/analytics";
import { fmtPercent, fmtR, fmtShort, tone } from "@/lib/format";
import Donut from "../Donut";
import TrendChart from "../TrendChart";
import { HeadlineMetrics } from "../ui";
import type { PageProps } from "./shared";

export default function AnalyticsPage({ ranged }: PageProps) {
  const s = useMemo(() => computeStats(ranged), [ranged]);
  const rCurve = useMemo(() => cumulativeR(ranged), [ranged]);
  const weekdays = useMemo(() => weekdayPerformance(ranged), [ranged]);

  const share = (n: number) => (s.scored ? fmtPercent(n / s.scored) : "0%");
  const maxAbs = Math.max(1, ...weekdays.map((w) => Math.abs(w.pnl)));
  const lastR = rCurve.length ? rCurve[rCurve.length - 1].value : 0;

  const minis: { label: string; value: string; cls?: string }[] = [
    { label: "Average win", value: s.avgWin == null ? "—" : fmtShort(s.avgWin), cls: "positive" },
    { label: "Average loss", value: s.avgLoss == null ? "—" : fmtShort(s.avgLoss), cls: "negative" },
    { label: "Best trade", value: s.best == null ? "—" : fmtShort(s.best), cls: "positive" },
    { label: "Worst trade", value: s.worst == null ? "—" : fmtShort(s.worst), cls: "negative" },
    { label: "Max drawdown", value: s.scored ? `-${fmtShort(s.maxDrawdown).replace("+", "")}` : "—" },
    {
      label: "Expectancy",
      value: s.avgR == null ? "—" : `${fmtR(s.avgR, 2)} / trade`,
      cls: tone(s.avgR),
    },
  ];

  return (
    <>
      <HeadlineMetrics stats={s} />

      <div className="grid layout2">
        <div className="card">
          <div className="section-head">
            <h2>Cumulative R</h2>
            <span>Risk-adjusted progress</span>
          </div>
          <TrendChart
            data={rCurve}
            format={(v) => fmtR(v)}
            name="Cumulative R"
            gradientId="rFill"
            ariaLabel={`Cumulative R, ending at ${fmtR(lastR)}`}
          />
        </div>

        <div className="card">
          <h2>Trade outcomes</h2>
          <div className="donut-row">
            <Donut
              segments={[
                { value: s.wins, color: "#21e0b0" },
                { value: s.losses, color: "#ff6b79" },
                { value: s.breakeven, color: "#627d9a" },
              ]}
              center={s.scored}
              label="Trades"
            />
            <div>
              <div className="positive strong">● Winning trades</div>
              <p className="small" style={{ margin: "2px 0 12px" }}>
                {s.wins} trades · {share(s.wins)}
              </p>
              <div className="negative strong">● Losing trades</div>
              <p className="small" style={{ margin: `2px 0 ${s.breakeven ? 12 : 0}px` }}>
                {s.losses} trades · {share(s.losses)}
              </p>
              {s.breakeven > 0 && (
                <>
                  <div className="muted strong">● Break-even</div>
                  <p className="small" style={{ margin: "2px 0 0" }}>
                    {s.breakeven} trades
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid layout2 gap">
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Trade statistics</h2>
          <div className="minis">
            {minis.map((m) => (
              <div className="mini" key={m.label}>
                <div className="small">{m.label}</div>
                <div className={`v ${m.cls ?? ""}`}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-head">
            <h2>Performance by weekday</h2>
          </div>
          {weekdays.map((w) => (
            <div className="barrow" key={w.day}>
              <div>
                {w.day} <span className="small">· {w.trades}</span>
              </div>
              <div className={`bar ${w.pnl < 0 ? "neg" : ""}`}>
                <span style={{ width: `${(Math.abs(w.pnl) / maxAbs) * 100}%` }} />
              </div>
              <div className={tone(w.pnl)}>{fmtShort(w.pnl)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
