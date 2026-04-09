# 도매상 관리 시스템 - 마스터 플랜

> **plan 규칙**: 이 파일은 "살아있는 문서"입니다. 작업을 진행하면서 계속 업데이트합니다.
> - 완료된 항목: [x]로 체크
> - 진행 중: [~]로 표시
> - 계획 변경 시: 사유를 적고 수정
> - 새로운 작업 발견 시: 해당 단계에 추가

---

## 현재 상태 요약

**완성된 기능 (Phase 1~4 완료)**
- 로그인/인증 (Supabase Auth)
- 거래처 CRUD + 가격등급 + 특별단가
- 상품 CRUD + 옵션 + 옵션별 가격
- 거래 CRUD (수동입력 + AI 주문인식)
- 명세서 생성/상세 (PNG/PDF 다운로드, 미수금 표시)
- 입금 관리
- 미수금 현황
- 상품 별칭 관리 UI (상품 상세에서 추가/삭제, 전체 별칭 검색 페이지)
- 발송 관리 (대기/완료 탭, 택배사/송장번호/비고, 인라인 편집, 일괄 취소, 안내 메시지 복사)
- 명세서 배송 상태 뱃지 (배송전/부분배송/배송완료)
- 주문 메시지 중복 방지 (order_messages)
- AI 주문인식에서 매칭 상품 변경, 원문 별칭 저장
- 네비게이션 (PC + 모바일 반응형)
- 회사 정보 설정
- 거래 수정/삭제 보호 (명세서 연결 시 UI 잠금 + DB 트리거 SQL 준비됨)
- API 인증 추가 (parse-order)
- AI 빈 응답 에러 처리
- 모바일 메뉴 자동 닫기
- 명세서 시작일 자동 설정 (미연결 거래 중 가장 오래된 날짜)
- 가격 변동 이력 기록 (price_history 테이블, 소비자가/등급가/특별단가)
- 특별단가 이력: action 컬럼(add/update/delete) + 등급 단가 기반 기록
- 상품 상세에 가격 변동 이력 표시
- 거래처 상세에 특별단가 변동 이력 표시
- 거래 입력 시 가격 인상 안내 + "명세서에 표시" 체크박스 (수동/AI 주문 모두)
- 명세서 생성 트랜잭션 처리 (RPC로 원자적 처리)
- AI 주문 일괄 저장 트랜잭션 처리 (RPC로 전체 성공/전체 롤백)
- AI 주문 인식 항목별 비고 입력란
- alert() → 토스트 메시지 전환 (전체 12개 파일)
- 미수금 계산 성능 개선 (RPC `get_receivables`)
- 핵심 비즈니스 로직 테스트 코드 (Vitest, 55개 테스트, mock DB)
- lookupPrice 중복 제거 (`lib/lookupPrice.ts`로 추출, 두 페이지에서 공유)
- 비즈니스 로직 분리: `lib/receivables.ts`, `lib/transactionMath.ts`, `lib/parseOrder.ts`
- 공통 유틸 분리 (`lib/utils.ts`): formatPrice/rawPrice/displayPrice/formatPhone/getName/paramToString/TIER_LEVEL
- DB 에러 무시 수정 (16개 미체크 쿼리에 토스트 안내 추가)
- 가격 조회 경쟁 상태 방지 (lookupCounter ref로 stale 응답 무시)
- useParams() id 배열 방어 (6개 파일에 paramToString 적용)
- 명세서 기간 검증 (시작일 > 종료일 차단)
- 입금액 음수 검증 (0 이하 차단)
- 가격 등급 하드코딩 제거 (TIER_LEVEL.COST/CONSUMER 상수)
- 상품 삭제 보호 (거래 기록 있으면 차단 + 관련 데이터 연쇄 삭제)
- 대시보드 매출/마진 분석 (RPC `get_dashboard_stats`)
- 엑셀 내보내기 (상품/거래처/거래 내역 다운로드, xlsx 라이브러리)
- DB 트리거 실행: 거래 보호(명세서 연결 시 수정/삭제 차단), 발송 수량 초과 방지
- 마진 계산 시작일 설정 (회사 정보 설정에 `margin_start_date`). 대시보드 마진 분석은 이 날짜 이후 + 원가 있는 거래만 사용. 미설정 시 안내 배너 표시
- 주문 인식 일괄 저장 후 draft_data 미삭제 버그 수정 (option C: RPC 직후 delete를 먼저 보내고 상태 초기화. fire-and-forget saveDraft가 늦게 도착해도 items.length===0 경로로 또 한 번 delete 보내므로 안전. 모든 delete에 user_id 필터 추가)
- 전체 테이블 RLS 기본 설정 (14개 테이블에 "인증된 사용자만 접근" 정책. product_aliases/draft_data는 기존 정책 유지)
- 권한 시스템 기반 (user_roles 테이블 + is_admin SECURITY DEFINER 함수 + useRole 훅 + AdminGuard 컴포넌트)
- 메뉴 권한별 필터링 (Navigation에서 admin은 12개 메뉴 전체, staff는 발송만, null은 메뉴 없음)
- 21개 admin 페이지에 AdminGuard 래핑 (직원이 URL 직접 진입해도 데이터 로딩 자체가 안 됨)

---

## 남은 작업: 4일 로드맵

### 1일차: 코드 정리 + 에러 처리 ✅ 완료
> 목표: 전 페이지를 한 번 순회하면서 품질 개선. 이후 작업의 기반.

- [x] **공통 유틸/타입 분리**: `lib/utils.ts`로 통합 (formatPrice, rawPrice, displayPrice, formatPhone, getName, paramToString, TIER_LEVEL)
- [x] **DB 에러 무시 수정**: 16개 미체크 쿼리에 토스트 에러 안내 추가
- [x] **가격 조회 경쟁 상태 방지**: lookupCounter ref로 stale 응답 무시
- [x] **useParams() id 배열 방어**: 6개 파일에 `paramToString` 적용
- [x] **명세서 기간 검증**: 시작일 > 종료일이면 차단
- [x] **입금액 음수 검증**: 0 이하 금액 차단
- [x] **가격 등급 하드코딩 제거**: `TIER_LEVEL.COST` / `TIER_LEVEL.CONSUMER` 상수
- [x] **상품 삭제 시 보호**: 거래 기록 있으면 삭제 차단, 없으면 관련 데이터 연쇄 삭제
- [x] **에러 처리 강화**: 네트워크 실패 시 사용자 친화적 안내 (기존 코드로 충분)

### 2일차: 새 기능 추가 ✅ 완료
> 목표: 매일 쓸 핵심 화면 + 데이터 분석 도구

- [x] **5-1. 대시보드** (RPC `get_dashboard_stats`)
  - 오늘/이번 주/이번 달 매출 요약
  - 마진 분석 (총 마진, 마진율)
  - 지난 달 대비 변화

- [x] **5-3. 엑셀 내보내기** (`/export` 페이지, xlsx 라이브러리)
  - 상품 데이터 다운로드 (등급별 가격, 판매량, 매출액) — RPC `get_product_stats`
  - 거래처 데이터 다운로드 (누적 거래액, 거래 건수, TOP 상품) — RPC `get_customer_stats`
  - 거래 내역 다운로드 (기간 선택)

### 3일차: DB 보안 + 권한 (한 묶음) — 진행 중
> 목표: 직원 투입 전 데이터 보호 완성

- [x] **DB 트리거 실행**: 거래 보호 + 발송 수량 초과 방지 (둘 다 Supabase에서 적용 완료)
- [x] **soft delete 적용**: 거래처/상품/가격등급/명세서/입금에 `is_active` 컬럼 추가, 삭제 → 비활성화. 비활성 상세 페이지에는 안내 배너 표시 + 액션 버튼 비활성화. 복구는 Supabase 콘솔에서 직접
- [x] **RLS 기본 설정**: 인증된 사용자만 데이터 접근 (14개 테이블, `20260412_enable_rls_authenticated.sql`)
- [x] **권한 시스템 기반**: `user_roles` 테이블 + `is_admin()` 함수 + `useRole()` 훅 + `AdminGuard` 컴포넌트 (`20260413_create_user_roles.sql`)
- [x] **권한별 UI 차단 (클라이언트 분기 방식)**:
  - 관리자: 모든 기능
  - 직원: 발송 페이지만 (송장번호 입력, 발송 안내 카톡 복사). 발송 페이지는 원래 단가/금액을 표시하지 않아 가격 노출 없음
  - Navigation 메뉴 필터링 + 21개 admin 페이지에 AdminGuard 래핑
- [ ] **staff 계정 end-to-end 테스트** (회사에서 진행 예정): 임시 직원 계정으로 메뉴 1개만 보이는지, URL 직접 진입 차단되는지, 발송 페이지는 정상 동작하는지 확인

### 4일차: 최적화 (모든 기능 완성 후)
> 목표: 기능 완성 상태에서 UI/성능 다듬기

- [ ] **모바일 UI 최적화**: 터치 영역 확대, 핵심 플로우 모바일 테스트
- [ ] **성능 최적화**: 데이터 로딩 속도 개선, 번들 최적화

---

## 진행 순서

```
Phase 1~3 ────────────── ✅ 완료
    │
Phase 4 (기능완성) ───── ✅ 완료 (별칭, 발송, 가격이력, 안정성)
    │
Phase 5 일부 ─────────── ✅ 완료 (토스트, 미수금 성능)
    │
1일차 (코드정리+에러) ── ✅ 완료
    │
2일차 (새기능) ────────── ✅ 완료 (대시보드, 엑셀 내보내기)
    │
3일차 (DB보안+권한) ──── 거의 완료 (트리거 ✅ soft delete ✅ RLS ✅ 권한 시스템 ✅, staff E2E 테스트만 남음)
    │
4일차 (최적화) ────────── 모바일 UI, 성능
```

---

## 우선순위 판단 기준

1. **매일 쓰는 기능인가?** → 최우선 (대시보드)
2. **돈과 직접 관련 있는가?** → 높음 (매출/마진 분석)
3. **같은 파일을 건드리는 작업끼리 묶기** → 효율 (코드정리+에러처리, DB보안+권한)
4. **기능 완성 후 최적화** → 마지막 (모바일, 성능)

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-04-07 | 최초 작성. 현재 상태 분석 + 4단계 로드맵 수립 |
| 2026-04-07 | 4-0 "거래 수정/삭제 보호" 완료 (UI 잠금 + DB 트리거 SQL 준비) |
| 2026-04-07 | 기술 아키텍처 결정: 백엔드 = Supabase 통일 |
| 2026-04-07 | plan 구조 변경: 백엔드 구축을 Phase 6으로 통합. Phase 4는 기능 완성에 집중 |
| 2026-04-07 | 코드 리뷰 지적사항 10개를 각 Phase에 배치 |
| 2026-04-08 | 코드 리뷰 후속 정리. Phase 6을 6A/6B/6C로 분리 |
| 2026-04-08 | Phase 4 순서 변경: 별칭관리UI를 4-1로 앞당김 |
| 2026-04-08 | 즉시처리(명세서시작일) 완료. 4-3 Step 1~3 완료 |
| 2026-04-09 | Phase 4-3 완료: 특별단가 이력 action, 가격 인상 안내, RPC 트랜잭션(명세서+일괄저장), 항목별 비고, 옵션 미선택 버그 수정 |
| 2026-04-09 | Phase 5-5 미수금 성능 개선 완료 (RPC). Phase 5-6 토스트 전환 완료 (12개 파일) |
| 2026-04-09 | plan 전면 재구성: 남은 작업을 4일 로드맵으로 정리. 5-2 거래처통계 → 보류(엑셀로 대체). 5-3 엑셀업로드 → 엑셀내보내기로 변경. 5-4 이메일발송 → 제외(카톡으로 대체). 5-7 lookupPrice RPC → 보류. 6A+6B를 한 묶음으로, 코드정리+에러처리를 한 묶음으로 재배치 |
| 2026-04-09 | 테스트 프레임워크(Vitest) 도입 + 핵심 로직 테스트 55개 작성. lookupPrice 중복 제거(`lib/lookupPrice.ts`). 비즈니스 로직 분리: `lib/receivables.ts`, `lib/transactionMath.ts`, `lib/parseOrder.ts`. 테스트 항목: 단가 우선순위(8), 미수금 계산(6), 반품/음수 수량(8), AI 파싱(12), 유틸(21). 실제 DB 연결 없이 mock으로만 동작 |
| 2026-04-09 | 1일차 완료: 공통 유틸 분리(`lib/utils.ts` — formatPrice/rawPrice/displayPrice/formatPhone/getName/paramToString/TIER_LEVEL), DB 에러 체크 16개 추가, 가격 조회 경쟁 상태 방지(useRef), useParams id 가드 6개, 명세서 기간/입금액 음수 검증, 가격등급 하드코딩 제거, 상품 삭제 보호(거래 있으면 차단 + 연쇄 삭제) |
| 2026-04-09 | 2일차 완료: 대시보드 매출/마진 분석(RPC `get_dashboard_stats`), 엑셀 내보내기 페이지(`/export`, xlsx 라이브러리, RPC `get_product_stats` + `get_customer_stats`). 네비게이션에 "내보내기" 메뉴 추가 |
| 2026-04-09 | 3일차 일부: DB 트리거 2개 적용 (거래 보호 — 명세서 연결 시 수정/삭제 차단, 발송 수량 초과 방지). 3일차 설계 결정: soft delete 범위(거래처/상품/가격등급/명세서/입금만), 휴지통 페이지 없음(Supabase에서 직접 복구), 직원 권한(발송 페이지만, 가격 정보 차단), 관리자 2명(본인/남편), 역할 확장 가능 설계, 직원 추가는 Supabase 화면에서 직접 |
| 2026-04-10 | 마진 계산 시작일 기능 추가. `company_info.margin_start_date` 컬럼 추가. 대시보드 RPC `get_dashboard_stats` 갱신: 마진 계산은 시작일 이후 + 원가 있는 거래만 사용. 회사 정보 설정 페이지에 입력 필드 추가. 미설정 시 대시보드에 안내 배너 표시. 사유: 원가 입력이 아직 전체 완료 안 돼서 현재 마진 계산이 부정확 |
| 2026-04-09 | 3일차 soft delete 완료. 마이그레이션 `20260411_add_is_active.sql`로 5개 테이블(customers/products/invoices/payments/price_tiers)에 is_active 컬럼 + 부분 인덱스 추가. DELETE 호출 4개를 update is_active=false로 교체(customers/products/invoices/payments). products 자식 연쇄삭제 제거(가격/별칭/옵션 보존). 비활성 상세 페이지에 빨간 배너 + 저장/특별단가/옵션/삭제 버튼 비활성화. 목록·드롭다운·AI파싱·엑셀 내보내기 11개 SELECT에 is_active=true 필터 추가. 이력 보존이 필요한 조인(명세서 상세, 거래 목록 등)은 필터 없음. `get_receivables` RPC 갱신: 비활성 명세서/입금은 미수금에서 제외, 단 거래처는 비활성이어도 미수금 표시. 명세서 상세의 이전 미수금 계산도 동일하게 처리 |
| 2026-04-10 | 엑셀 내보내기 라이브러리(xlsx) 보안 업데이트. 기존 npm 버전(`^0.18.5`)은 Prototype Pollution + ReDoS 취약점 2건(high severity) + 업데이트 중단 상태. SheetJS 공식 CDN 버전(`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`)으로 교체. `package.json`만 수정, 애플리케이션 코드 변경 없음(`app/export/page.tsx` 그대로). `npm audit` 결과 취약점 0개. 사유: 데이터 백업 용도라 서식 기능은 불필요, 마이그레이션 비용 최소화를 위해 exceljs 대신 SheetJS 유지 |
| 2026-04-09 | soft delete 마이그레이션 Supabase에 실제 적용 완료. 거래처 대상 end-to-end 테스트 통과: ① 삭제 → 목록에서 사라짐 ② Supabase에서 `is_active=false` 확인 ③ Supabase에서 `is_active=true`로 복구 → 목록에 다시 표시 ④ 비활성 거래처 URL 직접 진입 시 빨간 배너 + 저장/특별단가 버튼 비활성화 + 삭제 버튼 숨김 모두 정상. 상품/명세서/입금은 동일 코드 패턴이므로 추후 필요 시 동일 방식으로 검증 가능 |
| 2026-04-10 | 주문 인식 페이지 draft_data 미삭제 버그 수정. 원인: blur/onChange로 발사된 fire-and-forget saveDraft(upsert)가 handleSaveAll의 delete보다 늦게 도착해서 행이 다시 생성됨. 해결(option C): RPC 성공 직후 delete를 먼저 보내고 그 다음 setParsedItems([]) 호출. 떠다니던 saveDraft가 늦게 도착해도 items.length===0 경로로 또 한 번 delete 보내므로 멱등으로 안전. 모든 delete에 `eq('user_id', user.id)` 필터 추가 (saveDraft, loadDraft, handleSaveAll 3곳) |
| 2026-04-10 | 3일차 RLS 기본 설정 완료. `20260412_enable_rls_authenticated.sql` Supabase 적용. 14개 테이블에 "authenticated 모두 가능, anon 차단" 정책 (customers/products/product_options/product_prices/option_prices/price_tiers/customer_prices/price_history/transactions/invoices/payments/shipments/company_info/order_messages). product_aliases는 기존 정책 유지, draft_data는 본인 행만 정책 유지. 전체 페이지 동작 테스트 통과 |
| 2026-04-10 | 3일차 권한 시스템 구현. `20260413_create_user_roles.sql`: user_roles 테이블 (user_id PK, role text, RLS는 본인 행만 SELECT 가능), is_admin(uid) SECURITY DEFINER 함수 (3단계 RLS 정책에서 재사용 가능). 관리자 INSERT는 user_id 빈 자리로 두고 Supabase 대시보드에서 직접 채우는 방식. `lib/useRole.ts` 훅 추가 (auth 상태 변경 시 자동 재조회). `components/AdminGuard.tsx` 추가 (loading/admin/그 외 3가지 상태 처리). Navigation에 useRole 적용해서 admin/staff/null별로 메뉴 필터링. 21개 admin 페이지에 AdminGuard 래핑 (XyzPage가 wrapper, XyzPageContent에 원래 로직). 가격 숨기기는 클라이언트 분기 방식 선택 — 발송 페이지는 원래 화면에 단가/금액 표시 안 하므로 추가 작업 없음. staff 계정 end-to-end 테스트는 회사에서 진행 예정 |

---

## 보류 항목

| 항목 | 사유 |
|------|------|
| 5-2 거래처 통계 | 엑셀 내보내기로 대체 가능. 필요 시 대시보드에 추가 |
| 5-7 lookupPrice RPC 통합 | 데스크탑 사용 위주라 체감 적음. 느려지면 그때 |
| 대시보드 부가 (미수금TOP, 발송대기, 베스트셀러) | 이미 전용 페이지 있음. 필요 시 추가 |
| 임시 저장 (draft_data) | 이미 구현됨, 실제 필요성 확인 후 결정 |
| 부분발송 지원 | 당장 불필요. 거래 분할/삭제로 대응 가능 |
| 상품 가격 저장 N+1 개선 | 등급마다 개별 호출 → RPC로 줄일 수 있음 |
| 저장 후 전체 재조회 개선 | 변경된 부분만 업데이트하면 됨 |
| 6C 코드 구조 정리 (Edge Functions, 서버 컴포넌트) | 현재 동작에 문제 없음 |

---

## 제외 항목

| 항목 | 사유 |
|------|------|
| 5-4 명세서 이메일 발송 | 카톡으로 PDF 보내면 충분 |
