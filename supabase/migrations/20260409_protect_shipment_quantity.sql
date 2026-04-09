-- 발송 수량이 주문 수량을 초과하지 못하도록 차단
-- 예: 주문 수량 10개인데 실수로 15개 발송 → 차단

create or replace function prevent_shipment_overquantity()
returns trigger as $$
declare
  order_qty int;
  total_shipped int;
begin
  -- 주문 수량 조회
  select quantity into order_qty
  from transactions
  where id = NEW.transaction_id;

  if order_qty is null then
    raise exception '거래를 찾을 수 없습니다.';
  end if;

  -- 기존 발송 수량 합계 (자기 자신은 제외)
  select coalesce(sum(shipped_quantity), 0) into total_shipped
  from shipments
  where transaction_id = NEW.transaction_id
    and id is distinct from NEW.id;

  -- 새로 추가/수정될 수량까지 합산
  if total_shipped + NEW.shipped_quantity > order_qty then
    raise exception '발송 수량이 주문 수량을 초과합니다. 주문: %개, 기존 발송: %개, 추가 시도: %개',
      order_qty, total_shipped, NEW.shipped_quantity;
  end if;

  return NEW;
end;
$$ language plpgsql;

-- 트리거 연결 (insert + update 시 검사)
drop trigger if exists trg_prevent_shipment_overquantity on shipments;

create trigger trg_prevent_shipment_overquantity
  before insert or update on shipments
  for each row
  execute function prevent_shipment_overquantity();
