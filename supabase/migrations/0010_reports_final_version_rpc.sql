-- Transactional final-version marker for generated reports.

create or replace function public.set_report_final_version(
  p_owner_id uuid,
  p_report_id uuid,
  p_is_final boolean
)
returns table (
  id uuid,
  owner_id uuid,
  student_id uuid,
  class_id uuid,
  status public.report_status,
  report_type text,
  prompt_version text,
  body text,
  is_final_version boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports%rowtype;
begin
  select * into v_report
  from public.reports
  where reports.id = p_report_id
    and reports.owner_id = p_owner_id;

  if not found then
    raise exception 'Report not found';
  end if;

  if coalesce(p_is_final, false) and v_report.student_id is not null then
    perform reports.id
    from public.reports
    where reports.owner_id = p_owner_id
      and reports.student_id = v_report.student_id
      and reports.report_type = v_report.report_type
    order by reports.id
    for update;

    update public.reports
    set is_final_version = false
    where reports.owner_id = p_owner_id
      and reports.student_id = v_report.student_id
      and reports.report_type = v_report.report_type
      and reports.id <> p_report_id
      and reports.is_final_version = true;
  end if;

  update public.reports
  set is_final_version = coalesce(p_is_final, false)
  where reports.id = p_report_id
    and reports.owner_id = p_owner_id;

  return query
  select
    reports.id,
    reports.owner_id,
    reports.student_id,
    reports.class_id,
    reports.status,
    reports.report_type,
    reports.prompt_version,
    reports.body,
    reports.is_final_version,
    reports.created_at,
    reports.updated_at
  from public.reports
  where reports.id = p_report_id
    and reports.owner_id = p_owner_id;
end;
$$;

revoke all on function public.set_report_final_version(uuid, uuid, boolean) from public;
grant execute on function public.set_report_final_version(uuid, uuid, boolean) to service_role;
