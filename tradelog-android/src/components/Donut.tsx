import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { C } from '@/constants/theme';

const SIZE = 120;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function Donut({
  segments,
  center,
  label,
}: {
  segments: { value: number; color: string }[];
  center: number | string;
  label: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let offset = 0;

  return (
    <View style={{ width: SIZE, height: SIZE }} accessible accessibilityLabel={`${label}: ${center}`}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={C.line} strokeWidth={STROKE} fill="none" />
        {total > 0 &&
          segments.map((s, i) => {
            if (s.value <= 0) return null;
            const len = (s.value / total) * CIRC;
            const el = (
              <Circle
                key={i}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={s.color}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${len} ${CIRC - len}`}
                strokeDashoffset={-offset}
                rotation={-90}
                origin={`${SIZE / 2}, ${SIZE / 2}`}
              />
            );
            offset += len;
            return el;
          })}
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.text, fontSize: 24, fontWeight: '800' }}>{center}</Text>
        <Text style={{ color: C.muted, fontSize: 11 }}>{label}</Text>
      </View>
    </View>
  );
}
