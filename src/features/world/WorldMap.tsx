import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ART } from '@/ui/art';
import { Button, Card, ProgressBar, Row, T } from '@/ui/components';
import { Mascot } from '@/ui/Mascot';
import { radius, space, useTheme } from '@/ui/theme';

import type { PlaceState } from './world';

// Учебный маршрут: порядок остановок не выдаётся за географическую карту.
export function WorldMap({ states, current }: { states: PlaceState[]; current: string | null }) {
  const { c } = useTheme();
  const router = useRouter();
  const total = states.reduce((sum, s) => sum + s.total, 0);
  const done = states.reduce((sum, s) => sum + s.done, 0);
  const mastered = states.reduce((sum, s) => sum + s.mastered, 0);
  return (
    <View style={styles.route}>
      <Card>
        <Row gap={space.md}>
          <Mascot mood={mastered === total && total > 0 ? 'happy' : 'wave'} size={64} />
          <View style={styles.text}>
            <T v="heading">Путешествие по Бурятии</T>
            <T v="caption" muted>От первых слов до разговора. Выберите остановку и продолжайте в своём темпе.</T>
          </View>
        </Row>
        <T v="label">Пройдено {done} из {total} · освоено {mastered}</T>
        <ProgressBar value={total ? mastered / total : 0} />
      </Card>
      {states.map(({ place, units, done, total, mastered, nextLesson }, index) => {
        const here = place.id === current;
        const finished = mastered === total;
        const action = done === total ? (finished ? 'Повторить урок' : 'Закрепить материал') : done > 0 ? 'Продолжить' : 'Начать';
        return (
          <View key={place.id} style={styles.stop}>
            <View style={styles.rail}>
              <View style={[styles.marker, { backgroundColor: finished ? c.success : here ? c.primary : c.surfaceAlt }]}>
                {finished ? <Ionicons name="checkmark" size={20} color={c.onPrimary} /> : <T v="label" color={here ? c.onPrimary : c.textMuted}>{index + 1}</T>}
              </View>
              {index < states.length - 1 && <View style={[styles.line, { backgroundColor: finished ? c.success : c.border }]} />}
            </View>
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: here ? c.primary : c.border }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={place.title + '. Пройдено ' + done + ' из ' + total + ', освоено ' + mastered + '. Открыть место'} onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}>
                {ART[place.art] && <Image source={ART[place.art]} style={styles.art} contentFit="cover" accessible={false} />}
                <View style={styles.details}>
                  {here && <T v="caption" color={c.primary}>ВАША ОСТАНОВКА</T>}
                  <T v="heading">{place.title}</T>
                  <T v="caption" muted>{units.map((u) => u.title).join(' · ')}</T>
                  <T v="caption" muted>Пройдено {done}/{total} · освоено {mastered}/{total}</T>
                  <ProgressBar value={mastered / total} color={finished ? c.success : c.primary} />
                </View>
              </Pressable>
              {nextLesson && <View style={styles.action}><Button kind={here ? 'primary' : 'secondary'} title={action} accessibilityLabel={action + ': ' + place.title} onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: nextLesson } })} /></View>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  route: { gap: space.md },
  text: { flex: 1, gap: space.xs },
  stop: { flexDirection: 'row', gap: space.sm },
  rail: { width: 32, alignItems: 'center' },
  marker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, marginTop: space.sm, marginBottom: -space.sm, minHeight: space.md },
  card: { flex: 1, minWidth: 0, overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1 },
  art: { width: '100%', aspectRatio: 2.8 },
  details: { padding: space.md, gap: space.sm },
  action: { paddingHorizontal: space.md, paddingBottom: space.md },
});
