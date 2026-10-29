import { Card, H2, Screen, T } from '@/components/ui';

/** Shown when the Supabase address and key have not been added yet. */
export default function Setup() {
  return (
    <Screen>
      <Card style={{ marginTop: 48 }}>
        <H2>Connect Supabase</H2>
        <T>
          Create a file named <T color="#21e0b0">.env</T> next to package.json with your project URL and publishable
          key (see .env.example), then restart with <T color="#21e0b0">npx expo start -c</T>.
        </T>
      </Card>
    </Screen>
  );
}
