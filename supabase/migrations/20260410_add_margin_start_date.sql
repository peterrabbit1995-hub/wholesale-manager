-- 마진 계산 시작일 추가
-- 원가가 다 입력된 시점부터 정확한 마진을 계산하기 위함
alter table company_info add column if not exists margin_start_date date;

-- 기존 함수 삭제 (반환 타입 변경 때문에 create or replace 안 됨)
drop function if exists get_dashboard_stats();

-- 대시보드 통계 RPC 재생성: 마진 계산은 시작일 이후 + 원가 있는 거래만 사용
create function get_dashboard_stats()
returns table (
  today_revenue numeric,
  week_revenue numeric,
  month_revenue numeric,
  last_month_revenue numeric,
  month_cost numeric,
  month_margin numeric,
  month_margin_rate numeric,
  margin_start_date date
)
language sql
stable
as $$
  with settings as (
    select margin_start_date from company_info limit 1
  ),
  today as (
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
    select coalesce(sum(total), 0) as revenue
    from transactions
    where order_date >= date_trunc('month', current_date)::date
  ),
  last_month as (
    select coalesce(sum(total), 0) as revenue
    from transactions
    where order_date >= (date_trunc('month', current_date) - interval '1 month')::date
      and order_date < date_trunc('month', current_date)::date
  ),
  -- 마진 계산: 시작일 이후 + 이번 달 거래만, 원가가 입력된 거래만
  this_month_margin as (
    select
      coalesce(sum(total), 0) as revenue,
      coalesce(sum(cost_price * quantity), 0) as cost
    from transactions, settings
    where order_date >= date_trunc('month', current_date)::date
      and (settings.margin_start_date is null or order_date >= settings.margin_start_date)
      and cost_price is not null
      and cost_price > 0
  )
  select
    today.revenue as today_revenue,
    this_week.revenue as week_revenue,
    this_month.revenue as month_revenue,
    last_month.revenue as last_month_revenue,
    this_month_margin.cost as month_cost,
    (this_month_margin.revenue - this_month_margin.cost) as month_margin,
    case
      when this_month_margin.revenue > 0
      then round(((this_month_margin.revenue - this_month_margin.cost) / this_month_margin.revenue * 100)::numeric, 1)
      else 0
    end as month_margin_rate,
    (select margin_start_date from settings) as margin_start_date
  from today, this_week, this_month, last_month, this_month_margin;
$$;
