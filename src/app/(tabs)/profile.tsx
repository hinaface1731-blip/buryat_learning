import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { getCourse } from '@/content/course';
import { dateKey } from '@/lib/dates';
import { achievementsOf, totalXp, type Achievement } from '@/store/achievements';
import { useAppStore, type ThemePref } from '@/store/app-store';
import { DAILY_GOALS, streak } from '@/store/logic';
import { useSessionStore } from '@/store/session-store';
import { ART } from '@/ui/art';
import { Avatar, AVATAR_IDS, avatarLabel } from '@/ui/Avatar';
import { Button, Card, OptionButton, ProgressBar, Row, Screen, T } from '@/ui/components';
import { GOAL_LABELS } from '@/ui/labels';
import { fonts, space, useTheme } from '@/ui/theme';

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
  const resetProgress = useAppStore((s) => s.resetProgress);
  const clearSessions = useSessionStore((s) => s.clearAll);
  const reset = () => {
    clearSessions();
    resetProgress();
  };
  const { content } = getCourse();
  const unverified = content.words.filter((w) => !w.verified && !w.excluded).length;
  const achievements = achievementsOf(progress, content.course.units);
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const [picking, setPicking] = useState(false);
  const since = Object.keys(progress.xpByDate).sort()[0];
  const stats = [
    { label: 'Дней подряд', value: String(streak(progress, settings.dailyGoal, dateKey())), art: 'badge-flame' },
    { label: 'Всего XP', value: String(totalXp(progress)), art: 'badge-numbers' },
    { label: 'Уроков', value: String(Object.keys(progress.completedLessons).length), art: 'badge-journey' },
    { label: 'В повторении', value: String(Object.keys(progress.cards).length), art: 'mascot-book' },
  ];

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
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Аватар: ${avatarLabel(settings.avatar)}. Изменить`} accessibilityState={{ expanded: picking }} onPress={() => setPicking(!picking)}>
          <Avatar id={settings.avatar} size={112} />
          <View style={[styles.editMark, { backgroundColor: c.primary, borderColor: c.bg }]}>
            <Ionicons name="pencil" size={15} color={c.onPrimary} />
          </View>
        </Pressable>
        {picking && (
          <View style={styles.avatarGrid}>
            {AVATAR_IDS.map((id) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={avatarLabel(id)}
                accessibilityState={{ selected: settings.avatar === id }}
                onPress={() => {
                  update({ avatar: id });
                  setPicking(false);
                }}>
                <Avatar id={id} size={64} selected={settings.avatar === id} />
              </Pressable>
            ))}
          </View>
        )}
        <TextInput
          value={settings.name}
          onChangeText={(name) => update({ name })}
          placeholder="Ваше имя"
          placeholderTextColor={c.textMuted}
          maxLength={24}
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel="Имя"
          style={[styles.nameInput, { color: c.text, borderColor: c.border }]}
        />
        {since && (
          <T v="caption" muted>
            Учит бурятский с {monthYear(since)}
          </T>
        )}
      </View>

      <View style={styles.statGrid}>
        {stats.map((s) => (
          <Card key={s.label} style={styles.stat}>
            <Image source={ART[s.art]} style={{ width: 36, height: 36 }} contentFit="contain" loading="eager" accessible={false} />
            <View style={{ flex: 1 }}>
              <T v="heading">{s.value}</T>
              <T v="caption" muted numberOfLines={1}>
                {s.label}
              </T>
            </View>
          </Card>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="heading">Достижения</T>
          <T v="label" muted>
            {unlocked} из {achievements.length}
          </T>
        </Row>
        <View style={styles.achievementGrid}>
          {achievements.map((a) => (
            <AchievementTile key={a.id} achievement={a} />
          ))}
        </View>
      </View>

      <T v="title" style={{ marginTop: space.md }}>
        Настройки
      </T>
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
        <SettingSwitch label="Звуки" hint="Верный и неверный ответ, конец урока, награды." value={settings.sound} onChange={(v) => update({ sound: v })} />
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
          «Учебник бурятского языка» (уроки 1–4 и введение), разговорник Burlang.Zugaa, часть фраз — машинный перевод; справочно — «Грамматика бурятского языка. Фонетика и морфология» (1962). Лицензия источников не подтверждена. Все слова и фразы ждут сверки с носителем языка.
        </T>
      </Card>

      <Button kind="danger" title="Сбросить прогресс" onPress={confirmReset} />
      <T v="caption" color={c.textMuted}>
        Данные хранятся только на этом устройстве.
      </T>
    </Screen>
  );
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function monthYear(day: string): string {
  const [year, month] = day.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

function AchievementTile({ achievement: a }: { achievement: Achievement }) {
  const { c } = useTheme();
  return (
    <View style={styles.achievement} accessible accessibilityLabel={`${a.title}. ${a.unlocked ? 'Получено' : `${a.hint}. ${a.value} из ${a.target}`}`}>
      <View style={{ opacity: a.unlocked ? 1 : 0.28 }}>
        <Image source={ART[a.art]} style={{ width: 64, height: 64 }} contentFit="contain" loading="eager" accessible={false} />
      </View>
      <T v="caption" color={a.unlocked ? c.text : c.textMuted} style={{ textAlign: 'center', fontFamily: fonts.medium }} numberOfLines={2}>
        {a.title}
      </T>
      {!a.unlocked &&
        (a.target > 1 ? (
          <View style={{ alignSelf: 'stretch', flexDirection: 'row' }}>
            <ProgressBar value={a.value / a.target} color={c.accent} />
          </View>
        ) : (
          <T v="caption" muted style={{ textAlign: 'center', fontSize: 11, lineHeight: 14 }} numberOfLines={2}>
            {a.hint}
          </T>
        ))}
    </View>
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

const styles = StyleSheet.create({
  editMark: { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md, paddingVertical: space.sm },
  nameInput: { alignSelf: 'stretch', textAlign: 'center', fontFamily: fonts.bold, fontSize: 22, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', padding: space.md },
  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  achievement: { width: '33.33%', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs },
});
