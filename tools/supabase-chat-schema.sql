-- Supabase schema for chat migration (run in Supabase SQL Editor)

create table if not exists public.chat_rooms (
  id text primary key,
  name text not null,
  type text not null default 'group',
  participants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message text,
  last_sender text
);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room_id text not null references public.chat_rooms(id) on delete cascade,
  sender text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_room_created
  on public.chat_messages (room_id, created_at);

alter publication supabase_realtime add table public.chat_messages;

alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;

-- Dev policies (public read/write). Tighten for production.
drop policy if exists "chat_rooms_public_read" on public.chat_rooms;
create policy "chat_rooms_public_read"
  on public.chat_rooms for select
  using (true);

drop policy if exists "chat_rooms_public_upsert" on public.chat_rooms;
create policy "chat_rooms_public_upsert"
  on public.chat_rooms for insert
  with check (char_length(name) between 1 and 120);

drop policy if exists "chat_rooms_public_update" on public.chat_rooms;
create policy "chat_rooms_public_update"
  on public.chat_rooms for update
  using (true)
  with check (char_length(name) between 1 and 120);

drop policy if exists "chat_messages_public_read" on public.chat_messages;
create policy "chat_messages_public_read"
  on public.chat_messages for select
  using (true);

drop policy if exists "chat_messages_public_insert" on public.chat_messages;
create policy "chat_messages_public_insert"
  on public.chat_messages for insert
  with check (
    char_length(sender) between 1 and 80
    and char_length(text) between 1 and 800
  );
