-- 가격 변동 이력 테이블
create table price_history (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references products(id) on delete cascade,
  change_type text not null check (change_type in ('consumer', 'tier', 'special')),
  tier_id uuid references price_tiers(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  old_price numeric not null,
  new_price numeric not null,
  created_at timestamptz default now()
);

-- 상품별 이력 조회용 인덱스
create index idx_price_history_product on price_history(product_id, created_at desc);

-- 거래처별 특별단가 이력 조회용 인덱스
create index idx_price_history_customer on price_history(customer_id, created_at desc);
