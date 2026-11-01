import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useAppStore } from '@/store/app-store';
import { DAILY_GOALS, type DailyGoal } from '@/store/logic';
import { Button, OptionButton, Screen, T } from '@/ui/components';
import { GOAL_LABELS } from '@/ui/labels';
import { Mascot } from '@/ui/Mascot';
import { space } from '@/ui/theme';

export default function Onboarding() {
  const router = useRouter();
  const current = useAppStore((s) => s.settings.dailyGoal);
  const update = useAppStore((s) => s.updateSettings);
  const [goal, setGoal] = useState<DailyGoal>(current);

  const start = () => {
    update({ dailyGoal: goal, onboarded: true });
    router.replace('/');
  };

  return (
    <Screen scroll>
      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <Mascot mood="explain" size={132} />
        <T v="title">Бурятский язык</T>
        <T muted>
          Курс для взрослых, которые начинают с нуля. Литературный бурятский (на основе хоринского диалекта). Короткие уроки, повторение по интервалам, без спешки.
        </T>
      </View>
      <View style={{ gap: space.sm }}>
        <T v="heading">Сколько заниматься в день?</T>
        {DAILY_GOALS.map((g) => (
          <OptionButton key={g} label={GOAL_LABELS[g]} state={goal === g ? 'selected' : 'idle'} onPress={() => setGoal(g)} />
        ))}
        <T v="caption" muted>
          Цель можно поменять в профиле.
        </T>
      </View>
      <Button title="Начать" onPress={start} />
    </Screen>
  );
}
