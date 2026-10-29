import { View } from 'react-native';

import { S } from '@/constants/theme';
import { useWorkspace } from '@/lib/workspace';
import { SyncPill } from './SyncPill';
import { Banner, Button, Header } from './ui';

/** Page title with the sync status, plus any warning the user should see. */
export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  const { data, reauth } = useWorkspace();
  const p = data.problem;

  return (
    <View style={{ gap: S.md }}>
      <Header title={title} sub={sub} right={<SyncPill data={data} />} />
      {!data.persistent && (
        <Banner kind="warn">
          This phone could not open its local database, so data is only kept until the app closes. Keep the app open
          until everything is synced.
        </Banner>
      )}
      {p?.kind === 'auth' && (
        <Banner kind="warn">
          Your sign-in has expired. Your trades are safe on this phone; sign in again to upload them.
        </Banner>
      )}
      {p?.kind === 'auth' && <Button small label="Sign in again" onPress={() => void reauth()} />}
      {p?.kind === 'rejected' && <Banner kind="error">The server refused a change: {p.message}</Banner>}
    </View>
  );
}
