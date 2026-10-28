interface Segment {
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  center: string | number;
  label: string;
}

/** Ring chart drawn with a conic gradient. */
export default function Donut({ segments, center, label }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const stops: string[] = [];
  let acc = 0;
  if (total > 0) {
    for (const s of segments) {
      if (s.value <= 0) continue;
      const start = (acc / total) * 100;
      acc += s.value;
      stops.push(`${s.color} ${start}% ${(acc / total) * 100}%`);
    }
  }

  return (
    <div
      className="donut"
      role="img"
      aria-label={`${center} ${label}`}
      style={{ background: `conic-gradient(${stops.join(",") || "#19344a 0 100%"})` }}
    >
      <div>
        <span>
          <b>{center}</b>
          {label}
        </span>
      </div>
    </div>
  );
}
