-- Align signup trials with the plan selected on the public site.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  teacher_name text;
  selected_plan text;
  review_status text;
  review_note text;
begin
  teacher_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1),
    'Professora'
  );

  selected_plan := lower(coalesce(nullif(new.raw_user_meta_data->>'selected_plan', ''), 'monthly'));
  if selected_plan not in ('monthly', 'annual') then
    selected_plan := 'monthly';
  end if;

  review_status := public.teacher_name_review_status(teacher_name);
  review_note := case
    when review_status = 'approved' then 'Cadastro liberado automaticamente por nome feminino.'
    else 'Cadastro enviado para analise automatica: nome masculino, ambiguo ou nao reconhecido. Acesso mantido ate decisao manual do admin.'
  end;

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
    current_period_end,
    notes
  )
  values (
    new.id,
    'trial',
    selected_plan,
    'manual',
    now() + interval '7 days',
    now() + interval '7 days',
    '[' || now()::text || '] Plano escolhido no cadastro: ' || selected_plan || '. ' || review_note
  )
  on conflict (user_id) do nothing;

  insert into public.teacher_profile_verifications (owner_id, status, notes, documents)
  values (new.id, review_status, review_note, '[]'::jsonb)
  on conflict do nothing;

  return new;
end;
$$;

update public.subscriptions
set
  plan = 'monthly',
  trial_expires_at = least(coalesce(trial_expires_at, now() + interval '7 days'), created_at + interval '7 days'),
  current_period_end = least(coalesce(current_period_end, now() + interval '7 days'), created_at + interval '7 days'),
  updated_at = now()
where status = 'trial'
  and plan in ('trial_15_days', 'trial_7_days', 'trial', 'teste');
