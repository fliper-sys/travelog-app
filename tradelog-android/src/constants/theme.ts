/** Same palette as the web app (navy, mint, coral, amber). */
export const C = {
  bg: '#061321',
  panel: '#0b1d30',
  panel2: '#10263b',
  field: '#071729',
  line: '#1a3851',
  line2: '#21425d',
  text: '#e7f3ff',
  muted: '#8ca8bf',
  mint: '#21e0b0',
  coral: '#ff6b79',
  amber: '#ffc56b',
  blue: '#5ebaff',
  violet: '#a493f0',
  onMint: '#04231b',
} as const;

export const R = { card: 15, field: 11, pill: 999 } as const;
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Colour for a signed number: green, red, or neutral. */
export function toneColor(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || value === 0) return C.text;
  return value > 0 ? C.mint : C.coral;
}
