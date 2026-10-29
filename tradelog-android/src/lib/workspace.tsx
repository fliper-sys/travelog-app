import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { filterRange, type RangeKey } from '@/core/analytics';
import { todayLocal } from '@/core/format';
import type { Identity } from '@/core/offline/types';
import type { Trade } from '@/core/types';
import { C, R, S } from '@/constants/theme';
import { useSession } from './session';
import { supabase } from './supabase';
import { useTradeData, type TradeData } from './use-trade-data';

export const RANGE_LABEL: Record<RangeKey, string> = {
  '7': '7 days',
  '30': '30 days',
  '90': '90 days',
  all: 'All time',
};

interface ToastState {
  message: string;
  action?: { label: string; run: () => void };
}

interface WorkspaceValue {
  identity: Identity;
  data: TradeData;
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  /** Trades inside the selected date range. */
  ranged: Trade[];
  toast: (message: string, action?: ToastState['action']) => void;
  signOut: () => Promise<void>;
  reauth: () => Promise<void>;
}

const Ctx = createContext<WorkspaceValue | null>(null);

export function useWorkspace(): WorkspaceValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return v;
}

/** Everything the signed-in screens share: trade data, the date range, toasts, sign-out. */
export function WorkspaceProvider({ identity, children }: { identity: Identity; children: ReactNode }) {
  const { signedOut, reauth } = useSession();
  // supabase is non-null here: the signed-in routes only exist when it is configured.
  const data = useTradeData(supabase!, identity);
  const [range, setRange] = useState<RangeKey>('30');
  const [toastState, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ranged = useMemo(() => filterRange(data.trades, range, todayLocal()), [data.trades, range]);

  const toast = useCallback((message: string, action?: ToastState['action']) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, action });
    timer.current = setTimeout(() => setToast(null), action ? 6000 : 3000);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const signOut = useCallback(async () => {
    const left = await data.flushAndCountPending();
    const lines: string[] = [];
    if (left > 0) {
      lines.push(`${left} change${left === 1 ? ' has' : 's have'} not reached the server and will be lost if you sign out.`);
    }
    if (!data.online) lines.push('You are offline, so you will not be able to sign back in until you are online again.');
    lines.push('Signing out removes your trades from this phone (they stay on the server).');

    Alert.alert('Sign out?', lines.join('\n\n'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            await data.wipe();
            await signedOut();
          })(),
      },
    ]);
  }, [data, signedOut]);

  const value = useMemo(
    () => ({ identity, data, range, setRange, ranged, toast, signOut, reauth }),
    [identity, data, range, ranged, toast, signOut, reauth],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Toast state={toastState} onClose={() => setToast(null)} />
    </Ctx.Provider>
  );
}

function Toast({ state, onClose }: { state: ToastState | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  if (!state) return null;
  return (
    <View pointerEvents="box-none" style={[st.wrap, { bottom: insets.bottom + 90 }]}>
      <View style={st.toast} accessibilityLiveRegion="polite">
        <Text style={st.text}>{state.message}</Text>
        {state.action && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              state.action?.run();
              onClose();
            }}>
            <Text style={st.action}>{state.action.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: S.lg, right: S.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.lg,
    backgroundColor: C.panel2,
    borderColor: C.line2,
    borderWidth: 1,
    borderRadius: R.field,
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
  },
  text: { color: C.text, fontSize: 14, flexShrink: 1 },
  action: { color: C.mint, fontWeight: '800', fontSize: 14 },
});
