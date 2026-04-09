-- 대시보드 통계: 기간별 매출/마진을 한 번에 계산
create or replace function get_dashboard_stats()
returns table (
  today_revenue numeric,
  week_revenue numeric,
  month_revenue numeric,
  last_month_revenue numeric,
  month_cost numeric,
  month_margin numeric,
  month_margin_rate numeric
)
language sql
stable
as $$
  with today as (
    select coalesce(sum(total), 0) as revenue
    from transactions
    where order_date = current_date
  ),
  this_week as (
    select coalesce(sum(total), 0) as revenue
    from transactions
    where order_date >= date_trunc('week', current_date)::date
  ),
  this_month as (
    select
      coalesce(sum(total), 0) as revenue,
      coalesce(sum(cost_price * quantity), 0) as cost
    from transactions
    where order_date >= date_trunc('month', current_date)::date
  ),
  last_month as (
    select coalesce(sum(total), 0) as revenue
    from transactions
    where order_date >= (date_trunc('month', current_date) - interval '1 month')::date
      and order_date < date_trunc('month', current_date)::date
  )
  select
    today.revenue as today_revenue,
    this_week.revenue as week_revenue,
    this_month.revenue as month_revenue,
    last_month.revenue as last_month_revenue,
    this_month.cost as month_cost,
    (this_month.revenue - this_month.cost) as month_margin,
    case
      when this_month.revenue > 0
      then round(((this_month.revenue - this_month.cost) / this_month.revenue * 100)::numeric, 1)
      else 0
    end as month_margin_rate
  from today, this_week, this_month, last_month;
$$;
