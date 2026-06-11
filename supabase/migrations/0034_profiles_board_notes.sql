alter table public.profiles
  add column if not exists board_notes jsonb not null default '[]'::jsonb;
