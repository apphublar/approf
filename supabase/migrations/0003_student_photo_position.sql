alter table public.students
  add column if not exists photo_position text not null default '50% 50% 120%';
