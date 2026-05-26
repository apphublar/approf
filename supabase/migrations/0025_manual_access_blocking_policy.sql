-- Access blocking is now an explicit admin action.
-- Payment overdue accounts stay usable until the admin blocks them manually.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  teacher_name text;
  review_status text;
  review_note text;
begin
  teacher_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1),
    'Professora'
  );

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
    'trial_7_days',
    'manual',
    now() + interval '7 days',
    now() + interval '7 days',
    '[' || now()::text || '] ' || review_note
  )
  on conflict (user_id) do update set
    status = case
      when public.subscriptions.status = 'blocked' then public.subscriptions.status
      else excluded.status
    end,
    plan = case
      when public.subscriptions.status = 'blocked' then public.subscriptions.plan
      else excluded.plan
    end,
    trial_expires_at = case
      when public.subscriptions.status = 'blocked' then public.subscriptions.trial_expires_at
      else excluded.trial_expires_at
    end,
    current_period_end = case
      when public.subscriptions.status = 'blocked' then public.subscriptions.current_period_end
      else excluded.current_period_end
    end,
    notes = coalesce(public.subscriptions.notes || E'\n', '') || excluded.notes,
    updated_at = now();

  insert into public.teacher_profile_verifications (owner_id, status, notes, documents)
  values (new.id, review_status, review_note, '[]'::jsonb)
  on conflict do nothing;

  return new;
end;
$$;

update public.subscriptions s
set
  status = case
    when s.plan in ('monthly', 'annual', 'free') then 'active'::public.subscription_status
    else 'trial'::public.subscription_status
  end,
  plan = case when s.plan = 'verification_required' then 'trial_7_days' else s.plan end,
  trial_expires_at = coalesce(s.trial_expires_at, now() + interval '7 days'),
  current_period_end = coalesce(s.current_period_end, now() + interval '7 days'),
  notes = coalesce(s.notes || E'\n', '') || '[' || now()::text || '] Acesso liberado: bloqueio automatico removido, bloqueio passa a ser manual pelo admin.',
  updated_at = now()
from public.profiles p
where p.id = s.user_id
  and p.role = 'teacher'
  and s.status = 'blocked';
