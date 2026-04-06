# 2차 개발 계획

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
- 모든 변동을 내부적으로 기록하되, 거래처에 보여줄 것만 선택적으로 공개

## 가격 변동 3가지 종류

| 종류 | change_type | 출처 테이블 | 영향 범위 |
|------|-------------|------------|-----------|
| 소비자가 변동 | `consumer` | product_prices (tier level=1) | 모든 거래처 |
| 등급 단가 변동 | `tier` | product_prices (tier level≥2) | 해당 등급 거래처 전체 |
| 특별단가 변동 | `special` | customer_prices | 해당 거래처 1곳 |

## 1단계: DB 테이블 생성

**파일:** `supabase/migrations/20260407_create_price_history.sql`

```sql
create table price_history (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references products(id) on delete cascade,
  change_type text not null check (change_type in ('consumer', 'tier', 'special')),
  tier_id uuid references price_tiers(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  old_price numeric,       -- null이면 신규 등록
  new_price numeric,       -- null이면 삭제
  is_visible boolean default true,  -- 거래처 공개 여부
  created_at timestamptz default now()
);
```

- `tier_id`: consumer/tier 타입일 때 어떤 등급인지
- `customer_id`: special 타입일 때 어떤 거래처인지
- `is_visible`: 체크 = 거래처 페이지에 표시 / 해제 = 내부 기록만

## 2단계: 헬퍼 함수

**파일:** `lib/priceHistory.ts` (신규 생성)

- `recordPriceChange({ product_id, change_type, tier_id?, customer_id?, old_price, new_price })`
- old_price === new_price이면 기록하지 않음 (변동 없음)
- 원가(tier level=0)는 기록하지 않음

## 3단계: 가격 변경 시 이력 기록 (기존 파일 수정)

### 3-1. `app/products/[id]/page.tsx` — 상품 등급 가격 수정

- `originalPrices` 상태 추가: 페이지 로드 시 현재 가격을 숫자로 저장
- `handleSave`에서 각 등급 가격 저장 후 `recordPriceChange` 호출
  - tier.level === 0 → 원가이므로 건너뜀
  - tier.level === 1 → change_type: `'consumer'`
  - tier.level >= 2 → change_type: `'tier'`

### 3-2. `app/customers/[id]/prices/page.tsx` — 특별단가

- `handleAdd`: 추가 성공 후 → old_price: null, new_price: 입력값
- `handleUpdate`: 수정 전 기존값은 `customerPrices` 상태에서 가져옴 → old/new 기록
- `handleDelete`: 삭제 전 → old_price: 기존값, new_price: null

### 3-3. `app/products/new/page.tsx` — 신규 상품 생성

- 초기 가격 등록 시 → old_price: null, new_price: 설정값 (level ≥ 1만)

## 4단계: UI — 이력 표시 컴포넌트

**파일:** `components/PriceHistoryTable.tsx` (신규 생성)

공통 컴포넌트로, 두 곳에서 재사용:

| 표시 항목 | 예시 |
|----------|------|
| 날짜 | 2026-04-01 |
| 종류 배지 | 소비자가 / A등급 / 특별단가 |
| 가격 변동 | 45,000 → 48,000 |
| 공개 여부 체크박스 | ☑ (상품 페이지에서만 수정 가능) |

## 5단계: 이력을 보여주는 곳 2곳

### 5-1. 상품 상세 페이지 (`app/products/[id]/page.tsx`)

- 저장 버튼 아래에 "가격 변동 이력" 섹션 추가
- 해당 상품의 **모든** 이력 표시 (consumer + tier + special)
- 공개 여부 체크박스로 토글 가능 (관리자 뷰)

### 5-2. 거래처 상세 페이지 (`app/customers/[id]/page.tsx`)

- 하단에 "가격 변동 안내" 섹션 추가
- **is_visible = true인 것만** 표시
- 해당 거래처에 관련된 것만 필터:
  - `change_type = 'consumer'` (소비자가는 모두 해당)
  - `tier_id = 거래처의 등급 ID` (등급 단가)
  - `customer_id = 거래처 ID` (특별단가)

## 파일 변경 요약

| 파일 | 작업 | 내용 |
|------|------|------|
| `supabase/migrations/20260407_create_price_history.sql` | 신규 | 테이블 + 인덱스 + RLS |
| `lib/priceHistory.ts` | 신규 | recordPriceChange 헬퍼 |
| `components/PriceHistoryTable.tsx` | 신규 | 이력 표시 공통 컴포넌트 |
| `app/products/[id]/page.tsx` | 수정 | 이력 기록 + 이력 표시 |
| `app/products/new/page.tsx` | 수정 | 초기 가격 이력 기록 |
| `app/customers/[id]/prices/page.tsx` | 수정 | 특별단가 이력 기록 |
| `app/customers/[id]/page.tsx` | 수정 | 거래처별 이력 표시 |

## 구현 순서

1. 마이그레이션 SQL 생성
2. `lib/priceHistory.ts` 헬퍼 생성
3. `app/products/[id]/page.tsx` 이력 기록 추가 → 수동 테스트
4. `app/customers/[id]/prices/page.tsx` 이력 기록 추가
5. `app/products/new/page.tsx` 이력 기록 추가
6. `components/PriceHistoryTable.tsx` 컴포넌트 생성
7. 상품 상세 + 거래처 상세 페이지에 이력 섹션 추가

## 검증 방법

1. 상품 상세에서 소비자가 수정 → price_history에 consumer 레코드 생성 확인
2. 상품 상세에서 등급 단가 수정 → price_history에 tier 레코드 생성 확인
3. 거래처 특별단가 추가/수정/삭제 → price_history에 special 레코드 생성 확인
4. 상품 상세 페이지 하단에 이력 테이블 표시 확인
5. 공개 여부 체크 해제 → 거래처 페이지에서 해당 이력 사라지는지 확인
6. 거래처 페이지에서 해당 등급 + 특별단가 이력만 보이는지 확인
7. `npx next build` 성공 확인
