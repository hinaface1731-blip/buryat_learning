-- Бурятский язык: необязательный аккаунт. Без входа приложение работает целиком на устройстве.
-- Таблицы защищены RLS: человек видит только свои данные; друзья — только имя, аватар и XP за неделю.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '' check (char_length(name) <= 24),
  avatar text not null default 'seal' check (char_length(avatar) <= 32),
  friend_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_at timestamptz not null default now()
);

create table public.progress (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.friends (
  user_id uuid not null references auth.users on delete cascade,
  friend_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- Счётчик сообщений ИИ-собеседнику: ограничение в день на человека.
create table public.chat_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null default current_date,
  messages int not null default 0,
  primary key (user_id, day)
);

alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.friends enable row level security;
alter table public.chat_usage enable row level security;

create policy "свой профиль" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "свой прогресс" on public.progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "свои друзья" on public.friends for select using (auth.uid() = user_id);
create policy "удалить друга" on public.friends for delete using (auth.uid() = user_id);
-- chat_usage пишет только Edge Function с ключом service_role: политик для клиента нет.

-- Профиль создаётся при регистрации.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Добавить друга по коду: дружба взаимная, чужой профиль напрямую не читается.
create function public.add_friend(code text) returns text language plpgsql security definer set search_path = '' as $$
declare other uuid;
begin
  select id into other from public.profiles where friend_code = upper(trim(code));
  if other is null then return 'not_found'; end if;
  if other = auth.uid() then return 'self'; end if;
  insert into public.friends (user_id, friend_id) values (auth.uid(), other), (other, auth.uid()) on conflict do nothing;
  return 'ok';
end $$;

-- Недельный рейтинг: я и друзья, XP с понедельника по воскресенье из сохранённого прогресса.
create function public.weekly_leaderboard(week_start date) returns table (user_id uuid, name text, avatar text, xp bigint, me boolean)
language sql security definer set search_path = '' stable as $$
  with people as (
    select auth.uid() as id
    union select friend_id from public.friends where user_id = auth.uid()
  )
  select p.id, pr.name, pr.avatar,
    coalesce((select sum(value::bigint) from jsonb_each_text(g.data -> 'xpByDate') where key::date between week_start and week_start + 6), 0) as xp,
    p.id = auth.uid()
  from people p
  join public.profiles pr on pr.id = p.id
  left join public.progress g on g.user_id = p.id
  order by xp desc;
$$;

revoke execute on function public.add_friend(text) from anon;
revoke execute on function public.weekly_leaderboard(date) from anon;
