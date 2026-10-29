import * as SecureStore from 'expo-secure-store';

import type { Identity } from '@/core/offline/types';

const KEY = 'tradelog.last-user';

/**
 * Who was signed in last. With it the app can open offline, straight into the
 * data already on the phone, even when the sign-in token cannot be renewed.
 */
export async function readLastUser(): Promise<Identity | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const value = raw ? (JSON.parse(raw) as Identity) : null;
    return value && typeof value.id === 'string' ? value : null;
  } catch {
    return null;
  }
}

export async function rememberUser(identity: Identity): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(identity));
  } catch {
    // The app just will not remember who you are for an offline start.
  }
}

export async function forgetUser(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
