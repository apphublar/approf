-- Harden functions and storage policies flagged by Supabase Security Advisor.

alter function public.set_updated_at()
  set search_path = '';

alter function public.teacher_name_review_status(text)
  set search_path = '';

alter function public.set_development_report_review_status()
  set search_path = '';

alter function public.is_admin()
  set search_path = '';

alter function public.is_super_admin()
  set search_path = '';

alter function public.handle_new_auth_user()
  set search_path = '';

alter function public.reserve_ai_usage_atomic(
  uuid,
  public.ai_generation_type,
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  public.ai_entitlement_type,
  date,
  date,
  integer,
  integer,
  text,
  date,
  date,
  integer
) set search_path = '';

alter function public.finalize_ai_usage_reservation(uuid, integer, jsonb)
  set search_path = '';

alter function public.refund_ai_usage_reservation(uuid, text, public.ai_generation_status, integer)
  set search_path = '';

alter function public.set_report_final_version(uuid, uuid, boolean)
  set search_path = '';

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.teacher_name_review_status(text) from public, anon, authenticated;
revoke execute on function public.set_development_report_review_status() from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;

revoke execute on function public.reserve_ai_usage_atomic(
  uuid,
  public.ai_generation_type,
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  public.ai_entitlement_type,
  date,
  date,
  integer,
  integer,
  text,
  date,
  date,
  integer
) from public, anon, authenticated;

revoke execute on function public.finalize_ai_usage_reservation(uuid, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.refund_ai_usage_reservation(uuid, text, public.ai_generation_status, integer) from public, anon, authenticated;
revoke execute on function public.set_report_final_version(uuid, uuid, boolean) from public, anon, authenticated;

grant execute on function public.reserve_ai_usage_atomic(
  uuid,
  public.ai_generation_type,
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  public.ai_entitlement_type,
  date,
  date,
  integer,
  integer,
  text,
  date,
  date,
  integer
) to service_role;

grant execute on function public.finalize_ai_usage_reservation(uuid, integer, jsonb) to service_role;
grant execute on function public.refund_ai_usage_reservation(uuid, text, public.ai_generation_status, integer) to service_role;
grant execute on function public.set_report_final_version(uuid, uuid, boolean) to service_role;

drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_owner_read" on storage.objects;
drop policy if exists "avatars_owner_write" on storage.objects;

create policy "avatars_owner_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);

create policy "avatars_owner_write" on storage.objects
for all to authenticated
using (
  bucket_id = 'avatars'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'avatars'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);
