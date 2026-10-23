-- 주헌 루틴: 모든 기록을 담는 표 하나.
-- Supabase 대시보드 → SQL Editor → New query 에 통째로 붙여 넣고 Run 을 누르세요.
-- path 예시: settings/main, months/2026-10, plan/recurring, weeks/2026-10-12, monthplan/2026-10

create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  path       text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, path)
);

-- 로그인한 사람은 자기 기록만 읽고 쓸 수 있어요.
alter table public.docs enable row level security;

drop policy if exists "own rows: select" on public.docs;
drop policy if exists "own rows: insert" on public.docs;
drop policy if exists "own rows: update" on public.docs;
drop policy if exists "own rows: delete" on public.docs;

create policy "own rows: select" on public.docs for select to authenticated using (auth.uid() = user_id);
create policy "own rows: insert" on public.docs for insert to authenticated with check (auth.uid() = user_id);
create policy "own rows: update" on public.docs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on public.docs for delete to authenticated using (auth.uid() = user_id);
