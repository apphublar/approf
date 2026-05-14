-- Creates teacher profile and trial automatically after Supabase Auth signup.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  teacher_name text;
begin
  teacher_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1),
    'Professora'
  );

  insert into public.profiles (id, role, full_name, email)
  values (new.id, 'teacher', teacher_name, new.email)
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    updated_at = now();

  insert into public.subscriptions (
    user_id,
    status,
    plan,
    provider,
    trial_expires_at,
    current_period_end
  )
  values (
    new.id,
    'trial',
    'trial_15_days',
    'manual',
    now() + interval '15 days',
    now() + interval '15 days'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
