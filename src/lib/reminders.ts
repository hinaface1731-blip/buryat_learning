import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

// Ежедневное напоминание — локальное уведомление на устройстве, без сервера и push-токенов.
// В вебе напоминаний нет: настройка в профиле там скрыта.

const REMINDER_ID = 'daily-reminder';

export const REMINDERS_SUPPORTED = Platform.OS !== 'web';

/** Пока приложение открыто, уведомление показывается баннером, без звука. */
export function initReminders(): void {
  if (!REMINDERS_SUPPORTED) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

async function permitted(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === IosAuthorizationStatus.PROVISIONAL) return true;
  const asked = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  return asked.granted;
}

/** Ставит (или переставляет) напоминание на hour:00. false — нет разрешения или платформа без уведомлений. */
export async function scheduleReminder(hour: number): Promise<boolean> {
  if (!REMINDERS_SUPPORTED) return false;
  try {
    if (!(await permitted())) return false;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('reminders', { name: 'Напоминания', importance: AndroidImportance.DEFAULT });
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: 'Сайн байна!', body: 'Пять минут бурятского? Нерпёнок ждёт на уроке.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: 'reminders' },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelReminder(): Promise<void> {
  if (!REMINDERS_SUPPORTED) return;
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
}
