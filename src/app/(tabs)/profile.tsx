import { Alert, Platform, Switch, View } from 'react-native';

import { getCourse } from '@/content/course';
import { dateKey } from '@/lib/dates';
import { useAppStore, type ThemePref } from '@/store/app-store';
import { DAILY_GOALS, streak } from '@/store/logic';
import { Button, Card, OptionButton, Row, Screen, T } from '@/ui/components';
import { days, GOAL_LABELS, words } from '@/ui/labels';
import { space, useTheme } from '@/ui/theme';

const THEMES: [ThemePref, string][] = [
  ['system', 'Как в системе'],
  ['light', 'Светлая'],
  ['dark', 'Тёмная'],
];

export default function ProfileScreen() {
  const { c } = useTheme();
  const settings = useAppStore((s) => s.settings);
  const progress = useAppStore((s) => s.progress);
  const update = useAppStore((s) => s.updateSettings);
  const reset = useAppStore((s) => s.resetProgress);
  const { content } = getCourse();
  const totalXp = Object.values(progress.xpByDate).reduce((a, b) => a + b, 0);
  const unverified = content.words.filter((w) => !w.verified && !w.excluded).length;

  const confirmReset = () => {
    const msg = 'Удалить весь прогресс: XP, серию, пройденные уроки и карточки повторения? Настройки сохранятся.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(msg)) reset();
      return;
    }
    Alert.alert('Сбросить прогресс?', msg, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Сбросить', style: 'destructive', onPress: reset },
    ]);
  };

  return (
    <Screen scroll>
      <T v="title">Профиль</T>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>Всего XP</T>
          <T v="label">{totalXp}</T>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>Серия</T>
          <T v="label">{days(streak(progress, settings.dailyGoal, dateKey()))}</T>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>В повторении</T>
          <T v="label">{words(Object.keys(progress.cards).length)}</T>
        </Row>
      </Card>

      <View style={{ gap: space.sm }}>
        <T v="heading">Цель на день</T>
        {DAILY_GOALS.map((g) => (
          <OptionButton key={g} label={GOAL_LABELS[g]} state={settings.dailyGoal === g ? 'selected' : 'idle'} onPress={() => update({ dailyGoal: g })} />
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <T v="heading">Тема</T>
        <Row gap={space.sm}>
          {THEMES.map(([value, label]) => (
            <View key={value} style={{ flex: 1 }}>
              <OptionButton label={label} state={settings.theme === value ? 'selected' : 'idle'} onPress={() => update({ theme: value })} />
            </View>
          ))}
        </Row>
      </View>

      <Card>
        <SettingSwitch label="Сердечки" hint="5 в день; ошибка в уроке отнимает одно. Повторение без ограничений." value={settings.heartsEnabled} onChange={(v) => update({ heartsEnabled: v })} />
        <SettingSwitch
          label="Показывать непроверенное"
          hint={`Пометка на единицах, которые ещё не сверил носитель (сейчас таких слов: ${unverified}).${__DEV__ ? ' В режиме разработки пометки видны всегда.' : ''}`}
          value={settings.showUnverified}
          onChange={(v) => update({ showUnverified: v })}
        />
      </Card>

      <Card>
        <T v="label">Источники</T>
        <T v="caption" muted>
          «Учебник бурятского языка» (уроки 1–4 и введение); справочно — «Грамматика бурятского языка. Фонетика и морфология» (1962). Лицензия источников не подтверждена — только личное использование. Все слова и переводы ждут сверки с носителем языка.
        </T>
      </Card>

      <Button kind="danger" title="Сбросить прогресс" onPress={confirmReset} />
      <T v="caption" color={c.textMuted}>
        Данные хранятся только на этом устройстве.
      </T>
    </Screen>
  );
}

function SettingSwitch({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }} gap={space.md}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="label">{label}</T>
        <T v="caption" muted>
          {hint}
        </T>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </Row>
  );
}
