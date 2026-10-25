import { InputAccessoryView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, radius, space, useTheme } from './theme';

export const BURYAT_KEYS = ['Ү', 'ү', 'Ө', 'ө', 'Һ', 'һ'] as const;

function Keys({ onKey }: { onKey: (ch: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
      {BURYAT_KEYS.map((k) => (
        <Pressable
          key={k}
          accessibilityRole="button"
          accessibilityLabel={`Вставить ${k}`}
          onPress={() => onKey(k)}
          style={({ pressed }) => [styles.key, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 22, color: c.text }}>{k}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Панель Ү ү Ө ө Һ һ. На iOS — над системной клавиатурой (InputAccessoryView, работает в Expo Go),
 * на других платформах — строкой под полем ввода.
 */
export function BuryatKeysBar({ nativeID, onKey }: { nativeID: string; onKey: (ch: string) => void }) {
  if (Platform.OS === 'ios') {
    return (
      <InputAccessoryView nativeID={nativeID}>
        <Keys onKey={onKey} />
      </InputAccessoryView>
    );
  }
  return <Keys onKey={onKey} />;
}

/** Вставка символа в позицию курсора. */
export function insertAt(value: string, selection: { start: number; end: number }, ch: string): { value: string; cursor: number } {
  const next = value.slice(0, selection.start) + ch + value.slice(selection.end);
  return { value: next, cursor: selection.start + ch.length };
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: space.sm, padding: space.sm, borderTopWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  key: { flex: 1, maxWidth: 56, height: 44, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
