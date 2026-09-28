-- Demir Defter veritabanı şeması.
-- Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını yapıştır → Run.
-- Tekrar çalıştırmak güvenlidir.

-- Her kullanıcının belgeleri. Belge kimlikleri uygulamadaki modelle aynıdır:
--   s-YYYY-MM-DD (antrenman), f-YYYY-MM-DD (beslenme), body, settings, nutrition
create table if not exists public.docs (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 40),
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Satır düzeyi güvenlik: herkes yalnızca kendi satırlarını görür ve değiştirir.
alter table public.docs enable row level security;

drop policy if exists "docs_select_own" on public.docs;
drop policy if exists "docs_insert_own" on public.docs;
drop policy if exists "docs_update_own" on public.docs;
drop policy if exists "docs_delete_own" on public.docs;

create policy "docs_select_own" on public.docs
  for select using ((select auth.uid()) = user_id);
create policy "docs_insert_own" on public.docs
  for insert with check ((select auth.uid()) = user_id);
create policy "docs_update_own" on public.docs
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "docs_delete_own" on public.docs
  for delete using ((select auth.uid()) = user_id);

-- Tek belge 512 KB'ı geçemez (kötüye kullanıma karşı).
alter table public.docs drop constraint if exists docs_size;
alter table public.docs add constraint docs_size check (pg_column_size(data) < 524288);

-- Diğer cihazlardaki değişikliklerin anında gelmesi için canlı yayın.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs'
  ) then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;
