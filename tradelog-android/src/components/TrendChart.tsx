import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import type { TrendPoint } from '@/core/analytics';
import { C } from '@/constants/theme';
import { Empty, Small } from './ui';

const H = 170;
const PAD = { l: 8, r: 8, t: 12, b: 12 };

/** A filled line chart (equity curve, cumulative R). */
export function TrendChart({
  data,
  format,
  label,
  color = C.mint,
}: {
  data: TrendPoint[];
  format: (v: number) => string;
  label: string;
  color?: string;
}) {
  const [w, setW] = useState(0);

  if (data.length === 0) return <Empty>No closed trades in this range yet.</Empty>;

  const values = data.map((d) => d.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const iw = Math.max(1, w - PAD.l - PAD.r);
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.t + (1 - (v - min) / span) * ih;

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)} ${y(min).toFixed(1)} L${x(0).toFixed(1)} ${y(min).toFixed(1)} Z`;
  const last = data[data.length - 1];

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`${label}, ${data.length} points, ending at ${format(last.value)}`}>
      {w > 0 && (
        <Svg width={w} height={H}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.35} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Line x1={PAD.l} x2={w - PAD.r} y1={y(0)} y2={y(0)} stroke={C.line2} strokeDasharray="4 4" />
          <Path d={area} fill="url(#fill)" />
          <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Small>{data[0].label}</Small>
        <Text style={{ color, fontWeight: '800', fontSize: 13 }}>{format(last.value)}</Text>
        <Small>{last.label}</Small>
      </View>
    </View>
  );
}
