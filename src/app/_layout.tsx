// Импорт по начертаниям: корневой модуль тянет в сборку все 18 файлов шрифта.
import { NotoSans_400Regular } from '@expo-google-fonts/noto-sans/400Regular';
import { NotoSans_500Medium } from '@expo-google-fonts/noto-sans/500Medium';
import { NotoSans_600SemiBold } from '@expo-google-fonts/noto-sans/600SemiBold';
import { NotoSans_700Bold } from '@expo-google-fonts/noto-sans/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHydrated } from '@/store/app-store';
import { useTheme } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Noto Sans корректно рисует Ү ү Ө ө Һ һ на всех платформах.
  const [fontsLoaded, fontError] = useFonts({ NotoSans_400Regular, NotoSans_500Medium, NotoSans_600SemiBold, NotoSans_700Bold });
  const hydrated = useHydrated();
  const { c, scheme } = useTheme();
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* В вебе на широком экране приложение занимает центральную колонку, как на телефоне. */}
      <View style={[styles.frame, { backgroundColor: c.bg }]}>
        <View style={[styles.column, Platform.OS === 'web' && { borderColor: c.border, borderLeftWidth: 1, borderRightWidth: 1 }]}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            <Stack.Screen name="lesson/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="review-session" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="result" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          </Stack>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: 640 },
});
