create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  notes text,
  event_date date not null,
  event_time time,
  remind boolean not null default true,
  telegram_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events_owner_all" on public.calendar_events;
create policy "calendar_events_owner_all" on public.calendar_events
for all using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop trigger if exists calendar_events_updated_at on public.calendar_events;
create trigger calendar_events_updated_at before update on public.calendar_events
for each row execute function public.set_updated_at();

create index if not exists calendar_events_owner_date_idx
on public.calendar_events(owner_id, event_date, event_time);
