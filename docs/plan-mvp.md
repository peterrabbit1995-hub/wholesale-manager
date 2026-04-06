# 도매상 관리 시스템 - 1단계 MVP 구현 계획

## Context
요구사항 v1.4 기준 1단계 MVP를 구현한다. 현재 기본 CRUD 골격은 있지만, 가격등급(8단계), 발송관리, 문자인식, 입금관리UI, 대시보드, 가격이력, 별칭시스템, 권한시스템 등 핵심 기능이 빠져있다. DB가 비어있으므로 스키마를 요구사항대로 새로 구성할 수 있다. 명세서는 현재 코드대로 전체 거래 포함 방식을 유지한다.

---

## 단계별 구현 순서

### Step 1: DB 스키마 재구성
Supabase SQL로 전체 테이블을 요구사항 v1.4에 맞게 재생성한다.

**새로 만들 테이블 (5개):**
- `users` - id, email, name, role(admin/staff), created_at
- `price_history` - id, product_id, tier_id, option_value, old_price, new_price, changed_at, reason, created_at
- `product_aliases` - id, product_id, alias, created_at
- `order_messages` - id, customer_id, message_date, original_text, parsed_result(JSONB), confirmed_at, confirmed_by, created_at
- `shipments` - id, transaction_id, shipped_quantity, shipped_at, courier, tracking_number, notified, notified_method, note, created_at

**기존 테이블 수정:**
- `customers`: + default_show_options, created_at, updated_at
- `price_tiers`: + description, is_cost, created_at
- `products`: + created_at
- `product_prices`: + created_at, updated_at
- `transactions`: + shipped_quantity, order_message_id, created_at
- `invoices`: + sent_method, sent_at
- `payments`: + payment_date, note, created_at
- `company_info`: + logo_url

**price_tiers 초기 데이터 (8단계):**
| level | name | is_cost |
|-------|------|---------|
| 0 | 입고가 | true |
| 1 | 소비자가 | false |
| 2 | 당구장가 | false |
| 3 | 공방가 | false |
| 4 | 도매3가 | false |
| 5 | 도매2가 | false |
| 6 | 도매1가 | false |

**파일:** `supabase/schema.sql` (새 파일, Supabase 대시보드에서 실행)

---

### Step 2: 인증/권한 시스템
**수정 파일:**
- `middleware.ts` → Next.js 16 proxy로 전환 검토 + 권한 체크
- `lib/supabase.ts` → 유지 (브라우저 클라이언트)
- `lib/supabase-server.ts` → 새 파일 (서버 클라이언트)
- `components/Navigation.tsx` → role에 따라 메뉴 표시 제한

**구현:**
- Supabase Auth 유지, users 테이블과 연동
- admin: 모든 기능
- staff: 조회 + 송장 입력만

---

### Step 3: 가격 등급 관리 화면
**새 파일:** `app/settings/tiers/page.tsx`

**기능:**
- 8단계 등급 목록 조회
- 등급별 설명 수정
- (향후) 등급 추가/삭제

---

### Step 4: 상품 관리 개선
**수정 파일:**
- `app/products/[id]/page.tsx` - 마진/마진율 자동 표시, 가격 변경 사유 입력, 가격 이력 조회
- `app/products/[id]/options/page.tsx` - 옵션 직접 입력 (현재와 동일, 유지)
- `app/products/new/page.tsx` - 입고가 포함 8단계 가격 입력

**새 파일:**
- `app/products/[id]/aliases/page.tsx` - 별칭 관리 (CRUD)
- `app/products/[id]/history/page.tsx` - 가격 변동 이력 조회 + 거래처 안내 메시지 생성
- `app/products/import/page.tsx` - 엑셀 일괄 업데이트

**핵심 로직:**
- 가격 저장 시 이전 가격과 비교 → price_history에 자동 기록
- 마진 = 판매가 - 입고가, 마진율 = (마진 / 입고가) × 100
- 엑셀 파싱: xlsx 라이브러리 사용

---

### Step 5: 거래처 관리 개선
**수정 파일:**
- `app/customers/page.tsx` - 미수금 현황 표시 추가
- `app/customers/[id]/page.tsx` - default_show_options 설정 추가

**새 파일:**
- `app/customers/[id]/stats/page.tsx` - 누적 통계 (거래액, 건수, TOP 5 상품, 월별 추이)

---

### Step 6: 거래 입력 개선
**수정 파일:**
- `app/transactions/new/page.tsx` - 8단계 등급 대응, 입고가 자동 기록, 옵션 표시 여부 선택
- `app/transactions/[id]/page.tsx` - 발송 상태 표시, 옵션 표시 여부 수정
- `app/transactions/page.tsx` - 필터 추가 (기간별, 거래처별, 발송상태별)

---

### Step 7: 발송 관리
**새 파일:**
- `app/shipments/page.tsx` - 발송 대기/완료 목록
- `app/shipments/new/page.tsx` - 발송 등록 (부분발송 가능, 택배사/송장번호)
- `app/transactions/[id]/shipments/page.tsx` - 거래별 발송 내역

**핵심 로직:**
- 발송 등록 시 transactions.shipped_quantity 자동 업데이트
- shipped_quantity == quantity → 발송완료, 0 < shipped < quantity → 부분발송
- 택배 송장 안내 메시지 생성 (복사용)

---

### Step 8: 문자 주문 자동 인식
**새 파일:**
- `app/orders/message/page.tsx` - 문자 주문 입력 + AI 파싱
- `lib/parse-order.ts` - Claude API 연동 파싱 로직
- `app/api/parse-order/route.ts` - AI 파싱 API Route (서버에서 Claude API 호출)

**핵심 플로우:**
1. 거래처 선택 + 발송일 입력 + 문자 내용 붙여넣기
2. Claude API로 상품명/수량 파싱
3. product_aliases로 별칭 매칭 → 매칭 실패 시 유사 상품 추천
4. 옵션 필수 확인 → 단가 자동 적용
5. 최종 확인 → transactions + order_messages 저장
6. 새 별칭 자동 등록

---

### Step 9: 명세서 개선
**수정 파일:**
- `app/invoices/[id]/page.tsx` - 옵션 표시 여부 반영, sent_method/sent_at 기록, 디자인 개선
- `app/invoices/new/page.tsx` - 유지 (전체 거래 포함 방식)

**새 기능:**
- 이메일 발송 (Resend 또는 Nodemailer)
- `app/api/send-invoice/route.ts` - 이메일 발송 API Route

---

### Step 10: 입금/미수금 관리
**새 파일:**
- `app/payments/page.tsx` - 입금 목록 (거래처별 필터)
- `app/payments/new/page.tsx` - 입금 등록 (거래처, 입금일, 금액, 메모)

**수정 파일:**
- `app/invoices/[id]/page.tsx` - 미수금 계산 로직 개선 (payment_date 기반)

---

### Step 11: 대시보드
**수정 파일:** `app/dashboard/page.tsx` - 현재 링크 4개 → 풀 대시보드

**표시 내용:**
- 오늘/이번 주/이번 달 매출 현황
- 마진 분석 (총 마진, 마진율, TOP 3 / 하위 3)
- 미수금 총액 + 거래처별 미수금 TOP
- 최근 거래 목록
- 발송 대기 목록
- 베스트셀러 / 판매 부진 상품
- 거래처 등급 조정 제안 (3개월 거래액 기반)
- 미발송 명세서 알림

---

### Step 12: Navigation 업데이트
**수정 파일:** `components/Navigation.tsx`

메뉴 항목 추가:
- 홈(대시보드), 거래, 문자주문, 발송, 명세서, 입금, 거래처, 상품, 설정

---

## 공통 사항

### 재사용할 기존 패턴
- `formatPhone()` → `lib/utils.ts`로 통합 (현재 3곳에서 중복)
- Supabase 클라이언트: `lib/supabase.ts` (브라우저)
- 가격 조회 우선순위 체인: `transactions/new/page.tsx`의 `lookupPrice()` → `lib/price-lookup.ts`로 분리

### 추가 패키지
- `xlsx` - 엑셀 파싱/생성
- `resend` 또는 `nodemailer` - 이메일 발송
- `@anthropic-ai/sdk` - Claude API (문자 파싱)

### 파일 구조 변경 요약
```
app/
├── dashboard/page.tsx          ← 대폭 수정
├── login/page.tsx              ← 유지
├── customers/
│   ├── page.tsx                ← 미수금 표시 추가
│   ├── new/page.tsx            ← 유지
│   └── [id]/
│       ├── page.tsx            ← default_show_options 추가
│       ├── prices/page.tsx     ← 유지
│       └── stats/page.tsx      ← 신규
├── products/
│   ├── page.tsx                ← 유지
│   ├── new/page.tsx            ← 8단계 가격
│   ├── import/page.tsx         ← 신규 (엑셀)
│   └── [id]/
│       ├── page.tsx            ← 마진/이력 추가
│       ├── options/page.tsx    ← 유지
│       ├── aliases/page.tsx    ← 신규
│       └── history/page.tsx    ← 신규
├── transactions/
│   ├── page.tsx                ← 필터 추가
│   ├── new/page.tsx            ← 개선
│   └── [id]/
│       ├── page.tsx            ← 발송상태 표시
│       └── shipments/page.tsx  ← 신규
├── orders/
│   └── message/page.tsx        ← 신규 (문자 인식)
├── shipments/
│   ├── page.tsx                ← 신규
│   └── new/page.tsx            ← 신규
├── invoices/
│   ├── page.tsx                ← 유지
│   ├── new/page.tsx            ← 유지
│   └── [id]/page.tsx           ← 이메일 발송 추가
├── payments/
│   ├── page.tsx                ← 신규
│   └── new/page.tsx            ← 신규
├── settings/
│   ├── company/page.tsx        ← 로고 추가
│   └── tiers/page.tsx          ← 신규
├── api/
│   ├── parse-order/route.ts    ← 신규
│   └── send-invoice/route.ts   ← 신규
lib/
├── supabase.ts                 ← 유지
├── supabase-server.ts          ← 신규
├── utils.ts                    ← 신규 (formatPhone 통합)
└── price-lookup.ts             ← 신규 (단가 조회 로직 분리)
components/
└── Navigation.tsx              ← 메뉴 확장
supabase/
└── schema.sql                  ← 신규 (전체 스키마)
```

---

## 검증 방법
1. `npm run dev`로 개발 서버 실행
2. Supabase 대시보드에서 schema.sql 실행 → 테이블 생성 확인
3. 각 기능별로 브라우저에서 CRUD 테스트
4. 문자 인식: Claude API 키 설정 후 테스트 문자 입력
5. 이메일 발송: Resend API 키 설정 후 테스트 발송
6. 모바일 반응형: 브라우저 개발자 도구에서 모바일 뷰 확인
