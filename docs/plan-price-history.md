# 2차 개발 계획

---

## 현재 진행 상태

| 항목 | 상태 |
|------|------|
| 작업 A (상품 옵션 설정 개선) | 미착수 |
| 작업 B Step 1~3 (DB, 이력 기록, 이력 표시) | 구현 완료 (테스트 필요) |
| 작업 B Step 4~5 (주문 시 안내, 명세서 비고) | 다음 세션 |
| 거래처 상세 특별단가 이력 섹션 | 구현 완료 |

---

# [작업 A] 상품 옵션 설정 개선

## 배경
1. 옵션 설정 페이지에서 기존 옵션의 필수여부/가격영향을 수정할 수 없음 (삭제 후 재생성만 가능)
2. 새 상품 등록 후 목록으로 이동해서, 옵션 설정하려면 상품을 다시 찾아야 함

## 변경 내용

### A-1. `app/products/new/page.tsx` — 저장 후 이동 경로 변경
- `router.push('/products')` → `router.push('/products/${product.id}')`
- 상세 페이지에 가면 "옵션 설정" 버튼이 바로 있으니 자연스럽게 연결됨
- 옵션이 없는 상품은 그냥 상세 페이지에서 끝내면 됨

### A-2. `app/products/[id]/options/page.tsx` — 옵션 수정 기능 추가
- 기존 옵션의 **필수여부**, **가격영향** 체크박스 → 토글 가능 + 저장 버튼
- **옵션값(M, S, H 등)은 수정 불가** — 회색 텍스트로 표시만 (input 아님)
  - 이유: 옵션값을 바꾸면 option_prices 테이블의 가격 데이터가 깨짐
  - 옵션값을 바꾸고 싶으면 → 삭제 후 새로 추가 (기존 기능)
- 가격 input에 **쉼표 포맷팅** 추가 (현재 `type="number"`, 쉼표 없음)

## 영향 범위
- 저장 후 이동 경로: 영향 없음 (이동할 페이지만 변경)
- 필수여부/가격영향 수정: 영향 낮음 (새 거래부터 적용)
- 옵션값 이름: 수정 차단하므로 영향 없음
- 쉼표 포맷팅: 영향 없음 (화면 표시만 변경)

## 파일 변경 요약
| 파일 | 변경 |
|------|------|
| `app/products/new/page.tsx` | 1줄: 이동 경로 변경 |
| `app/products/[id]/options/page.tsx` | 필수/가격영향 수정 UI + 쉼표 포맷팅 |

---

# [작업 B] 가격 변동 이력(Price History) 구현 계획

## 배경
- 오랜만에 주문하는 거래처에게 "몇 월부터 가격이 조정되었습니다"를 알리기 위함
- 현재는 가격 수정 시 덮어쓰기 → 이전 가격 기록이 사라짐
- 모든 변동을 내부적으로 기록하고, 거래 입력 시 가격 인상 안내에 활용

## 가격 변동 3가지 종류

| 종류 | change_type | 출처 테이블 | 영향 범위 |
|------|-------------|------------|-----------|
| 소비자가 변동 | `consumer` | product_prices (tier level=1) | 모든 거래처 |
| 등급 단가 변동 | `tier` | product_prices (tier level≥2) | 해당 등급 거래처 전체 |
| 특별단가 변동 | `special` | customer_prices | 해당 거래처 1곳 |

## Step 1: DB 테이블 생성

> **참고:** 실제 DB에는 이미 테이블이 있고, ALTER TABLE로 change_type, customer_id 추가 완료.
> 아래 SQL은 참고용(처음부터 만들 때 기준).

**파일:** `supabase/migrations/20260408_create_price_history.sql`

```sql
create table price_history (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references products(id) on delete cascade,
  change_type text not null check (change_type in ('consumer', 'tier', 'special')),
  tier_id uuid references price_tiers(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  old_price numeric not null,
  new_price numeric not null,
  created_at timestamptz default now()
);
```

- `tier_id`: consumer/tier 타입일 때 어떤 등급인지
- `customer_id`: special 타입일 때 어떤 거래처인지
- `old_price`, `new_price`: 둘 다 필수 (신규 등록은 기록하지 않음, 실제 변경만 기록)
- `is_visible` 없음 — 순수 이력 기록용

## Step 2: 가격 변경 시 이력 자동 기록

**헬퍼 파일:** `lib/priceHistory.ts` (신규 생성)

- `recordPriceChange({ product_id, change_type, tier_id?, customer_id?, old_price, new_price })`
- old_price === new_price이면 기록하지 않음 (변동 없음)
- 원가(tier level=0)는 기록하지 않음
- 상품 신규 등록은 기록하지 않음 (최초 가격 설정)
- 특별단가 추가/삭제는 old_price=0 또는 new_price=0으로 기록

### 이력 기록 대상 페이지 3곳

**2-1. `app/products/[id]/page.tsx` — 소비자가/등급별 가격 수정**
- `originalPrices` 상태 추가: 페이지 로드 시 현재 가격을 저장
- `handleSave`에서 각 등급 가격 저장 후, 이전 가격과 다르면 `recordPriceChange` 호출
  - tier.level === 0 → 원가이므로 건너뜀
  - tier.level === 1 → change_type: `'consumer'`
  - tier.level >= 2 → change_type: `'tier'`

**2-2. `app/customers/[id]/prices/page.tsx` — 특별단가**
- `handleAdd`: old_price=0, new_price=설정한 단가로 기록
- `handleUpdate`: 수정 전 기존값 → old_price, 새 값 → new_price로 기록
- `handleDelete`: old_price=삭제 전 단가, new_price=0으로 기록

**2-3. `app/products/new/page.tsx` — 신규 상품 생성**
- 기록 안 함 (최초 등록이므로 old_price 없음)

## Step 3: 상품 상세 페이지에 이력 표시

상품 상세 페이지(`app/products/[id]/page.tsx`)에 **"가격 변동 이력" 섹션** 추가:

| 표시 항목 | 예시 |
|----------|------|
| 날짜 | 2026-04-01 |
| 종류 배지 | 소비자가 / A등급 / 특별단가(거래처명) |
| 가격 변동 | 45,000 → 48,000 |

- 해당 상품의 **모든** 이력 표시 (consumer + tier + special)
- 내부 관리용이므로 change_type, 등급명 표시 OK

## Step 4: 주문 시 가격 인상 안내 (다음 세션)

거래 입력 시 (AI 주문 인식 + 수동 입력):
- 해당 상품의 최근 가격 변경 이력 확인 (consumer/tier만 대상, special 제외)
- 해당 거래처의 마지막 거래 단가와 현재 적용 단가가 다르면 → 화면에 알림 표시
  - 예: "이 상품은 2026-04-01부터 가격이 변경되었습니다 (10,000원 → 12,000원)"
  - **등급 정보, change_type은 절대 노출하지 않음** (내부 자료)
- 알림 옆에 **"명세서에 표시" 체크박스** 제공
  - 체크하면: 거래 저장 시 비고(note)에 "OO상품 10,000원 → 12,000원 변경" 자동 추가
  - 해제하면: 비고에 넣지 않음

## Step 5: 명세서 비고란에 가격 변동 표시 (다음 세션)

- Step 4에서 비고(note)에 넣은 내용이 명세서에 그대로 표시됨
- 별도 로직 불필요 — 기존 비고 표시 기능 활용

## Step 6: 명세서/거래 안정성 (우선순위 낮음)

- 명세서 생성 시 거래 연결을 DB RPC로 원자적 처리 (중간 실패 방지)
- AI 주문 일괄 저장도 한 번에 insert (현재는 건별 insert → 중간 실패 가능)
- 아직 문제 겪은 적 없으므로 Step 1~5 완료 후 진행

## 이번 세션 구현 범위

**Step 1~3만 구현:**
1. 마이그레이션 SQL 생성
2. `lib/priceHistory.ts` 헬퍼 생성
3. `app/products/[id]/page.tsx` 이력 기록 + 이력 표시 추가
4. `app/customers/[id]/prices/page.tsx` 특별단가 수정 시 이력 기록 추가

**Step 4~5는 다음 세션에서 구현**

## 특별단가 이력 조회 규칙

- 거래처 상세 페이지(`app/customers/[id]/page.tsx`)에서만 조회 가능
- 가격 변동 안내(Step 4)에는 절대 포함하지 않음
- 명세서 비고(Step 5)에도 절대 포함하지 않음

## 거래처 상세 특별단가 이력 표시 형식

- old_price가 0이면: **"특별단가 설정 [new_price]원"** (추가)
- new_price가 0이면: **"특별단가 해제 ([old_price]원)"** (삭제)
- 둘 다 0이 아니면: **"[old_price] → [new_price]원"** (수정)

## 거래처 노출 규칙

거래처에 보이는 모든 안내/명세서에서:
- 소비자가/등급가 변동 사실만 표시 ("OO상품 10,000원 → 12,000원 변경")
- change_type, 등급명, tier 정보는 **절대 노출하지 않음** (내부 자료)

## 파일 변경 요약

| 파일 | 작업 | 내용 |
|------|------|------|
| `supabase/migrations/20260408_create_price_history.sql` | 신규 | 테이블 + 인덱스 |
| `lib/priceHistory.ts` | 신규 | recordPriceChange 헬퍼 |
| `app/products/[id]/page.tsx` | 수정 | 이력 기록 + 이력 표시 |
| `app/customers/[id]/prices/page.tsx` | 수정 | 특별단가 추가/수정/삭제 시 이력 기록 |
| `app/customers/[id]/page.tsx` | 수정 | 특별단가 변동 이력 표시 섹션 추가 |

## 검증 방법

1. 상품 상세에서 소비자가 수정 → price_history에 consumer 레코드 생성 확인
2. 상품 상세에서 등급 단가 수정 → price_history에 tier 레코드 생성 확인
3. 거래처 특별단가 수정 → price_history에 special 레코드 생성 확인
4. 상품 상세 페이지 하단에 이력 테이블 표시 확인
5. 특별단가 추가 시 old_price=0으로 기록되는지 확인
6. 특별단가 삭제 시 new_price=0으로 기록되는지 확인
7. 신규 상품 등록 시 이력이 기록되지 않는지 확인
6. `npx next build` 성공 확인
