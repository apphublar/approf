-- Suporte ao plano semestral no cadastro e nas recompensas de indicação.

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
  referral_code_input text;
  referrer_id uuid;
  trial_days integer := 7;
begin
  teacher_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1),
    'Professora'
  );

  selected_plan := lower(coalesce(nullif(new.raw_user_meta_data->>'selected_plan', ''), 'monthly'));
  if selected_plan in ('mensal', 'month') then
    selected_plan := 'monthly';
  elsif selected_plan in ('semestral', 'semi-annual') then
    selected_plan := 'semiannual';
  elsif selected_plan in ('anual', 'yearly') then
    selected_plan := 'annual';
  elsif selected_plan not in ('monthly', 'semiannual', 'annual') then
    selected_plan := 'monthly';
  end if;

  referral_code_input := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code', '')));

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

  if referral_code_input <> '' then
    select profiles.id
    into referrer_id
    from public.profiles
    where upper(trim(coalesce(profiles.teacher_code, ''))) = referral_code_input
    limit 1;

    if referrer_id is not null and referrer_id <> new.id then
      insert into public.teacher_referrals (
        referrer_id,
        referred_id,
        referral_code,
        status,
        reward_notes
      )
      values (
        referrer_id,
        new.id,
        referral_code_input,
        'registered',
        '[' || now()::text || '] Cadastro via indicação.'
      )
      on conflict (referred_id) do nothing;

      trial_days := 14;
      review_note := review_note || ' Trial estendido para 14 dias por indicação.';
    end if;
  end if;

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
    now() + make_interval(days => trial_days),
    now() + make_interval(days => trial_days),
    '[' || now()::text || '] Plano escolhido no cadastro: ' || selected_plan || '. ' || review_note
  )
  on conflict (user_id) do nothing;

  insert into public.teacher_profile_verifications (owner_id, status, notes, documents)
  values (new.id, review_status, review_note, '[]'::jsonb)
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.grant_teacher_referral_reward(p_referred_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral teacher_referrals%rowtype;
  v_subscription subscriptions%rowtype;
  v_referrer_id uuid;
  v_credit_cents integer := 0;
  v_giz_bonus integer := 0;
  v_monthly_rewards integer := 0;
  v_period_start date := date_trunc('month', now())::date;
  v_period_end date := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;
begin
  if p_referred_user_id is null then
    return jsonb_build_object('granted', false, 'reason', 'missing_referred_user');
  end if;

  select *
  into v_referral
  from public.teacher_referrals
  where referred_id = p_referred_user_id
    and status in ('registered', 'converted')
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('granted', false, 'reason', 'referral_not_found');
  end if;

  if v_referral.status = 'rewarded' then
    return jsonb_build_object('granted', false, 'reason', 'already_rewarded');
  end if;

  select *
  into v_subscription
  from public.subscriptions
  where user_id = p_referred_user_id
  limit 1;

  if not found then
    return jsonb_build_object('granted', false, 'reason', 'subscription_not_found');
  end if;

  if v_subscription.status <> 'active' then
    return jsonb_build_object('granted', false, 'reason', 'subscription_not_active');
  end if;

  if lower(v_subscription.plan) not in ('monthly', 'mensal', 'semiannual', 'semestral', 'annual', 'anual') then
    return jsonb_build_object('granted', false, 'reason', 'plan_not_eligible');
  end if;

  v_referrer_id := v_referral.referrer_id;

  select count(*)
  into v_monthly_rewards
  from public.teacher_referrals
  where referrer_id = v_referrer_id
    and status = 'rewarded'
    and rewarded_at >= date_trunc('month', now())
    and rewarded_at < date_trunc('month', now()) + interval '1 month';

  if v_monthly_rewards >= 3 then
    update public.teacher_referrals
    set
      status = 'converted',
      converted_at = coalesce(converted_at, now()),
      referred_plan = v_subscription.plan,
      reward_notes = coalesce(reward_notes, '') || E'\n[' || now()::text || '] Conversão registrada, limite mensal de recompensas atingido.'
    where id = v_referral.id;

    return jsonb_build_object('granted', false, 'reason', 'monthly_reward_limit');
  end if;

  if lower(v_subscription.plan) in ('annual', 'anual') then
    v_credit_cents := 3690;
    v_giz_bonus := 2000;
  else
    v_credit_cents := 1000;
    v_giz_bonus := 1000;
  end if;

  insert into public.referral_credits (
    owner_id,
    referral_id,
    amount_cents,
    consumed_cents,
    expires_at,
    notes
  )
  values (
    v_referrer_id,
    v_referral.id,
    v_credit_cents,
    0,
    now() + interval '12 months',
    'Crédito Indique uma prof: assinatura convertida de ' || coalesce((select full_name from public.profiles where id = p_referred_user_id), 'professora indicada') || '.'
  );

  insert into public.ai_usage_wallets as wallet (
    owner_id,
    period_type,
    period_start,
    period_end,
    giztokens_included,
    giztokens_used,
    included_cost_limit_cents,
    included_cost_used_cents,
    notes
  )
  values (
    v_referrer_id,
    'monthly',
    v_period_start,
    v_period_end,
    8000 + v_giz_bonus,
    0,
    800 + (v_giz_bonus / 10),
    0,
    '[' || now()::text || '] Bônus Indique uma prof: +' || v_giz_bonus::text || ' GizTokens.'
  )
  on conflict (owner_id, period_type, period_start, period_end)
  do update set
    giztokens_included = wallet.giztokens_included + v_giz_bonus,
    included_cost_limit_cents = wallet.included_cost_limit_cents + (v_giz_bonus / 10),
    notes = concat_ws(E'\n', nullif(wallet.notes, ''), excluded.notes),
    updated_at = now();

  update public.teacher_referrals
  set
    status = 'rewarded',
    converted_at = coalesce(converted_at, now()),
    rewarded_at = now(),
    referred_plan = v_subscription.plan,
    credit_cents = v_credit_cents,
    giztokens_bonus = v_giz_bonus,
    reward_notes = coalesce(reward_notes, '') || E'\n[' || now()::text || '] Recompensa aplicada: R$ ' || (v_credit_cents / 100.0)::text || ' + ' || v_giz_bonus::text || ' GizTokens.'
  where id = v_referral.id;

  return jsonb_build_object(
    'granted', true,
    'referrer_id', v_referrer_id,
    'credit_cents', v_credit_cents,
    'giztokens_bonus', v_giz_bonus
  );
end;
$$;
