-- 명세서에 연결된 거래는 수정/삭제 차단
-- 예: 명세서를 보낸 뒤 거래 금액을 바꾸면 → 명세서 금액과 안 맞음 → 미수금 틀어짐
-- 수정하려면 명세서를 먼저 삭제해야 함

create or replace function prevent_invoiced_transaction_change()
returns trigger as $$
begin
  -- 삭제 시: 명세서 연결된 거래는 삭제 차단
  if TG_OP = 'DELETE' then
    if OLD.invoice_id is not null then
      raise exception '명세서에 포함된 거래는 삭제할 수 없습니다. 명세서를 먼저 삭제해주세요.';
    end if;
    return OLD;
  end if;

  -- 수정 시: 명세서 연결된 거래의 금액 관련 필드 변경 차단
  if TG_OP = 'UPDATE' then
    -- invoice_id를 해제하는 것은 허용 (명세서 삭제 시 연결 해제)
    if OLD.invoice_id is not null and NEW.invoice_id is not null then
      if OLD.quantity is distinct from NEW.quantity
        or OLD.unit_price is distinct from NEW.unit_price
        or OLD.total is distinct from NEW.total
        or OLD.product_id is distinct from NEW.product_id
        or OLD.customer_id is distinct from NEW.customer_id
        or OLD.order_date is distinct from NEW.order_date then
        raise exception '명세서에 포함된 거래는 수정할 수 없습니다. 명세서를 먼저 삭제해주세요.';
      end if;
    end if;
    return NEW;
  end if;

  return NEW;
end;
$$ language plpgsql;

-- 트리거 연결
drop trigger if exists trg_protect_invoiced_transaction on transactions;

create trigger trg_protect_invoiced_transaction
  before update or delete on transactions
  for each row
  execute function prevent_invoiced_transaction_change();
