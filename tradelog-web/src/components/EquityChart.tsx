"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/lib/analytics";
import { fmtMoney } from "@/lib/format";

const MINT = "#4ee3b0";
const GRID = "#2b323a";
const MUTED = "#8b95a0";

export default function EquityChart({ data }: { data: EquityPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="empty">
        Add closed trades with a P&amp;L to see your equity curve.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={MINT} stopOpacity={0.35} />
              <stop offset="100%" stopColor={MINT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke={MUTED} tickLine={false} axisLine={false} fontSize={12} />
          <YAxis stroke={MUTED} tickLine={false} axisLine={false} fontSize={12} width={56} />
          <Tooltip
            contentStyle={{
              background: "#20262c",
              border: "1px solid #2b323a",
              borderRadius: 10,
              color: "#e8ecef",
            }}
            labelStyle={{ color: MUTED }}
            formatter={(value) => [fmtMoney(Number(value)), "Equity"]}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={MINT}
            strokeWidth={2}
            fill="url(#equityFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
