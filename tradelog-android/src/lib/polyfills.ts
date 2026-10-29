import * as Crypto from 'expo-crypto';

/**
 * The shared trade code calls crypto.randomUUID() / crypto.getRandomValues().
 * React Native may not provide them, so fill in whatever is missing from
 * expo-crypto. Import this file before anything that creates trades.
 */
type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
};

const g = globalThis as unknown as { crypto?: CryptoLike };
g.crypto ??= {};
g.crypto.randomUUID ??= () => Crypto.randomUUID();
g.crypto.getRandomValues ??= (array) => {
  if (array) Crypto.getRandomValues(array as unknown as Uint8Array);
  return array;
};
