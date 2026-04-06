# 당구 용품 도매 거래 관리 시스템 - 구현 계획서

## Context

당구 용품 도매업. 사장님 + 동업자 + 직원 2~3명이 운영.
거래처 ~40곳(주요 10곳), 상품 수백 가지.
거래처별 카톡 그룹채팅에서 주문이 들어오고, 발송 후 명세서를 보내는 흐름.

**핵심 플로우:** 거래처 주문(문자) → 발송 → 명세서 작성 → 입금 대기
**주문 입력:** 문자 내용 복사-붙여넣기 + 거래처 선택 → AI 파싱 → 확인 후 등록
**명세서:** 거래품목+수량+금액+합계 + 미수금 + 총액 → 이미지 저장 → 카톡 전송
**모바일 우선 UI** (향후 주로 핸드폰에서 사용 예정)

**실제 문자 메시지 형식 (불규칙):**
- "까무이애슬리트3개 까무이캐롬h2개 m2개..."
- "까무이클리어 총60개, 까무이 블랙 총50개"
- "롱고니 익스범퍼세트 10개 보내드립니다. 단가 3.9만원으로 올랐어요"
- "아담 통상대 레디얼 4개 10산2개 보내드렸습니다"
- "아담통상대 2개 반품 보냄"
- 공백 없이 붙여쓰기, "총" 접두어, "..." 구분자, 개/자루/세트 등 다양한 단위

---

## 기술 스택

- **Next.js 15** (App Router, TypeScript)
- **Supabase** (PostgreSQL + Auth + Realtime)
- **Tailwind CSS + shadcn/ui**
- **Claude API** (AI 주문 파싱)
- **@react-pdf/renderer** (PDF 명세서)
- **es-hangul** (한글 초성 검색)

---

## 데이터베이스 스키마 (11개 테이블)

### 1. clients (거래처)
```sql
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,                    -- 연락처
  contact TEXT,                  -- 추가 연락처/담당자
  grade TEXT DEFAULT 'normal' CHECK (grade IN ('vip','normal','new')),
  memo TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_clients_name ON clients(name);
```

### 2. products (상품)
```sql
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  base_price INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. product_aliases (상품 별칭)
```sql
CREATE TABLE product_aliases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  alias_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_pa_alias_trgm ON product_aliases USING gin (alias_name gin_trgm_ops);
```
- "까무이애슬리트", "까무이 애슬리트", "카무이애슬" 등을 모두 등록

### 4. orders (주문)
```sql
CREATE TYPE order_status AS ENUM ('confirmed','partial_shipped','shipped','cancelled');

CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status order_status DEFAULT 'confirmed',
  memo TEXT,
  raw_message TEXT,              -- 원본 문자 메시지 보관 (파싱 오류 시 원문 확인용)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
- 사장님이 확인 후 등록하므로 바로 `confirmed` 상태
- `raw_message`: 원본 문자 메시지 보관

### 5. order_items (주문 상품)
```sql
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,         -- ★ soft delete (주문 수정 시)
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 6. shipments (발송)
```sql
CREATE TABLE shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  ship_date DATE NOT NULL DEFAULT CURRENT_DATE,
  courier TEXT,
  tracking_number TEXT,
  memo TEXT,
  is_active BOOLEAN DEFAULT true,         -- ★ soft delete
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 7. shipment_items (발송 상세 - 부분발송용)
```sql
CREATE TABLE shipment_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL REFERENCES order_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 8. payments (입금)
```sql
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  is_prepayment BOOLEAN DEFAULT false,   -- ★ 선입금 여부
  prepayment_memo TEXT,                   -- 선입금 시 해당 상품/사유 기록
  memo TEXT,
  is_active BOOLEAN DEFAULT true,         -- ★ soft delete
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 9. returns (반품) ★ 신규
```sql
CREATE TYPE return_status AS ENUM ('requested','received','processed');

CREATE TABLE returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id),
  order_item_id UUID REFERENCES order_items(id),  -- 원래 주문 항목 연결 (선택)
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL,                      -- 반품 시점 단가 (환불 계산용)
  reason TEXT,
  status return_status DEFAULT 'requested',
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
- 반품 금액은 미수금에서 차감 (amount_effect = -금액)
- 원래 주문 항목과 선택적 연결

### 10. client_product_prices (거래처별 가격)
```sql
CREATE TABLE client_product_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id),
  product_id UUID NOT NULL REFERENCES products(id),
  price INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, product_id)
);
```

### 11. transaction_logs (이벤트 로그)
```sql
CREATE TABLE transaction_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN (
    'order_created','order_updated','order_cancelled',
    'shipment_created','payment_received','payment_updated',
    'return_requested','return_processed',
    'price_changed'
  )),
  ref_id UUID,
  client_id UUID REFERENCES clients(id),
  amount_effect INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 핵심 뷰 & 함수

```sql
-- 미수금 자동 계산 뷰 (★ 발송 금액 기준)
CREATE VIEW client_receivables AS
SELECT
  c.id, c.name, c.phone, c.grade, c.is_active,
  COALESCE(shipped_total, 0) AS total_shipped,
  COALESCE(returns_total, 0) AS total_returned,
  COALESCE(payments_total, 0) AS total_paid,
  COALESCE(shipped_total, 0) - COALESCE(returns_total, 0) - COALESCE(payments_total, 0) AS receivable
FROM clients c
LEFT JOIN (
  -- ★ 발송된 금액만 계산 (주문 금액이 아님)
  SELECT o.client_id, SUM(si.quantity * oi.unit_price) AS shipped_total
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id AND oi.is_active = true
  JOIN shipment_items si ON si.order_item_id = oi.id
  JOIN shipments s ON s.id = si.shipment_id AND s.is_active = true
  WHERE o.status != 'cancelled'
  GROUP BY o.client_id
) st ON st.client_id = c.id
LEFT JOIN (
  SELECT client_id, SUM(quantity * unit_price) AS returns_total
  FROM returns WHERE status = 'processed'
  GROUP BY client_id
) rt ON rt.client_id = c.id
LEFT JOIN (
  -- 일반 입금만 (선입금 제외, 활성 건만)
  SELECT client_id, SUM(amount) AS payments_total
  FROM payments WHERE is_prepayment = false AND is_active = true
  GROUP BY client_id
) pt ON pt.client_id = c.id;

-- 주문 항목별 발송현황 뷰
CREATE VIEW order_item_shipment_status AS
SELECT
  oi.id AS order_item_id, oi.order_id, oi.product_id,
  p.name AS product_name,
  oi.quantity AS ordered_qty,
  COALESCE(SUM(si.quantity), 0) AS shipped_qty,
  oi.quantity - COALESCE(SUM(si.quantity), 0) AS remaining_qty,
  oi.unit_price
FROM order_items oi
JOIN products p ON p.id = oi.product_id
LEFT JOIN shipment_items si ON si.order_item_id = oi.id
LEFT JOIN shipments s ON s.id = si.shipment_id AND s.is_active = true
WHERE oi.is_active = true
GROUP BY oi.id, p.name;

-- 발송 수량 초과 방지 트리거
CREATE FUNCTION validate_shipment_qty() RETURNS TRIGGER AS $$
DECLARE v_ordered INT; v_shipped INT;
BEGIN
  SELECT quantity INTO v_ordered FROM order_items WHERE id = NEW.order_item_id;
  SELECT COALESCE(SUM(si.quantity),0) INTO v_shipped
  FROM shipment_items si
  JOIN shipments s ON s.id = si.shipment_id AND s.is_active = true
  WHERE si.order_item_id = NEW.order_item_id;
  IF (v_shipped + NEW.quantity) > v_ordered THEN
    RAISE EXCEPTION 'Shipment qty exceeds remaining. Ordered: %, Shipped: %, Attempted: %', v_ordered, v_shipped, NEW.quantity;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_shipment BEFORE INSERT ON shipment_items
FOR EACH ROW EXECUTE FUNCTION validate_shipment_qty();

-- 발송 후 주문 상태 자동 업데이트 트리거
CREATE FUNCTION auto_update_order_status() RETURNS TRIGGER AS $$
DECLARE v_order_id UUID; v_total INT; v_shipped INT;
BEGIN
  SELECT order_id INTO v_order_id FROM shipments WHERE id = NEW.shipment_id;
  SELECT SUM(oi.quantity), COALESCE(SUM(s.shipped),0)
  INTO v_total, v_shipped
  FROM order_items oi
  LEFT JOIN (
    SELECT si.order_item_id, SUM(si.quantity) AS shipped
    FROM shipment_items si
    JOIN shipments sh ON sh.id = si.shipment_id AND sh.is_active = true
    GROUP BY si.order_item_id
  ) s
    ON s.order_item_id = oi.id
  WHERE oi.order_id = v_order_id;
  
  UPDATE orders SET status = CASE
    WHEN v_shipped >= v_total THEN 'shipped'
    WHEN v_shipped > 0 THEN 'partial_shipped'
    ELSE status
  END, updated_at = now()
  WHERE id = v_order_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_order_status AFTER INSERT ON shipment_items
FOR EACH ROW EXECUTE FUNCTION auto_update_order_status();

-- 가격 조회 함수 (거래처별 > 기본가)
CREATE FUNCTION get_effective_price(p_client UUID, p_product UUID) RETURNS INTEGER AS $$
  SELECT COALESCE(
    (SELECT price FROM client_product_prices WHERE client_id = p_client AND product_id = p_product),
    (SELECT base_price FROM products WHERE id = p_product)
  );
$$ LANGUAGE sql STABLE;

-- 상품 검색 함수 (별칭 + 유사도) ★ SQL 수정
CREATE FUNCTION search_products(term TEXT) RETURNS TABLE(
  product_id UUID, product_name TEXT, matched_alias TEXT, sim REAL
) AS $$
  WITH product_matches AS (
    SELECT
      p.id,
      p.name,
      COALESCE(pa.alias_name, p.name) AS alias,
      GREATEST(
        similarity(p.name, term),
        COALESCE(similarity(pa.alias_name, term), 0)
      ) AS match_sim,
      ROW_NUMBER() OVER (
        PARTITION BY p.id
        ORDER BY GREATEST(similarity(p.name, term), COALESCE(similarity(pa.alias_name, term), 0)) DESC
      ) AS rn
    FROM products p
    LEFT JOIN product_aliases pa ON pa.product_id = p.id
    WHERE p.is_active AND (
      p.name ILIKE '%'||term||'%' OR pa.alias_name ILIKE '%'||term||'%'
      OR similarity(p.name, term) > 0.2 OR similarity(pa.alias_name, term) > 0.2
    )
  )
  SELECT id, name, alias, match_sim
  FROM product_matches
  WHERE rn = 1
  ORDER BY match_sim DESC
  LIMIT 20;
$$ LANGUAGE sql STABLE;
```

---

## 주문 입력 플로우 (문자 복사-붙여넣기)

```
사장님이 문자 앱에서 주문 메시지 복사
  → 주문 입력 페이지(/orders/new)에서 거래처 선택 (드롭다운 검색)
  → 텍스트 영역에 문자 내용 붙여넣기
  → "분석" 버튼 클릭
  → AI 파싱 (3단계):
      1. 정규식: 상품명+수량 추출
      2. product_aliases + pg_trgm 유사도 매칭
      3. Claude API fallback (매칭 실패 시)
  → 파싱 결과를 주문 항목으로 표시 (수정 가능)
  → 사장님이 확인/수정 후 '주문 등록' 클릭
  → orders 생성 (status='confirmed', raw_message=원본)
```

### 문자 파싱 로직 상세 (`src/lib/ai/order-parser.ts`)

**실제 메시지 패턴 분석 결과:**
```
패턴1: "까무이애슬리트3개"          → 공백 없이 상품+수량 붙음
패턴2: "까무이캐롬h2개 m2개"       → 변형(h, m)이 인라인으로 나열
패턴3: "까무이클리어 총60개"        → "총" 접두어
패턴4: "아담 통상대 레디얼 4개"     → 띄어쓰기 포함 상품명
패턴5: "10산2개"                    → 축약형 (10산 = 10 mountain?)
패턴6: "미츠이가와통컬리 2자루"     → 다양한 단위 (개, 자루, 세트, 대)
```

**파싱 전략:**
1. 줄바꿈/쉼표/"..." 기준으로 메시지 분리
2. 각 조각에서 `/([\w가-힣]+?)\s*(?:총\s*)?(\d+)\s*(개|자루|세트|대|ea|박스)?/g` 패턴으로 추출
3. 추출된 상품명을 `search_products()` RPC로 매칭
4. 매칭 실패 시 Claude API에 원본 + 상품 카탈로그 전달

---

## 페이지 구조

```
src/app/
├── (auth)/login/page.tsx              # 로그인
├── (dashboard)/layout.tsx             # 사이드바 + 헤더 + 모바일 내비
│   ├── dashboard/page.tsx             # 대시보드 (미수금 요약, 확인 대기 주문, 최근 거래)
│   ├── clients/
│   │   ├── page.tsx                   # 거래처 목록 (검색, 등급 필터)
│   │   ├── new/page.tsx               # 거래처 등록
│   │   └── [id]/
│   │       ├── page.tsx               # 거래처 상세 (미수금, 주문이력, 입금이력)
│   │       └── edit/page.tsx          # 거래처 수정
│   ├── products/
│   │   ├── page.tsx                   # 상품 목록 (카테고리 필터)
│   │   ├── new/page.tsx
│   │   ├── upload/page.tsx             # ★ 엑셀 일괄 업로드 (거래처별 시트: 거래처|상품명|가격)
│   │   └── [id]/
│   │       ├── page.tsx               # 상품 상세 (별칭 관리, 거래처별 가격)
│   │       └── edit/page.tsx
│   ├── orders/
│   │   ├── page.tsx                   # 주문 목록 (상태/날짜/거래처 필터)
│   │   ├── new/page.tsx               # ★ 주문 입력 (문자 붙여넣기 + AI 파싱 + 수동 입력)
│   │   └── [id]/
│   │       ├── page.tsx               # 주문 상세 (항목, 발송현황, 로그)
│   │       └── edit/page.tsx          # 주문 수정
│   ├── shipments/
│   │   ├── page.tsx                   # 발송 목록
│   │   └── new/page.tsx               # 발송 등록 (?order_id=xxx)
│   ├── payments/
│   │   ├── page.tsx                   # 입금 목록
│   │   └── new/page.tsx               # 입금 등록
│   ├── returns/                       # ★ 반품 관리
│   │   ├── page.tsx                   # 반품 목록
│   │   └── new/page.tsx               # 반품 등록
│   ├── receivables/page.tsx           # 미수금 대시보드
│   ├── reports/
│   │   ├── sales/page.tsx             # 매출 분석 (기간/상품/거래처별)
│   │   └── statements/page.tsx        # 명세서 생성 (PDF)
│   └── settings/page.tsx              # 시스템 설정
└── api/
    ├── ai/parse-order/route.ts        # AI 주문 파싱 (문자 텍스트 분석)
    └── pdf/
        ├── invoice/route.ts           # 거래 건별 명세서 PDF
        └── statement/route.ts         # 기간별 명세서 PDF
```

---

## 핵심 컴포넌트

```
src/components/
├── layout/
│   ├── sidebar.tsx                    # PC 사이드바 내비게이션
│   ├── header.tsx                     # 상단바
│   └── mobile-nav.tsx                 # 모바일 하단 내비게이션
├── orders/
│   ├── order-form.tsx                 # ★ 주문 입력 폼 (문자 붙여넣기 + 수동 입력 통합)
│   │   ├── 거래처 선택 (검색 가능한 드롭다운)
│   │   ├── 문자 붙여넣기 영역 + "분석" 버튼
│   │   ├── 파싱 결과 ↔ 원본 메시지 나란히 표시
│   │   ├── 매칭 신뢰도 표시 (초록/노랑/빨강)
│   │   ├── 미등록 상품 → '신규 상품 등록' 버튼으로 바로 추가 ★
│   │   └── 수동 항목 추가도 가능
│   ├── order-item-row.tsx             # 주문 항목 행 (상품 검색 + 수량 + 가격)
│   └── parsed-result-card.tsx         # AI 파싱 결과 확인/수정 카드
├── shipments/
│   ├── shipment-form.tsx              # 발송 등록 (잔여 수량 표시)
│   └── remaining-items.tsx            # 미발송 수량 표시
├── returns/
│   └── return-form.tsx                # 반품 등록 폼
├── receivables/
│   └── receivables-summary.tsx        # 거래처별 미수금 카드
└── shared/
    ├── data-table.tsx                 # TanStack Table 래퍼
    ├── search-input.tsx               # 한글 초성 검색 지원
    └── currency-display.tsx           # KRW 포맷
```

---

## 핵심 데이터 플로우

### A. 주문 입력 (문자 복붙 방식)
```
1. /orders/new 페이지 접속
2. 거래처 선택 (드롭다운 검색)
3. 문자 내용 붙여넣기 (텍스트 영역)
4. "분석" 버튼 → AI 파싱
   → 정규식으로 상품명+수량 추출
   → search_products() RPC로 매칭
   → 매칭 실패 시 Claude API fallback
5. 파싱 결과가 주문 항목으로 표시됨
   → 원본 메시지와 나란히 보여줌
   → 매칭 신뢰도 표시 (초록/노랑/빨강)
   → 상품/수량/가격 수정 가능
   → 매칭 실패 항목은 수동 선택
6. 거래처별 가격 자동 적용: get_effective_price()
7. '주문 등록' → INSERT orders (status='confirmed', raw_message=원본)
8. INSERT order_items + INSERT transaction_logs
```

### B. 입금 처리
```
1. /payments/new에서 입금 등록
2. 거래처 선택 → 현재 미수금 표시
3. 금액, 날짜, 메모 입력
4. 선입금 여부 체크 → 선입금이면 해당 상품/사유 메모
5. INSERT payments + INSERT transaction_logs
6. 입금 오류 시: 해당 입금 수정 가능 (is_active=false 후 재입력 or 직접 수정, 이력 남김)
```

### C. 반품 처리
```
1. /returns/new에서 반품 등록
2. 거래처 선택 → 해당 거래처 주문 이력에서 상품 선택 (선택적)
3. 상품, 수량, 사유, 단가 입력
4. INSERT returns (status='requested')
5. 반품 수령 확인 → status='received' → status='processed'
6. processed 시 transaction_logs (type='return_processed', amount_effect=-반품금액)
7. 미수금 자동 차감
```

### D. 전체 발송
```
1. 주문 상세 페이지에서 '전체 발송' 버튼 클릭
2. 택배사, 송장번호 입력 (선택)
3. 시스템이 모든 미발송 항목을 자동으로 shipment_items에 등록
4. order.status → 'shipped'
```

### E. 부분 발송
```
1. /shipments/new?order_id=xxx
2. order_item_shipment_status 뷰에서 잔여 수량 확인
3. 이번 발송 수량 입력 (잔여 이하)
4. 택배사, 송장번호 입력
5. INSERT shipments + shipment_items
6. 트리거가 자동으로 order.status 업데이트 (partial_shipped/shipped)
```

### F. 주문 수정 (발송 전에만 가능)
```
1. 주문 상세에서 '수정' 클릭 (발송 기록이 없는 경우에만 활성화)
2. 수량 변경, 품목 추가/삭제 가능
3. 수정 전 상태를 transaction_logs.details에 JSONB로 저장
4. order_items 직접 수정 (UPDATE/INSERT/soft-delete)
5. INSERT transaction_logs (type='order_updated', details={before, after})
```

---

## 디렉토리 구조 요약

```
wholesale-manager2/
├── supabase/migrations/               # SQL 마이그레이션 파일들
├── public/fonts/                      # NotoSansKR (PDF용 한글 폰트)
├── src/
│   ├── app/                           # Next.js 페이지 (위 구조 참고)
│   ├── components/                    # React 컴포넌트 (위 구조 참고)
│   ├── lib/
│   │   ├── supabase/                  # client.ts, server.ts, middleware.ts, database.types.ts
│   │   ├── actions/                   # Server Actions (clients, products, orders, shipments, payments, returns, auth)
│   │   ├── queries/                   # Server Component 데이터 조회 함수
│   │   ├── ai/
│   │   │   ├── order-parser.ts        # 3단계 파싱 (정규식→DB매칭→Claude)
│   │   │   ├── product-matcher.ts     # 한글 유사도 + 초성 매칭
│   │   │   └── prompts.ts            # Claude API 프롬프트
│   │   ├── pdf/
│   │   │   ├── invoice-template.tsx   # 건별 명세서
│   │   │   └── statement-template.tsx # 기간별 명세서
│   │   ├── hooks/                     # useDebounce, useRealtime
│   │   ├── validators/               # Zod 스키마
│   │   └── utils/                     # format.ts, hangul.ts
│   └── types/                         # TypeScript 타입 정의
├── middleware.ts                       # Supabase Auth 가드
└── .env.local                         # SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY
```

---

## 패키지 의존성

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0.5",
    "@react-pdf/renderer": "^4",
    "@tanstack/react-table": "^8",
    "@anthropic-ai/sdk": "^0.39",
    "es-hangul": "^1",
    "xlsx": "^0.18",
    "zod": "^3",
    "date-fns": "^4",
    "lucide-react": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest"
  }
}
```

---

## 구현 순서

### Phase 1: 기반 (1~3일)
- Next.js 프로젝트 초기화 + shadcn/ui 설치
- Supabase 프로젝트 + 전체 DB 마이그레이션 실행
- 인증 (Supabase Auth + middleware)
- 레이아웃 (사이드바, 헤더, 모바일 내비)
- 로그인 페이지

### Phase 2: 기본 CRUD (4~6일)
- 거래처 관리 (등록/수정/검색/비활성화)
- 상품 관리 (등록/수정/별칭관리/검색)
- ★ 엑셀 일괄 업로드 (거래처별 시트 → 상품+거래처별 가격 일괄 등록)
- 거래처별 가격 설정
- 공통 컴포넌트 (data-table, search-input, currency-display)

### Phase 3: 거래 핵심 (7~10일)
- 수동 주문 입력 (상품 검색 + 자동 가격)
- 주문 목록/상세/수정/취소
- 발송 등록 (부분 발송 + 잔여 수량)
- 입금 등록 + 목록
- 반품 등록 + 처리
- transaction_logs 기록

### Phase 4: AI 주문 파싱 (11~13일)
- 문자 텍스트 파싱 로직 (정규식 → DB매칭 → Claude fallback)
- 파싱 결과 UI (원본 ↔ 결과 비교, 신뢰도 표시, 수동 수정)
- /api/ai/parse-order 엔드포인트

### Phase 5: 보고서 + 분석 (14~16일)
- 미수금 대시보드
- 매출 분석 (기간/상품/거래처)
- PDF 명세서 (건별/기간별)
- 대시보드 (통계 요약)

### Phase 6: 마무리 (17~19일)
- 모바일 우선 반응형 최적화 (핸드폰에서 주력 사용)
- 명세서 이미지 저장 기능 (카톡 전송용)
- 에러 처리 + 로딩 상태
- 배포 (Vercel + Supabase Cloud)

---

## 검증 방법

1. **DB 무결성**: 발송 수량 초과 방지 트리거 테스트
2. **미수금 계산**: 주문→발송→입금→반품 시나리오 후 client_receivables 뷰 확인
3. **SMS 파싱**: 스크린샷의 실제 메시지들로 파싱 정확도 테스트
4. **부분 발송**: 주문 10개 중 3개 발송 → 상태 partial_shipped → 나머지 7개 발송 → shipped 확인
5. **반품 → 미수금 차감**: 반품 처리 후 미수금 감소 확인
6. **PDF 생성**: 한글 폰트 정상 렌더링, 금액 포맷 확인
7. **모바일**: 주요 페이지 모바일 브라우저 확인
