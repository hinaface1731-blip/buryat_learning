import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { SERVER_ENABLED } from '@/lib/supabase';
import { addFriend, leaderboard, myFriendCode, sendCode, signOut, syncProgress, useAccount, verifyCode, type LeaderRow } from '@/store/account';
import { Avatar } from '@/ui/Avatar';
import { Button, Card, Row, Screen, T } from '@/ui/components';
import { fonts, radius, space, useTheme } from '@/ui/theme';

// Аккаунт необязателен: он нужен для синхронизации между устройствами, друзей и ИИ-собеседника.

export default function AccountScreen() {
  const router = useRouter();
  const session = useAccount((s) => s.session);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  if (!SERVER_ENABLED) {
    return (
      <Screen>
        <T v="title">Аккаунт</T>
        <T muted>Сервер для этой сборки не настроен. Всё работает на устройстве; прогресс можно перенести через «Перенос прогресса».</T>
        <Button kind="ghost" title="Назад" onPress={back} />
      </Screen>
    );
  }
  return (
    <Screen scroll>
      <T v="title">Аккаунт</T>
      {session ? <Signed email={session.user.email ?? ''} /> : <SignIn />}
      <Button kind="ghost" title="Назад" onPress={back} />
    </Screen>
  );
}

function Field(props: { value: string; onChangeText: (v: string) => void; placeholder: string; label: string; keyboard?: 'email-address' | 'number-pad' }) {
  const { c } = useTheme();
  return (
    <TextInput
      {...props}
      accessibilityLabel={props.label}
      keyboardType={props.keyboard}
      autoCapitalize="none"
      autoCorrect={false}
      placeholderTextColor={c.textMuted}
      style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
    />
  );
}

function SignIn() {
  const { c } = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <T>Вход по коду из письма — без пароля. Зачем: прогресс на всех устройствах, друзья и недельный рейтинг, ИИ-собеседник.</T>
      <T v="caption" muted>
        На сервере хранятся адрес почты, имя, аватар и прогресс. Подробно — в разделе «Конфиденциальность» в README.
      </T>
      <Field value={email} onChangeText={setEmail} placeholder="почта@пример.ru" label="Почта" keyboard="email-address" />
      {sent && <Field value={code} onChangeText={setCode} placeholder="Код из письма" label="Код из письма" keyboard="number-pad" />}
      {error && <T color={c.error}>{error}</T>}
      {!sent ? (
        <Button title="Получить код" disabled={!email.includes('@')} onPress={async () => setError((await sendCode(email)) ?? (setSent(true), null))} />
      ) : (
        <Button title="Войти" disabled={code.trim().length < 6} onPress={async () => setError(await verifyCode(email, code))} />
      )}
    </Card>
  );
}

function Signed({ email }: { email: string }) {
  const { c } = useTheme();
  const { syncing, lastSync, error } = useAccount();
  const [code, setCode] = useState<string | null>(null);
  const [friend, setFriend] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const reload = () => void leaderboard().then(setRows);
  useEffect(() => {
    void myFriendCode().then(setCode);
    reload();
  }, []);
  return (
    <>
      <Card>
        <T v="label">{email}</T>
        <T v="caption" muted>
          {syncing ? 'Синхронизация…' : lastSync ? `Синхронизировано ${new Date(lastSync).toLocaleString('ru-RU')}` : 'Ещё не синхронизировано'}
        </T>
        {error && <T color={c.error}>{error}</T>}
        <Row gap={space.sm}>
          <View style={{ flex: 1 }}>
            <Button kind="secondary" title="Синхронизировать" onPress={() => void syncProgress().then(reload)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button kind="ghost" title="Выйти" onPress={() => void signOut()} />
          </View>
        </Row>
      </Card>
      <Card>
        <T v="label">Друзья</T>
        <T>
          Ваш код: <T style={{ fontFamily: fonts.bold, letterSpacing: 2 }}>{code ?? '…'}</T>
        </T>
        <T v="caption" muted>
          Дайте его другу — он введёт код у себя, и вы увидите друг друга в рейтинге.
        </T>
        <Field value={friend} onChangeText={setFriend} placeholder="Код друга" label="Код друга" />
        <Button
          kind="secondary"
          title="Добавить друга"
          disabled={friend.trim().length < 4}
          onPress={async () => {
            setNote(await addFriend(friend));
            setFriend('');
            reload();
          }}
        />
        {note && <T muted>{note}</T>}
      </Card>
      <Card>
        <T v="label">Рейтинг недели</T>
        {rows.length === 0 && <T muted>Пока пусто — синхронизируйтесь и добавьте друзей.</T>}
        {rows.map((r, i) => (
          <Row key={r.user_id} gap={space.md} style={[styles.row, r.me && { backgroundColor: c.surfaceAlt }]}>
            <T v="label" style={{ width: 20 }}>
              {i + 1}
            </T>
            <Avatar id={r.avatar} size={32} />
            <T style={{ flex: 1 }}>{r.name || (r.me ? 'Вы' : 'Без имени')}</T>
            <T v="label">{r.xp} XP</T>
          </Row>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16, fontFamily: fonts.regular },
  row: { alignItems: 'center', paddingVertical: space.xs, paddingHorizontal: space.xs, borderRadius: radius.md },
});
