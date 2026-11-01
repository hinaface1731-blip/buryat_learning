import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { getCourse } from '@/content/course';
import { useLastResult } from '@/store/last-result';
import { Button, Card, Row, Screen, T } from '@/ui/components';
import { Mascot } from '@/ui/Mascot';
import { space, useTheme } from '@/ui/theme';

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

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={{ gap: space.xs, marginTop: space.lg }}>
        <Mascot mood={result.outOfHearts || result.accuracy < 0.5 ? 'support' : 'happy'} size={132} />
        <T v="title">{result.outOfHearts ? 'Сердечки закончились' : result.kind === 'lesson' ? 'Урок пройден' : 'Повторение завершено'}</T>
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
      {result.outOfHearts && <T muted>Урок не засчитан. Сердечки восстановятся завтра; повторять можно без ограничений.</T>}
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
      <Button title="Дальше" onPress={() => router.replace('/')} />
    </Screen>
  );
}
