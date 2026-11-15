import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SERVER_ENABLED } from '@/lib/supabase';
import { askTutor, useAccount, type ChatTurn } from '@/store/account';
import { BuryatKeysBar, insertAt } from '@/ui/BuryatKeysBar';
import { CharacterFace } from '@/ui/Character';
import { Button, Row, Screen, T } from '@/ui/components';
import { fonts, radius, space, useTheme } from '@/ui/theme';

// ИИ-собеседник: свободный разговор на бурятском с поправками. Ответы генерирует модель —
// они могут быть неточными, поэтому экран это прямо говорит.

const FIRST: ChatTurn = { role: 'assistant', content: 'Сайн байна! Хэр байнаш?\n(Здравствуйте! Как дела?)' };

export default function ChatScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const session = useAccount((s) => s.session);
  const [turns, setTurns] = useState<ChatTurn[]>([FIRST]);
  const [text, setText] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/practice'));

  if (!SERVER_ENABLED || !session) {
    return (
      <Screen>
        <T v="title">ИИ-собеседник</T>
        <T muted>{SERVER_ENABLED ? 'Чтобы поговорить, войдите в аккаунт: так мы ограничиваем расходы на модель.' : 'Сервер для этой сборки не настроен.'}</T>
        {SERVER_ENABLED && <Button title="Войти" onPress={() => router.push('/account')} />}
        <Button kind="ghost" title="Назад" onPress={back} />
      </Screen>
    );
  }

  const send = async () => {
    const content = text.trim();
    if (!content || busy) return;
    // Первая реплика — приветствие приложения; модели история передаётся с первого сообщения ученика.
    const next = [...turns, { role: 'user' as const, content }];
    setTurns(next);
    setText('');
    setBusy(true);
    const res = await askTutor(next.slice(1));
    setBusy(false);
    if ('error' in res) return setNote(res.error);
    setTurns([...next, { role: 'assistant', content: res.reply }]);
    setNote(res.left !== undefined && res.left <= 5 ? `Сегодня осталось сообщений: ${res.left}` : null);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Row style={[styles.header, { borderColor: c.border }]} gap={space.md}>
          <CharacterFace id="seseg" />
          <View style={{ flex: 1 }}>
            <T v="label">Сэсэг · ИИ-собеседник</T>
            <T v="caption" muted>
              Ответы пишет ИИ и может ошибаться
            </T>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={back} hitSlop={12}>
            <T muted>✕</T>
          </Pressable>
        </Row>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.sm }}>
          {turns.map((t, i) => (
            <View key={i} style={[styles.bubble, t.role === 'user' ? { alignSelf: 'flex-end', backgroundColor: c.surfaceAlt } : { alignSelf: 'flex-start', backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }]}>
              <T selectable>{t.content}</T>
            </View>
          ))}
          {busy && <T muted>Сэсэг печатает…</T>}
          {note && <T color={c.warning}>{note}</T>}
        </ScrollView>
        <View style={[styles.footer, { borderColor: c.border }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            selection={selection}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            inputAccessoryViewID="chat-input"
            placeholder="Напишите по-бурятски"
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={600}
            accessibilityLabel="Сообщение"
            style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
          />
          <BuryatKeysBar
            nativeID="chat-input"
            onKey={(ch) => {
              const r = insertAt(text, selection, ch);
              setText(r.value);
              setSelection({ start: r.cursor, end: r.cursor });
            }}
          />
          <Button title="Отправить" onPress={() => void send()} disabled={!text.trim() || busy} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', padding: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, paddingVertical: space.sm, paddingHorizontal: space.md },
  footer: { padding: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  input: { minHeight: 44, maxHeight: 120, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 16, fontFamily: fonts.regular },
});
