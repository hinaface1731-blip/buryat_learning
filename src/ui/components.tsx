import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/app-store';

import { fonts, radius, space, useTheme } from './theme';

type TextVariant = 'title' | 'heading' | 'body' | 'caption' | 'buryat' | 'buryatLarge' | 'label';

const textStyles: Record<TextVariant, TextStyle> = {
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32 },
  heading: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 25 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  buryat: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 30 },
  buryatLarge: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 46 },
};

export function T({ v = 'body', muted, color, style, children, ...rest }: { v?: TextVariant; muted?: boolean; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; selectable?: boolean; numberOfLines?: number }) {
  const { c } = useTheme();
  return (
    <Text style={[textStyles[v], { color: color ?? (muted ? c.textMuted : c.text) }, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Screen({ children, scroll = false, edges }: { children: ReactNode; scroll?: boolean; edges?: ('top' | 'bottom')[] }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges ?? ['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.screenPad} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenPad, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>{children}</View>;
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ title, onPress, kind = 'primary', disabled, style, accessibilityLabel }: { title: string; onPress: () => void; kind?: ButtonKind; disabled?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const { c } = useTheme();
  const bg = { primary: c.primary, secondary: c.surfaceAlt, ghost: 'transparent', danger: c.errorBg }[kind];
  const fg = { primary: c.onPrimary, secondary: c.text, ghost: c.primary, danger: c.error }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}>
      <Text style={[textStyles.label, { color: fg, textAlign: 'center' }]}>{title}</Text>
    </Pressable>
  );
}

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim';

export function OptionButton({ label, state = 'idle', onPress, disabled, buryat }: { label: string; state?: OptionState; onPress: () => void; disabled?: boolean; buryat?: boolean }) {
  const { c } = useTheme();
  const palette = {
    idle: { bg: c.surface, border: c.border, fg: c.text },
    selected: { bg: c.surfaceAlt, border: c.primary, fg: c.text },
    correct: { bg: c.successBg, border: c.success, fg: c.text },
    wrong: { bg: c.errorBg, border: c.error, fg: c.text },
    dim: { bg: c.surface, border: c.border, fg: c.textMuted },
  }[state];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.option, { backgroundColor: palette.bg, borderColor: palette.border, opacity: pressed ? 0.85 : 1 }]}>
      <Text style={[buryat ? textStyles.buryat : textStyles.body, { color: palette.fg, fontSize: buryat ? 20 : 17 }]}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.progressTrack, { backgroundColor: c.surfaceAlt }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color ?? c.primary }]} />
    </View>
  );
}

/** Показывать ли пометку «не проверено» (всегда в dev, в релизе — по настройке). */
export function useShowUnverified(): boolean {
  const setting = useAppStore((s) => s.settings.showUnverified);
  return __DEV__ || setting;
}

export function UnverifiedBadge({ verified, label = 'не проверено носителем' }: { verified: boolean; label?: string }) {
  const { c } = useTheme();
  const show = useShowUnverified();
  if (verified || !show) return null;
  return (
    <View style={[styles.badge, { backgroundColor: c.warningBg }]} accessibilityLabel={label}>
      <Text style={[textStyles.caption, { color: c.warning }]}>{label}</Text>
    </View>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screenPad: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xl, gap: space.lg },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.sm },
  button: { borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: space.lg, minHeight: 50, justifyContent: 'center' },
  option: { borderRadius: radius.md, borderWidth: 1.5, paddingVertical: 14, paddingHorizontal: space.lg, minHeight: 54, justifyContent: 'center' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', flex: 1 },
  progressFill: { height: 8, borderRadius: 4 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm },
});
