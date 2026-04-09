-- 권한 시스템: user_roles 테이블 + is_admin 헬퍼 함수
--
-- 정책:
--   - 한 사용자당 한 줄 (user_id가 PK)
--   - role 컬럼은 텍스트라서 나중에 'manager' 같은 새 역할 자유롭게 추가 가능
--   - user_roles에 행이 없으면 = 권한 없음 (안전 차단)
--   - 본인 역할만 SELECT 가능 (메뉴 그릴 때 본인 role 알아야 하므로)
--   - INSERT/UPDATE/DELETE는 Supabase 대시보드에서 관리자가 직접

-- ============================================================
-- 1. 테이블 생성
-- ============================================================
create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. RLS 켜기 + "본인 행만 읽기" 정책
-- ============================================================
alter table user_roles enable row level security;

drop policy if exists "read_own_role" on user_roles;
create policy "read_own_role" on user_roles
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- 3. is_admin(uid) 헬퍼 함수
-- ============================================================
-- 다른 테이블의 RLS 정책에서 호출할 용도.
-- SECURITY DEFINER: 함수 만든 사람(=postgres) 권한으로 실행되므로
--                   user_roles의 RLS를 우회해서 모든 행 조회 가능.
-- STABLE         : 같은 입력에 대해 같은 결과를 보장 (옵티마이저 힌트)
create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from user_roles where user_id = uid and role = 'admin'
  );
$$;

grant execute on function is_admin(uuid) to authenticated;

-- ============================================================
-- 4. 관리자 계정 등록 (수동 채우기)
-- ============================================================
-- TODO: Supabase 대시보드 → Authentication → Users 에서
--       본인과 남편 계정의 user_id (UID 컬럼)를 복사해서
--       아래 두 줄의 'PASTE_..._HERE' 를 실제 UUID 로 바꾸고
--       앞의 '--' 주석을 지운 뒤 이 부분만 따로 SQL Editor 에서 실행하세요.
--
-- insert into user_roles (user_id, role) values
--   ('PASTE_OWNER_USER_ID_HERE', 'admin'),
--   ('PASTE_SPOUSE_USER_ID_HERE', 'admin')
-- on conflict (user_id) do update set role = excluded.role;
