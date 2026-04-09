-- AI 주문 일괄 저장을 하나의 트랜잭션으로 처리
create or replace function bulk_insert_transactions(
  p_items jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_results jsonb := '[]'::jsonb;
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into transactions (
      customer_id, product_id, order_date, quantity,
      unit_price, cost_price, total, shipment_status, options, note
    ) values (
      (v_item->>'customer_id')::uuid,
      (v_item->>'product_id')::uuid,
      (v_item->>'order_date')::date,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      (v_item->>'cost_price')::numeric,
      (v_item->>'total')::numeric,
      coalesce(v_item->>'shipment_status', '대기'),
      case when v_item->'options' = 'null'::jsonb then null else v_item->'options' end,
      case when v_item->>'note' = '' then null else v_item->>'note' end
    )
    returning id into v_id;

    v_results := v_results || jsonb_build_object('id', v_id);
  end loop;

  return v_results;
end;
$$;
