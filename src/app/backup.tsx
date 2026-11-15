import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, StyleSheet, TextInput, View } from 'react-native';

import { dateKey } from '@/lib/dates';
import { chooseBackup, downloadBackup } from '@/lib/backup-web';
import { useAppStore } from '@/store/app-store';
import { exportProgress, mergeProgress, parseProgressFile } from '@/store/merge';
import { Button, Card, Screen, T } from '@/ui/components';
import { fonts, radius, space, useTheme } from '@/ui/theme';

// Перенос прогресса без аккаунта: выгрузить текстом (поделиться / скопировать) и загрузить на другом
// устройстве. Загрузка не заменяет, а объединяет: сделанное на обоих устройствах сохраняется.

export default function BackupScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const share = async () => {
    const data = exportProgress(useAppStore.getState().progress);
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(data);
        setMessage({ ok: true, text: 'Прогресс скопирован. Вставьте его на другом устройстве в поле ниже.' });
      } catch {
        setText(data);
        setMessage({ ok: true, text: 'Скопируйте текст из поля ниже вручную.' });
      }
      return;
    }
    await Share.share({ message: data, title: 'Прогресс: бурятский язык' });
  };

  const load = (data: string) => {
    const parsed = parseProgressFile(data);
    if ('error' in parsed) return setMessage({ ok: false, text: parsed.error });
    useAppStore.setState((s) => ({ progress: mergeProgress(s.progress, parsed.progress, dateKey()) }));
    setText('');
    setMessage({ ok: true, text: 'Готово: прогресс объединён с этим устройством.' });
  };

  const download = () => {
    try {
      downloadBackup(exportProgress(useAppStore.getState().progress), dateKey());
      setMessage({ ok: true, text: 'Файл прогресса подготовлен для скачивания.' });
    } catch { setMessage({ ok: false, text: 'Не удалось скачать файл. Скопируйте прогресс текстом.' }); }
  };
  const upload = async () => {
    try { const data = await chooseBackup(); if (data !== null) load(data); }
    catch (e) { setMessage({ ok: false, text: e instanceof Error ? e.message : 'Не удалось прочитать файл.' }); }
  };

  return (
    <Screen scroll>
      <T v="title">Перенос прогресса</T>
      <T muted>Без аккаунта: выгрузите прогресс на одном устройстве и загрузите на другом. Загрузка объединяет прогресс — ничего не теряется.</T>
      <Card>
        <T v="label">1. Выгрузить</T>
        <T v="caption" muted>
          Текст с XP, пройденными уроками и карточками повторения. Сохраните его в заметках или отправьте себе.
        </T>
        {Platform.OS === 'web' && <Button title="Скачать JSON-файл" onPress={download} />}
        <Button title={Platform.OS === 'web' ? 'Скопировать прогресс' : 'Поделиться прогрессом'} onPress={() => void share()} />
      </Card>
      <Card>
        <T v="label">2. Загрузить</T>
        {Platform.OS === 'web' && <Button kind="secondary" title="Выбрать JSON-файл" onPress={() => void upload()} />}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Вставьте сюда выгруженный текст"
          placeholderTextColor={c.textMuted}
          multiline
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Текст прогресса"
          style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
        />
        <Button kind="secondary" title="Загрузить и объединить" onPress={() => load(text)} disabled={!text.trim()} />
      </Card>
      {message && (
        <T color={message.ok ? c.success : c.error}>
          {message.text}
        </T>
      )}
      <View style={{ marginTop: space.md }}>
        <Button kind="ghost" title="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 96, borderWidth: 1, borderRadius: radius.md, padding: space.md, fontFamily: fonts.regular, fontSize: 14, textAlignVertical: 'top' },
});
