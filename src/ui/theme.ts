import { useColorScheme } from 'react-native';

import { useAppStore } from '@/store/app-store';

// Палитра «степь и Байкал»: светлый ковыль, глубокая байкальская синева, охра степи.
// Спокойная, без детской яркости.

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  accent: string;
  success: string;
  successBg: string;
  error: string;
  errorBg: string;
  warning: string;
  warningBg: string;
};

export const light: Palette = {
  bg: '#F5F1E8',
  surface: '#FFFDF8',
  surfaceAlt: '#ECE6D8',
  text: '#1C2830',
  textMuted: '#5B6670',
  border: '#DDD5C4',
  primary: '#1E6A86',
  onPrimary: '#FFFFFF',
  accent: '#C4892B',
  success: '#3D8A57',
  successBg: '#E3F0E6',
  error: '#B0463A',
  errorBg: '#F6E3E0',
  warning: '#9A6A14',
  warningBg: '#F7EBD5',
};

export const dark: Palette = {
  bg: '#0E181E',
  surface: '#16232B',
  surfaceAlt: '#1E2E38',
  text: '#E8E4DA',
  textMuted: '#9AA6AE',
  border: '#2A3B46',
  primary: '#5AA9C8',
  onPrimary: '#0E181E',
  accent: '#D9A04A',
  success: '#62B47E',
  successBg: '#17301F',
  error: '#E07A6C',
  errorBg: '#3A1F1C',
  warning: '#D9A04A',
  warningBg: '#33291A',
};

export const fonts = {
  regular: 'NotoSans_400Regular',
  medium: 'NotoSans_500Medium',
  semibold: 'NotoSans_600SemiBold',
  bold: 'NotoSans_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;

export function useTheme(): { c: Palette; scheme: 'light' | 'dark' } {
  const system = useColorScheme();
  const pref = useAppStore((s) => s.settings.theme);
  const scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return { c: scheme === 'dark' ? dark : light, scheme };
}
