-- Soft delete 적용: 5개 테이블에 is_active 컬럼 추가
-- 삭제 대신 is_active=false로 비활성화하여 데이터 복구 가능하게 함
-- 복구는 Supabase 콘솔에서 직접 is_active=true로 변경

alter table customers   add column if not exists is_active boolean not null default true;
alter table products    add column if not exists is_active boolean not null default true;
alter table invoices    add column if not exists is_active boolean not null default true;
alter table payments    add column if not exists is_active boolean not null default true;
alter table price_tiers add column if not exists is_active boolean not null default true;

-- 활성 데이터 조회 성능을 위한 부분 인덱스
create index if not exists idx_customers_active   on customers   (id) where is_active = true;
create index if not exists idx_products_active    on products    (id) where is_active = true;
create index if not exists idx_invoices_active    on invoices    (id) where is_active = true;
create index if not exists idx_payments_active    on payments    (id) where is_active = true;
create index if not exists idx_price_tiers_active on price_tiers (id) where is_active = true;

-- get_receivables RPC 갱신: 비활성 명세서/입금은 미수금 계산에서 제외
-- 단, 거래처는 비활성이어도 미수금 표시 (돈은 받아야 하므로)
create or replace function get_receivables()
returns table (
  customer_id uuid,
  customer_name text,
  total_invoiced numeric,
  total_paid numeric,
  unpaid numeric
)
language sql
stable
as $$
  select
    c.id as customer_id,
    c.name as customer_name,
    coalesce(inv.total, 0) as total_invoiced,
    coalesce(pay.total, 0) as total_paid,
    coalesce(inv.total, 0) - coalesce(pay.total, 0) as unpaid
  from customers c
  left join (
    select customer_id, sum(total_amount) as total
    from invoices
    where is_active = true
    group by customer_id
  ) inv on inv.customer_id = c.id
  left join (
    select customer_id, sum(amount) as total
    from payments
    where is_active = true
    group by customer_id
  ) pay on pay.customer_id = c.id
  where coalesce(inv.total, 0) > 0
  order by (coalesce(inv.total, 0) - coalesce(pay.total, 0)) desc;
$$;
