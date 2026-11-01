import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { getCourse } from '@/content/course';
import type { LastResult } from '@/store/last-result';
import { useLastResult } from '@/store/last-result';
import { MASTERY_THRESHOLD } from '@/store/logic';
import { Button, Card, Row, Screen, T } from '@/ui/components';
import { Mascot } from '@/ui/Mascot';
import { space, useTheme } from '@/ui/theme';

function headline(r: LastResult): { title: string; note?: string } {
  const threshold = Math.round(MASTERY_THRESHOLD * 100);
  if (r.outOfHearts) return { title: 'Сердечки закончились', note: 'Урок не засчитан. Сердечки восстановятся завтра; повторять можно без ограничений.' };
  if (r.practice) return { title: 'Практика завершена', note: 'Урок не засчитан, но слова уже в повторении.' };
  if (r.kind === 'review') return { title: 'Повторение завершено' };
  if (r.mastered) return { title: r.skill ? `Теперь вы умеете ${r.skill}` : 'Урок освоен' };
  return { title: 'Занятие завершено', note: r.skill ? `Ещё немного — и вы уверенно сможете ${r.skill}. Следующий урок открыт, а короткое повторение ошибок закрепит этот.` : `Следующий урок открыт, но этот пока не закреплён: точность ниже ${threshold}%. Короткое повторение ошибок поможет.` };
}

export default function ResultScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const result = useLastResult((s) => s.result);
  const { pools, content } = getCourse();

  if (!result) {
    return (
      <Screen>
        <Button title="На главную" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  const mistakes = result.mistakes.map((id) => {
    const item = pools.itemById.get(id);
    if (item) return { id, buryat: item.buryat, russian: item.russian };
    const s = content.sentenceById.get(id);
    return { id, buryat: s?.buryat ?? id, russian: s?.translation ?? '' };
  });
  const { title, note } = headline(result);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={{ gap: space.xs, marginTop: space.lg }}>
        <Mascot mood={result.mastered && !result.outOfHearts ? 'happy' : 'support'} size={132} />
        <T v="title">{title}</T>
        <T muted>{result.title}</T>
      </View>
      <Row gap={space.md}>
        <Card style={{ flex: 1 }}>
          <T v="caption" muted>
            Точность
          </T>
          <T v="title">{Math.round(result.accuracy * 100)}%</T>
        </Card>
        <Card style={{ flex: 1 }}>
          <T v="caption" muted>
            Опыт
          </T>
          <T v="title" color={c.accent}>
            +{result.xp} XP
          </T>
        </Card>
      </Row>
      {note && <T muted>{note}</T>}
      {mistakes.length > 0 ? (
        <Card>
          <T v="label">Ошибки — уже добавлены в «Повторение»</T>
          {mistakes.map((m) => (
            <Row key={m.id} style={{ justifyContent: 'space-between' }}>
              <T v="buryat">{m.buryat}</T>
              <T muted>{m.russian}</T>
            </Row>
          ))}
        </Card>
      ) : (
        <T muted>Без ошибок.</T>
      )}
      {mistakes.length > 0 && !result.mastered && <Button title="Закрепить ошибки" onPress={() => router.replace('/review-session')} />}
      <Button kind={mistakes.length > 0 && !result.mastered ? 'secondary' : 'primary'} title="Дальше" onPress={() => router.replace('/')} />
    </Screen>
  );
}
