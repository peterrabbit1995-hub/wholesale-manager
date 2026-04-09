-- 거래처별 통계: 누적 거래액, 거래 건수, 가장 많이 주문한 상품
create or replace function get_customer_stats()
returns table (
  customer_id uuid,
  customer_name text,
  total_amount numeric,
  transaction_count bigint,
  top_product text,
  top_product_qty bigint
)
language sql
stable
as $$
  with customer_totals as (
    select
      c.id as customer_id,
      c.name as customer_name,
      coalesce(sum(t.total), 0) as total_amount,
      count(t.id) as transaction_count
    from customers c
    left join transactions t on t.customer_id = c.id
    group by c.id, c.name
  ),
  customer_top_product as (
    select distinct on (t.customer_id)
      t.customer_id,
      p.name as top_product,
      sum(t.quantity) over (partition by t.customer_id, t.product_id) as top_product_qty
    from transactions t
    join products p on p.id = t.product_id
    order by t.customer_id, top_product_qty desc
  )
  select
    ct.customer_id,
    ct.customer_name,
    ct.total_amount,
    ct.transaction_count,
    coalesce(ctp.top_product, '-') as top_product,
    coalesce(ctp.top_product_qty, 0::bigint) as top_product_qty
  from customer_totals ct
  left join customer_top_product ctp on ctp.customer_id = ct.customer_id
  order by ct.total_amount desc;
$$;

-- 상품별 통계: 판매량, 매출액
create or replace function get_product_stats()
returns table (
  product_id uuid,
  product_name text,
  total_quantity bigint,
  total_revenue numeric
)
language sql
stable
as $$
  select
    p.id as product_id,
    p.name as product_name,
    coalesce(sum(t.quantity), 0)::bigint as total_quantity,
    coalesce(sum(t.total), 0) as total_revenue
  from products p
  left join transactions t on t.product_id = p.id
  group by p.id, p.name
  order by p.name;
$$;
