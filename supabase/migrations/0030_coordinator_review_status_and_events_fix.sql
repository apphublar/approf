alter table public.coordinator_class_shares
  drop constraint if exists coordinator_class_shares_access_status_check;

alter table public.coordinator_class_shares
  add constraint coordinator_class_shares_access_status_check
  check (access_status in ('pending', 'verified', 'revoked', 'review_finalized'));

alter table public.report_review_events
  alter column report_id drop not null;
