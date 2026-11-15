import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { dateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

import { useAppStore } from './app-store';
import { mergeProgress } from './merge';
import { weekStart } from './quests';

// Необязательный аккаунт: вход по коду из письма, синхронизация прогресса, друзья, рейтинг.
// Все функции безопасны без сервера — просто ничего не делают.

type AccountState = { session: Session | null; syncing: boolean; lastSync: string | null; error: string | null };

export const useAccount = create<AccountState>(() => ({ session: null, syncing: false, lastSync: null, error: null }));

let started = false;

/** Подписка на сессию и первая синхронизация. Вызывается один раз при запуске. */
export function startAccount(): void {
  if (!supabase || started) return;
  started = true;
  void supabase.auth.getSession().then(({ data }) => {
    useAccount.setState({ session: data.session });
    if (data.session) void syncProgress();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    const was = useAccount.getState().session;
    useAccount.setState({ session });
    if (session && !was) void syncProgress();
  });
  // После каждого занятия — отправка на сервер, не чаще раза в 5 секунд.
  let timer: ReturnType<typeof setTimeout> | null = null;
  useAppStore.subscribe((s, prev) => {
    if (s.progress === prev.progress || !useAccount.getState().session) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncProgress(), 5000);
  });
}

export async function sendCode(email: string): Promise<string | null> {
  if (!supabase) return 'Сервер не настроен.';
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  return error ? 'Не удалось отправить письмо. Проверьте адрес и попробуйте ещё раз.' : null;
}

export async function verifyCode(email: string, token: string): Promise<string | null> {
  if (!supabase) return 'Сервер не настроен.';
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
  return error ? 'Код не подошёл или устарел. Запросите новый.' : null;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Забрать прогресс с сервера, объединить с локальным и отправить результат обратно. */
export async function syncProgress(): Promise<void> {
  const session = useAccount.getState().session;
  if (!supabase || !session || useAccount.getState().syncing) return;
  useAccount.setState({ syncing: true, error: null });
  try {
    const { data, error } = await supabase.from('progress').select('data').eq('user_id', session.user.id).maybeSingle();
    if (error) throw error;
    const local = useAppStore.getState().progress;
    const merged = data?.data ? mergeProgress(local, data.data, dateKey()) : local;
    if (merged !== local) useAppStore.setState({ progress: merged });
    const { name, avatar } = useAppStore.getState().settings;
    const [up, prof] = await Promise.all([
      supabase.from('progress').upsert({ user_id: session.user.id, data: merged, updated_at: new Date().toISOString() }),
      supabase.from('profiles').update({ name: name.trim().slice(0, 24), avatar }).eq('id', session.user.id),
    ]);
    if (up.error || prof.error) throw up.error ?? prof.error;
    useAccount.setState({ lastSync: new Date().toISOString() });
  } catch {
    useAccount.setState({ error: 'Синхронизация не удалась — попробуем позже.' });
  } finally {
    useAccount.setState({ syncing: false });
  }
}

export type LeaderRow = { user_id: string; name: string; avatar: string; xp: number; me: boolean };

export async function myFriendCode(): Promise<string | null> {
  const session = useAccount.getState().session;
  if (!supabase || !session) return null;
  const { data } = await supabase.from('profiles').select('friend_code').eq('id', session.user.id).maybeSingle();
  return data?.friend_code ?? null;
}

export async function addFriend(code: string): Promise<string> {
  if (!supabase) return 'Сервер не настроен.';
  const { data, error } = await supabase.rpc('add_friend', { code });
  if (error) return 'Не удалось добавить. Попробуйте позже.';
  return { ok: 'Друг добавлен!', not_found: 'Такого кода нет.', self: 'Это ваш собственный код.' }[data as string] ?? 'Готово.';
}

export async function leaderboard(): Promise<LeaderRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('weekly_leaderboard', { week_start: weekStart(dateKey()) });
  return error ? [] : (data as LeaderRow[]);
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export async function askTutor(messages: ChatTurn[]): Promise<{ reply: string; left?: number } | { error: string }> {
  if (!supabase) return { error: 'Сервер не настроен.' };
  const { data, error } = await supabase.functions.invoke('chat', { body: { messages } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    return { error: status === 429 ? 'На сегодня сообщения закончились — возвращайтесь завтра.' : 'Собеседник сейчас недоступен. Попробуйте позже.' };
  }
  return data as { reply: string; left?: number };
}
