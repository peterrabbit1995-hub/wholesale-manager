-- 명세서 생성 + 거래 연결을 하나의 트랜잭션으로 처리
create or replace function create_invoice_with_transactions(
  p_customer_id uuid,
  p_issue_date date,
  p_period_start date,
  p_period_end date,
  p_total_amount numeric,
  p_status text,
  p_transaction_ids uuid[]
)
returns uuid
language plpgsql
as $$
declare
  v_invoice_id uuid;
begin
  -- 1. 명세서 생성
  insert into invoices (customer_id, issue_date, period_start, period_end, total_amount, status)
  values (p_customer_id, p_issue_date, p_period_start, p_period_end, p_total_amount, p_status)
  returning id into v_invoice_id;

  -- 2. 거래에 명세서 ID 연결
  update transactions
  set invoice_id = v_invoice_id
  where id = any(p_transaction_ids)
    and invoice_id is null;

  -- 연결된 건수 확인 (이미 다른 명세서에 연결된 거래가 있으면 롤백)
  if (select count(*) from transactions where id = any(p_transaction_ids) and invoice_id = v_invoice_id)
     != array_length(p_transaction_ids, 1) then
    raise exception '일부 거래가 이미 다른 명세서에 연결되어 있습니다.';
  end if;

  return v_invoice_id;
end;
$$;
