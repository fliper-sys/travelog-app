"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/analytics";

const MINT = "#21e0b0";
const GRID = "#19364d";
const MUTED = "#8ca8bf";

interface Props {
  data: TrendPoint[];
  /** Formats axis ticks and the tooltip value, e.g. fmtShort or fmtR. */
  format: (value: number) => string;
  name: string;
  ariaLabel: string;
  gradientId: string;
}

export default function TrendChart({ data, format, name, ariaLabel, gradientId }: Props) {
  if (data.length < 2) {
    return (
      <div className="empty">
        Add at least two closed trades in this range to see the chart.
      </div>
    );
  }

  return (
    <div className="chart" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={MINT} stopOpacity={0.28} />
              <stop offset="100%" stopColor={MINT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            stroke={MUTED}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            interval="preserveStartEnd"
            minTickGap={36}
          />
          <YAxis
            stroke={MUTED}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={62}
            tickFormatter={(v) => format(Number(v))}
          />
          <ReferenceLine y={0} stroke="#3b6280" strokeDasharray="4 4" />
          <Tooltip
            contentStyle={{
              background: "#06131f",
              border: "1px solid #21425d",
              borderRadius: 8,
              color: "#e7f3ff",
              fontSize: 12,
            }}
            labelStyle={{ color: MUTED }}
            formatter={(value) => [format(Number(value)), name]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={MINT}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, fill: MINT, stroke: "#061321", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
