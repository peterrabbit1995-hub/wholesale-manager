-- 전체 테이블 RLS 켜기 + "로그인한 사용자 모두 가능, 비로그인 차단" 정책
--
-- 정책 이름: "authenticated_all"
-- 의미: authenticated 역할(로그인한 사용자)은 SELECT/INSERT/UPDATE/DELETE 모두 가능
--       anon 역할(비로그인)은 어떤 접근도 불가
--
-- 멱등성(여러 번 실행해도 안전):
--   - ENABLE ROW LEVEL SECURITY 는 이미 켜져 있어도 에러 안 남
--   - DROP POLICY IF EXISTS 후 CREATE POLICY 로 재생성
--
-- 제외 테이블:
--   - product_aliases : 이미 별도 정책으로 RLS 설정됨 (20260406)
--   - draft_data      : 이미 "본인 것만" 정책으로 설정됨 (20260407)
--                       전체 허용으로 덮으면 사용자 간 임시저장이 섞여서 보안 약화됨

-- ============================================================
-- 1. customers (거래처)
-- ============================================================
alter table customers enable row level security;
drop policy if exists "authenticated_all" on customers;
create policy "authenticated_all" on customers
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 2. products (상품)
-- ============================================================
alter table products enable row level security;
drop policy if exists "authenticated_all" on products;
create policy "authenticated_all" on products
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 3. product_options (상품 옵션)
-- ============================================================
alter table product_options enable row level security;
drop policy if exists "authenticated_all" on product_options;
create policy "authenticated_all" on product_options
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 4. product_prices (상품 등급별 가격)
-- ============================================================
alter table product_prices enable row level security;
drop policy if exists "authenticated_all" on product_prices;
create policy "authenticated_all" on product_prices
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 5. option_prices (옵션별 가격)
-- ============================================================
alter table option_prices enable row level security;
drop policy if exists "authenticated_all" on option_prices;
create policy "authenticated_all" on option_prices
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 6. price_tiers (가격 등급)
-- ============================================================
alter table price_tiers enable row level security;
drop policy if exists "authenticated_all" on price_tiers;
create policy "authenticated_all" on price_tiers
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 7. customer_prices (특별단가)
-- ============================================================
alter table customer_prices enable row level security;
drop policy if exists "authenticated_all" on customer_prices;
create policy "authenticated_all" on customer_prices
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 8. price_history (가격 변동 이력)
-- ============================================================
alter table price_history enable row level security;
drop policy if exists "authenticated_all" on price_history;
create policy "authenticated_all" on price_history
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 9. transactions (거래)
-- ============================================================
alter table transactions enable row level security;
drop policy if exists "authenticated_all" on transactions;
create policy "authenticated_all" on transactions
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 10. invoices (명세서)
-- ============================================================
alter table invoices enable row level security;
drop policy if exists "authenticated_all" on invoices;
create policy "authenticated_all" on invoices
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 11. payments (입금)
-- ============================================================
alter table payments enable row level security;
drop policy if exists "authenticated_all" on payments;
create policy "authenticated_all" on payments
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 12. shipments (발송)
-- ============================================================
alter table shipments enable row level security;
drop policy if exists "authenticated_all" on shipments;
create policy "authenticated_all" on shipments
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 13. company_info (회사 정보)
-- ============================================================
alter table company_info enable row level security;
drop policy if exists "authenticated_all" on company_info;
create policy "authenticated_all" on company_info
  for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 14. order_messages (AI 주문 메시지 중복 방지)
-- ============================================================
alter table order_messages enable row level security;
drop policy if exists "authenticated_all" on order_messages;
create policy "authenticated_all" on order_messages
  for all to authenticated
  using (true) with check (true);
