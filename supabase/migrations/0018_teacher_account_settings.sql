-- Teacher account settings persistence.

alter table public.profiles
  add column if not exists notification_preferences jsonb not null default '{
    "app": {
      "relatoriosPendentes": true,
      "sugestoesIA": true,
      "streakRisco": true,
      "novidades": false
    },
    "email": {
      "resumoSemanal": true,
      "pagamento": true
    },
    "silencio": {
      "ativo": true,
      "inicio": "22:00",
      "fim": "06:00"
    }
  }'::jsonb;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
for select using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write" on storage.objects
for all using (
  bucket_id = 'avatars'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
) with check (
  bucket_id = 'avatars'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);
