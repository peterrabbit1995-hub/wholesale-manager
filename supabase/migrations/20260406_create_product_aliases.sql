-- product_aliases: 상품 별칭(별명) 테이블
-- 예: "클리어 m" → 까무이 클리어 (옵션 M)
-- 예: "통상대" → 롱고니 통상대
create table if not exists product_aliases (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references products(id) on delete cascade,
  alias text not null unique,        -- 별칭 (예: "클리어", "통상대")
  option_snapshot jsonb default null, -- 별칭에 포함된 옵션 (예: {"사이즈": "M"})
  created_at timestamptz default now()
);

-- RLS (Row Level Security)
alter table product_aliases enable row level security;

create policy "Allow authenticated read" on product_aliases
  for select to authenticated using (true);

create policy "Allow authenticated insert" on product_aliases
  for insert to authenticated with check (true);

create policy "Allow authenticated update" on product_aliases
  for update to authenticated using (true);

create policy "Allow authenticated delete" on product_aliases
  for delete to authenticated using (true);
