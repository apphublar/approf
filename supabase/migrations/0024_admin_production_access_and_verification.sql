-- Production admin controls for teacher access and automatic signup review.

create or replace function public.teacher_name_review_status(p_full_name text)
returns text
language plpgsql
immutable
as $$
declare
  first_name text;
  female_names text[] := array[
    'ana','amanda','alice','alicia','aline','amélia','amelia','andrea','andréa','angela','ângela',
    'barbara','bárbara','beatriz','bianca','bruna','camila','carla','carolina','catarina','celia','célia',
    'clara','claudia','cláudia','daniela','debora','débora','eduarda','eliane','elisa','ester','esther',
    'fabiana','fernanda','flavia','flávia','gabriela','giovana','giovanna','helena','isabel','isabela',
    'isabella','jessica','jéssica','joana','julia','júlia','juliana','karina','larissa','laura','leticia',
    'letícia','livia','lívia','luana','luciana','luiza','luíza','marcela','marcia','márcia','maria',
    'mariana','marina','marta','monica','mônica','natalia','natália','patricia','patrícia','paula',
    'priscila','raquel','renata','rita','sandra','simone','sofia','sophia','tais','taís','tatiana',
    'teresa','tereza','valeria','valéria','vanessa','vera','vitoria','vitória'
  ];
  male_names text[] := array[
    'ademir','adriano','alex','alexandre','anderson','andre','andré','antonio','antônio','arthur',
    'augusto','benicio','benício','bernardo','bruno','caio','carlos','cauã','caua','cesar','césar',
    'daniel','davi','diego','eduardo','emanuel','enrico','enzo','felipe','fernando','francisco',
    'gabriel','guilherme','gustavo','henrique','heitor','igor','isaac','joao','joão','jorge','jose',
    'josé','leandro','leo','leonardo','lorenzo','lucas','lucca','luís','luis','marcelo','marcos',
    'mateus','matheus','miguel','murilo','nicolas','otavio','otávio','paulo','pedro','rafael',
    'renan','ricardo','roberto','rodrigo','samuel','thiago','tiago','vinicius','vinícius','vitor','victor'
  ];
begin
  first_name := lower(split_part(trim(coalesce(p_full_name, '')), ' ', 1));

  if first_name = '' then
    return 'pending';
  end if;

  if first_name = any(male_names) then
    return 'pending';
  end if;

  if first_name = any(female_names) or right(first_name, 1) = 'a' then
    return 'approved';
  end if;

  return 'pending';
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  teacher_name text;
  review_status text;
  subscription_status public.subscription_status;
  review_note text;
begin
  teacher_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1),
    'Professora'
  );

  review_status := public.teacher_name_review_status(teacher_name);
  subscription_status := case when review_status = 'approved' then 'trial'::public.subscription_status else 'blocked'::public.subscription_status end;
  review_note := case
    when review_status = 'approved' then 'Cadastro liberado automaticamente por nome feminino.'
    else 'Cadastro enviado para analise automatica: nome masculino, ambiguo ou nao reconhecido.'
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
    subscription_status,
    case when review_status = 'approved' then 'trial_15_days' else 'verification_required' end,
    'manual',
    case when review_status = 'approved' then now() + interval '15 days' else null end,
    case when review_status = 'approved' then now() + interval '15 days' else null end,
    '[' || now()::text || '] ' || review_note
  )
  on conflict (user_id) do update set
    status = excluded.status,
    plan = excluded.plan,
    trial_expires_at = excluded.trial_expires_at,
    current_period_end = excluded.current_period_end,
    notes = coalesce(public.subscriptions.notes || E'\n', '') || excluded.notes,
    updated_at = now();

  insert into public.teacher_profile_verifications (owner_id, status, notes, documents)
  values (new.id, review_status, review_note, '[]'::jsonb)
  on conflict do nothing;

  return new;
end;
$$;

insert into public.teacher_profile_verifications (owner_id, status, notes, documents)
select
  p.id,
  public.teacher_name_review_status(p.full_name),
  case
    when public.teacher_name_review_status(p.full_name) = 'approved' then 'Cadastro existente liberado automaticamente por nome feminino.'
    else 'Cadastro existente enviado para analise: nome masculino, ambiguo ou nao reconhecido.'
  end,
  '[]'::jsonb
from public.profiles p
where p.role = 'teacher'
  and not exists (
    select 1
    from public.teacher_profile_verifications v
    where v.owner_id = p.id
  );

update public.subscriptions s
set
  status = 'blocked',
  plan = 'verification_required',
  trial_expires_at = null,
  current_period_end = null,
  notes = coalesce(s.notes || E'\n', '') || '[' || now()::text || '] Cadastro enviado para analise por regra de nome.',
  updated_at = now()
from public.profiles p
where p.id = s.user_id
  and p.role = 'teacher'
  and public.teacher_name_review_status(p.full_name) <> 'approved';

update public.subscriptions s
set
  status = case when s.status = 'blocked' and s.plan = 'verification_required' then 'trial'::public.subscription_status else s.status end,
  plan = case when s.plan = 'verification_required' then 'trial_15_days' else s.plan end,
  trial_expires_at = case when s.plan = 'verification_required' then now() + interval '15 days' else s.trial_expires_at end,
  current_period_end = case when s.plan = 'verification_required' then now() + interval '15 days' else s.current_period_end end,
  notes = coalesce(s.notes || E'\n', '') || '[' || now()::text || '] Cadastro liberado por regra de nome feminino.',
  updated_at = now()
from public.profiles p
where p.id = s.user_id
  and p.role = 'teacher'
  and public.teacher_name_review_status(p.full_name) = 'approved';
