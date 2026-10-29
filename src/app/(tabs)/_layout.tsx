import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';

import { useAppStore } from '@/store/app-store';
import { fonts, useTheme } from '@/ui/theme';

// SF Symbols на iOS, Ionicons в вебе и на Android.
function TabIcon({ name, fallback, color }: { name: SymbolViewProps['name']; fallback: IoniconName; color: ColorValue }) {
  return <SymbolView name={name} tintColor={color} size={24} fallback={<Ionicons name={fallback} size={22} color={color as string} />} />;
}

type IoniconName = keyof typeof Ionicons.glyphMap;

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
      <Tabs.Screen name="index" options={{ title: 'Путь', tabBarIcon: ({ color }) => <TabIcon name="map" fallback="map-outline" color={color} /> }} />
      <Tabs.Screen name="review" options={{ title: 'Повторение', tabBarIcon: ({ color }) => <TabIcon name="arrow.triangle.2.circlepath" fallback="repeat-outline" color={color} /> }} />
      <Tabs.Screen name="dictionary" options={{ title: 'Словарь', tabBarIcon: ({ color }) => <TabIcon name="character.book.closed" fallback="book-outline" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: ({ color }) => <TabIcon name="person.crop.circle" fallback="person-circle-outline" color={color} /> }} />
    </Tabs>
  );
}
