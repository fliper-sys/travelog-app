import { useState } from 'react';
import { Share, View } from 'react-native';

import { tradesToCsv } from '@/core/csv';
import { fmtMoney } from '@/core/format';
import { PageHeader } from '@/components/PageHeader';
import { Banner, Button, Card, Field, H2, Input, Row, Screen, Small, Strong, T, Tag } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useWorkspace } from '@/lib/workspace';

export default function Settings() {
  const { data, identity, toast, signOut } = useWorkspace();
  const [balance, setBalance] = useState(String(data.startBalance));
  const [error, setError] = useState<string | null>(null);

  async function saveBalance() {
    const n = Number(balance.replace(',', '.'));
    if (!balance.trim() || !Number.isFinite(n) || n <= 0) {
      setError('Enter an amount above 0.');
      return;
    }
    setError(null);
    try {
      await data.setStartBalance(n);
      toast('Starting balance updated.');
    } catch {
      setError('Could not save. Try again.');
    }
  }

  async function exportCsv() {
    try {
      await Share.share({ title: 'tradelog-trades.csv', message: tradesToCsv(data.trades) });
    } catch {
      toast('Could not open the share sheet.');
    }
  }

  const last = data.lastSync ? new Date(data.lastSync).toLocaleString() : 'Not yet';

  return (
    <Screen>
      <PageHeader title="Settings" sub="Your workspace and account." />

      <Card>
        <Strong>{identity.email || 'Signed in'}</Strong>
        <Row>
          <Tag label={data.persistent ? 'SAVED ON THIS PHONE' : 'MEMORY ONLY'} color={data.persistent ? C.mint : C.amber} />
        </Row>
      </Card>

      <Card>
        <H2>Sync</H2>
        <Small>Everything is saved on this phone first, so the app works without a connection.</Small>
        <Row style={{ justifyContent: 'space-between' }}>
          <T>Waiting to upload</T>
          <Strong>{data.pendingCount}</Strong>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T>Last full sync</T>
          <Small>{last}</Small>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T>Connection</T>
          <Small color={data.online ? C.mint : C.amber}>{data.online ? 'Online' : 'Offline'}</Small>
        </Row>
        <Button label="Sync now" onPress={() => void data.syncNow()} busy={data.state === 'syncing'} disabled={!data.online} />
      </Card>

      <Card>
        <H2>Account</H2>
        <Field label="Starting balance ($)" error={error} hint={`Currently ${fmtMoney(data.startBalance)}`}>
          <Input value={balance} onChangeText={setBalance} keyboardType="decimal-pad" invalid={!!error} returnKeyType="done" onSubmitEditing={() => void saveBalance()} />
        </Field>
        <Button label="Save balance" onPress={() => void saveBalance()} />
      </Card>

      <Card>
        <H2>Data</H2>
        <Button label={`Export ${data.trades.length} trade${data.trades.length === 1 ? '' : 's'} (CSV)`} onPress={() => void exportCsv()} disabled={data.trades.length === 0} />
        <Small>Opens the share sheet so you can send the CSV to Drive, email or another app.</Small>
      </Card>

      <View style={{ gap: S.sm }}>
        <Banner kind="warn">Signing out removes your trades from this phone. They stay on the server.</Banner>
        <Button kind="danger" label="Sign out" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
