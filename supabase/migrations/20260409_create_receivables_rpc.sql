-- 거래처별 미수금을 DB에서 한 번에 계산
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
    group by customer_id
  ) inv on inv.customer_id = c.id
  left join (
    select customer_id, sum(amount) as total
    from payments
    group by customer_id
  ) pay on pay.customer_id = c.id
  where coalesce(inv.total, 0) > 0
  order by (coalesce(inv.total, 0) - coalesce(pay.total, 0)) desc;
$$;
