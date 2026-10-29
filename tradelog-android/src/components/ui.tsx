import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, R, S } from '@/constants/theme';

/** A scrolling page with the standard background and padding. */
export function Screen({
  children,
  scroll = true,
  footer,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  edges?: ('top' | 'bottom')[];
}) {
  return (
    <SafeAreaView style={s.screen} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={s.scroll}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}

export function Header({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={s.title} accessibilityRole="header">
          {title}
        </Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function H2({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.h2row}>
      <Text style={s.h2} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function T({
  children,
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[s.body, color ? { color } : null, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export const Small = ({ children, color }: { children: ReactNode; color?: string }) => (
  <Text style={[s.small, color ? { color } : null]}>{children}</Text>
);

export const Strong = ({ children, color }: { children: ReactNode; color?: string }) => (
  <Text style={[s.body, s.strong, color ? { color } : null]}>{children}</Text>
);

export function Button({
  label,
  onPress,
  kind = 'default',
  small,
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'default' | 'primary' | 'danger' | 'ghost';
  small?: boolean;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={onPress}
      disabled={off}
      android_ripple={{ color: '#ffffff22' }}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        kind === 'primary' && s.btnPrimary,
        kind === 'danger' && s.btnDanger,
        kind === 'ghost' && s.btnGhost,
        pressed && { opacity: 0.8 },
        off && { opacity: 0.5 },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={kind === 'primary' ? C.onMint : C.text} />
      ) : (
        <Text style={[s.btnText, kind === 'primary' && { color: C.onMint }, kind === 'danger' && { color: C.coral }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** A row of mutually exclusive options. */
export function Segmented<V extends string | number>({
  options,
  value,
  onChange,
  label,
  tint,
}: {
  options: { value: V; label: string; tint?: string }[];
  value: V;
  onChange: (v: V) => void;
  label?: string;
  tint?: string;
}) {
  return (
    <View style={s.seg} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        const color = o.tint ?? tint ?? C.mint;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[s.segItem, on && { backgroundColor: color + '24', borderColor: color }]}>
            <Text style={[s.segText, on && { color }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Wrapping chips (for pickers with many options). */
export function Chips<V extends string>({
  options,
  value,
  onChange,
  tints,
}: {
  options: readonly V[];
  value: V | '';
  onChange: (v: V) => void;
  tints?: Partial<Record<V, string>>;
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = o === value;
        const color = tints?.[o] ?? C.mint;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o)}
            style={[s.chip, on && { backgroundColor: color + '24', borderColor: color }]}>
            <Text style={[s.chipText, on && { color }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label}
        {required ? <Text style={{ color: C.coral }}> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text style={s.err} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={s.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Input({ invalid, style, ...rest }: TextInputProps & { invalid?: boolean }) {
  return (
    <TextInput
      placeholderTextColor="#5d7891"
      selectionColor={C.mint}
      style={[s.input, invalid && { borderColor: C.coral }, rest.multiline && s.multiline, style]}
      {...rest}
    />
  );
}

export function Stat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.small}>{label}</Text>
      <Text style={[s.statValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={s.small}>{sub}</Text> : null}
    </View>
  );
}

export function Tag({ label, color = C.mint }: { label: string; color?: string }) {
  return (
    <View style={[s.tag, { borderColor: color + '88', backgroundColor: color + '18' }]}>
      <Text style={[s.tagText, { color }]}>{label}</Text>
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <Text style={s.empty}>{children}</Text>;
}

export function Banner({ children, kind = 'info' }: { children: ReactNode; kind?: 'info' | 'warn' | 'error' }) {
  const color = kind === 'error' ? C.coral : kind === 'warn' ? C.amber : C.blue;
  return (
    <View style={[s.banner, { borderColor: color + '77', backgroundColor: color + '14' }]} accessibilityRole="alert">
      <Text style={[s.body, { color }]}>{children}</Text>
    </View>
  );
}

export const Row = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: S.sm }, style]}>{children}</View>
);

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.lg, paddingBottom: 120, gap: S.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.xs },
  title: { color: C.text, fontSize: 26, fontWeight: '800' },
  sub: { color: C.muted, fontSize: 14, marginTop: 2 },
  card: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: R.card,
    padding: S.lg,
    gap: S.sm,
  },
  h2row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm },
  h2: { color: C.text, fontSize: 17, fontWeight: '700' },
  body: { color: C.text, fontSize: 14, lineHeight: 20 },
  strong: { fontWeight: '700' },
  small: { color: C.muted, fontSize: 12.5, lineHeight: 17 },
  btn: {
    minHeight: 46,
    paddingHorizontal: S.lg,
    borderRadius: R.field,
    backgroundColor: C.panel2,
    borderColor: C.line2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { minHeight: 38, paddingHorizontal: S.md },
  btnPrimary: { backgroundColor: C.mint, borderColor: C.mint },
  btnDanger: { backgroundColor: 'transparent', borderColor: C.coral + '88' },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { color: C.text, fontWeight: '700', fontSize: 14 },
  seg: { flexDirection: 'row', gap: S.sm },
  segItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.field,
    borderWidth: 1,
    borderColor: C.line2,
    backgroundColor: C.field,
    paddingHorizontal: S.sm,
  },
  segText: { color: C.muted, fontWeight: '700', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: {
    minHeight: 38,
    paddingHorizontal: S.md,
    justifyContent: 'center',
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.line2,
    backgroundColor: C.field,
  },
  chipText: { color: C.muted, fontWeight: '600', fontSize: 13 },
  field: { gap: 6 },
  label: { color: C.muted, fontSize: 12.5, fontWeight: '600' },
  err: { color: C.coral, fontSize: 12.5 },
  hint: { color: C.muted, fontSize: 12 },
  input: {
    minHeight: 48,
    borderRadius: R.field,
    borderWidth: 1,
    borderColor: C.line2,
    backgroundColor: C.field,
    color: C.text,
    paddingHorizontal: S.md,
    fontSize: 15,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: S.md },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: R.card,
    padding: S.md,
    gap: 2,
  },
  statValue: { color: C.text, fontSize: 22, fontWeight: '800' },
  tag: { borderWidth: 1, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  empty: { color: C.muted, textAlign: 'center', paddingVertical: S.xl, fontSize: 14 },
  banner: { borderWidth: 1, borderRadius: R.field, padding: S.md },
});
