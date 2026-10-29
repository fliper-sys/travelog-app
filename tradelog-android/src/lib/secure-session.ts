/**
 * Where the Supabase sign-in is kept.
 *
 * It goes into the Android Keystore through expo-secure-store, so the tokens are
 * encrypted at rest (the plain-SQLite option in some guides is not). A session
 * is longer than some platforms allow for one SecureStore value, so it is split
 * into small pieces and put back together on read.
 */

export interface SecureBacking {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** Supabase's storage contract (the async flavour). */
export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const CHUNK = 1500;
const MARK = 'chunks:';

/** SecureStore keys may only contain letters, digits and . - _ */
export const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export function createChunkedStorage(backing: SecureBacking, chunk = CHUNK): AuthStorage {
  const part = (key: string, i: number) => `${safeKey(key)}.${i}`;

  async function countOf(key: string): Promise<number> {
    const head = await backing.getItemAsync(safeKey(key));
    if (!head || !head.startsWith(MARK)) return 0;
    const n = Number(head.slice(MARK.length));
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  return {
    async getItem(key) {
      const head = await backing.getItemAsync(safeKey(key));
      if (head == null) return null;
      if (!head.startsWith(MARK)) return head; // stored whole
      const n = Number(head.slice(MARK.length));
      if (!Number.isInteger(n) || n < 1) return null;
      const pieces: string[] = [];
      for (let i = 0; i < n; i++) {
        const piece = await backing.getItemAsync(part(key, i));
        if (piece == null) return null; // incomplete: treat as signed out
        pieces.push(piece);
      }
      return pieces.join('');
    },

    async setItem(key, value) {
      const before = await countOf(key);
      const pieces: string[] = [];
      for (let i = 0; i < value.length; i += chunk) pieces.push(value.slice(i, i + chunk));
      if (pieces.length === 0) pieces.push('');

      // Pieces first, header last: a half-written session is never read as valid.
      for (let i = 0; i < pieces.length; i++) await backing.setItemAsync(part(key, i), pieces[i]);
      await backing.setItemAsync(safeKey(key), `${MARK}${pieces.length}`);
      for (let i = pieces.length; i < before; i++) await backing.deleteItemAsync(part(key, i));
    },

    async removeItem(key) {
      const n = await countOf(key);
      await backing.deleteItemAsync(safeKey(key));
      for (let i = 0; i < n; i++) await backing.deleteItemAsync(part(key, i));
    },
  };
}
