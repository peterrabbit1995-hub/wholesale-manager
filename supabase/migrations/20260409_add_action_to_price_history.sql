-- 특별단가 이력에 action(add/update/delete) 구분 컬럼 추가
alter table price_history add column action text check (action in ('add', 'update', 'delete'));
