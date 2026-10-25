import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Text, type ColorValue } from 'react-native';

import { useAppStore } from '@/store/app-store';
import { fonts, useTheme } from '@/ui/theme';

function TabIcon({ name, fallback, color }: { name: SymbolViewProps['name']; fallback: string; color: ColorValue }) {
  return <SymbolView name={name} tintColor={color} size={24} fallback={<Text style={{ color, fontSize: 18 }}>{fallback}</Text>} />;
}

export default function TabsLayout() {
  const { c } = useTheme();
  const onboarded = useAppStore((s) => s.settings.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Путь', tabBarIcon: ({ color }) => <TabIcon name="map" fallback="◇" color={color} /> }} />
      <Tabs.Screen name="review" options={{ title: 'Повторение', tabBarIcon: ({ color }) => <TabIcon name="arrow.triangle.2.circlepath" fallback="↻" color={color} /> }} />
      <Tabs.Screen name="dictionary" options={{ title: 'Словарь', tabBarIcon: ({ color }) => <TabIcon name="character.book.closed" fallback="Аа" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: ({ color }) => <TabIcon name="person.crop.circle" fallback="○" color={color} /> }} />
    </Tabs>
  );
}
