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
- [x] **staff 계정 end-to-end 테스트**: 테스트 직원 계정으로 로그인 후 메뉴 1개(발송)만 보이는지 확인 완료. 권한 시스템 정상 작동

### 4일차: 최적화 (보류 — 향후 개선 항목으로 이동)
> 실사용 후 필요도 판단 예정. 아래 "향후 개선" 섹션 참고.

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
3일차 (DB보안+권한) ──── ✅ 완료 (트리거/soft delete/RLS/권한 시스템/staff E2E 테스트)
    │
배포 준비 ─────────────── ✅ 완료 (lookupPrice 병렬화, 사용설명서)
    │
4일차 (최적화) ────────── 보류 → "향후 개선" 섹션 참고
```

---

## 🛡️ 백업 계획 (집에서 진행 예정) — URGENT

> ⚠️ **현재 상태**: Supabase **Free 플랜**이라 자동 백업 **없음**. 실사용 데이터 손실 시 복구 불가능. **반드시 수동 백업 시스템 구축 필요**.

### 선택된 방식: Option B (자동 백업 스크립트) + 이중 백업

**핵심 아이디어**: Node.js 스크립트가 Supabase REST API로 모든 테이블 데이터를 JSON으로 덤프해서 OneDrive + Google Drive **두 곳에 동시 저장**. Windows 작업 스케줄러로 매일 자동 실행.

### 확인된 정보

- ✅ **OneDrive 경로**: `C:\Users\USER\OneDrive` (회사 컴에서 확인 완료. 집 컴도 동일 경로일 가능성 높음)
- ❓ **Google Drive 경로**: 미확인. 집에서 확인 필요
- ❓ **Supabase 플랜**: Free (업그레이드 안 함)

### 집에서 확인할 것 (체크리스트)

- [ ] **Google Drive 데스크톱 앱 설치 여부**
  - 탐색기 좌측에 "Google Drive (G:)" 같은 드라이브가 보이는지 확인
  - 없으면: https://www.google.com/drive/download/ 에서 무료 설치 (5분)
  - 설치 후 로그인하면 `G:\내 드라이브\` 또는 `G:\My Drive\` 로 접근 가능
- [ ] **Google Drive 폴더 정확한 경로 파악**
  - 예: `G:\내 드라이브\` 또는 `C:\Users\USER\Google Drive\`
- [ ] **OneDrive 경로가 집 컴도 `C:\Users\USER\OneDrive` 인지 확인**

### 집에서 결정할 것

- [ ] **보관 기간** — 며칠 지난 백업은 자동 삭제할지
  - 30일 (추천, 용량 적음)
  - 90일 (더 안전)
  - 1년 (세무 관점 유리)
  - 무제한 (삭제 안 함)
- [ ] **자동 실행 시간** — Windows 작업 스케줄러 기준
  - 아침 8시 (추천, 출근 전)
  - 밤 11시 (퇴근 후)
  - 점심 12시
  - 수동만 (자동 실행 안 함)
- [ ] **암호화 여부**
  - 기본 추천: 암호화 없이 간단하게 (OneDrive/Google Drive 계정 자체가 보안 경계)
  - 원하면 AES 암호화 추가 가능 (복구 시 비밀번호 필요)

### 집에서 만들 것 (Claude에게 시킬 작업)

- [ ] **`scripts/backup.mjs`** 작성
  - Supabase REST API로 모든 테이블 덤프
  - 대상 테이블: `customers`, `products`, `product_options`, `product_prices`, `option_prices`, `price_tiers`, `customer_prices`, `price_history`, `product_aliases`, `transactions`, `invoices`, `payments`, `shipments`, `company_info`, `order_messages`, `user_roles`, `draft_data`
  - 저장 구조: `{백업폴더}/2026-04-11/{테이블명}.json`
  - OneDrive + Google Drive 두 곳에 동시 저장
  - 설정된 보관 기간보다 오래된 폴더 자동 삭제
- [ ] **`scripts/restore.mjs`** 작성 (복구 스크립트)
  - JSON 파일에서 Supabase로 되돌리는 기능
  - 특정 날짜 폴더 지정 가능
  - 안전을 위해 확인 프롬프트 포함 (실수 방지)
- [ ] **Windows 작업 스케줄러 설정**
  - 매일 지정 시간에 `node scripts/backup.mjs` 실행
  - 컴퓨터 꺼져 있으면 다음 부팅 시 실행 옵션 켜기
- [ ] **첫 백업 수동 실행 + 결과 확인**
  - OneDrive/Google Drive 폴더에 실제로 파일 생겼는지 눈으로 확인
  - JSON 파일 하나 열어서 데이터 보이는지 확인
- [ ] **복구 테스트** (중요!)
  - 테스트용 거래처 하나 만들고 백업
  - 그 거래처 삭제
  - 복구 스크립트로 되돌려서 다시 살아나는지 확인

### 추가 안전장치 (지금 당장 할 수 있는 것)

- [ ] **앱의 "내보내기" 메뉴로 엑셀 수동 백업 1회 실행**
  - 로그인 → 상단 메뉴 "내보내기" → 상품/거래처/거래 3개 다운로드
  - Google Drive 또는 OneDrive에 `도매관리_백업_수동/2026-04-11/` 폴더 만들어 저장
  - 스크립트 완성 전까지의 임시 안전장치
  - 이후에도 **매주 금요일 수동 백업** 루틴으로 유지 권장

### 데이터 크기 예상

| 규모 | 1일치 JSON | 1년 누적 |
|---|---|---|
| 현재 (소규모) | ~1-2MB | ~500MB-1GB |
| 성장 후 | ~5-10MB | ~2-4GB |

→ OneDrive 5GB 무료로도 1-2년 충분. Google Drive 15GB면 5년+ 가능.

### 3-2-1 백업 규칙 달성 여부

- **3개의 복사본**: Supabase(원본) + OneDrive + Google Drive = ✅ 3개
- **2개의 서로 다른 매체**: 로컬 PC + 클라우드 = ✅
- **1개는 오프사이트**: OneDrive/Google Drive는 클라우드 = ✅ 자동 달성

### 향후 고려 (사업 규모 커지면)

- Supabase Pro 플랜 업그레이드 ($25/월) — 7일 자동 백업 + PITR
- 매월 1일 SQL 덤프 별도 보관 (완벽한 구조 백업)
- 외장하드에 월 1회 복사 (오프라인 백업)

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
| 2026-04-10 | 3일차 staff E2E 테스트 완료. 회사에서 테스트 직원 계정 생성(Supabase Auth) + user_roles에 'staff' 등록. 로그인 후 Navigation에 발송 메뉴만 표시되는지, 관리자 페이지 URL 직접 진입 시 AdminGuard가 차단하는지, 발송 페이지는 정상 동작하는지 전부 확인 완료. 권한 시스템 production-ready. 4일차(모바일 UI, 성능)는 실사용 후 필요도 판단을 위해 "향후 개선" 섹션으로 이동 |
| 2026-04-10 | 배포 준비 마무리 (1/3): lookupPrice 병렬화 (Option C). `lib/lookupPrice.ts`의 순차 쿼리를 Promise.all로 묶음. Phase 1 병렬 4개(원가 등급ID, 소비자가 등급ID, 특별단가, 옵션 메타) → Phase 2 병렬 N+3개(원가 + 등급 + 소비자 + 옵션별 가격들). 특별단가 적중 시 Phase 2는 원가만 기다리고 종료. 효과: worst case 6~8 round trips → 2 round trips 고정. 함수 시그니처/반환값/우선순위 로직 불변, 테스트 55개 전원 통과, tsc 에러 0. 호출부(`app/transactions/new/page.tsx`, `app/orders/parse/page.tsx`) 수정 불필요. 완전 RPC화는 향후 개선 항목으로 유지 (체감 차이 생기면 진행) |
| 2026-04-10 | 배포 준비 마무리 (2/3): plan.md 정리. 3일차 staff E2E 체크, 4일차(모바일/성능)를 "향후 개선" 섹션으로 이동. "향후 개선" 신설: 성능/최적화(모바일 UI, 번들, N+1, lookupPrice RPC화), 기능 확장(대시보드 부가, 부분발송, draft_data 재평가), 코드 구조(Edge/서버 컴포넌트) |
| 2026-04-10 | 백업 계획 수립. Supabase Free 플랜이라 자동 백업 없음 확인 → 긴급 조치 필요. 선택: Option B(자동 스크립트) + 이중 백업(OneDrive + Google Drive). 회사 컴에서 OneDrive 경로 `C:\Users\USER\OneDrive` 확인 완료. Google Drive 경로는 집 컴에서 확인 예정. 집에서 결정/진행할 항목(보관기간, 실행시간, 암호화, backup.mjs/restore.mjs 작성, 작업 스케줄러 설정, 복구 테스트)을 plan.md 신규 섹션 "🛡️ 백업 계획"에 체크리스트로 정리. 스크립트 완성 전 임시 안전장치로 앱의 엑셀 내보내기 수동 백업 권장 |

---

## 향후 개선

> 실사용 중 불편함이 발견되면 진행. 현재는 기능상 막힘 없음.

### 🔧 성능 / 최적화
- **모바일 UI 최적화**: 터치 영역 확대, 테이블 가로 스크롤, 핵심 플로우(발송/주문 인식/명세서) 모바일 테스트. **우선순위**: 직원이 폰으로 발송 처리 많이 할 경우 최상위
- **번들 사이즈 / 첫 로딩 속도**: xlsx 등 큰 라이브러리 동적 import, 페이지별 측정 후 개선
- **상품 가격 저장 N+1 개선**: 등급마다 개별 INSERT → RPC 하나로 묶기. 상품 등록/수정 페이지 해당
- **저장 후 전체 재조회 개선**: 변경된 부분만 업데이트하면 됨. 대부분 페이지 해당
- **lookupPrice 완전 RPC화**: 현재는 Promise.all로 2 round trips까지 줄였으나, PL/pgSQL RPC로 묶으면 1 round trip 가능. 체감 차이 느껴지면 진행

### 📊 기능 확장
- **대시보드 부가 기능**: 지난달 대비 매출/마진 비교, 미수금 TOP 5, 발송 대기 건수, 베스트셀러. 이미 전용 페이지 있어서 한눈에 보고 싶을 때만
- **부분 발송 지원**: 당장 불필요. 거래 분할/삭제로 대응 가능
- **draft_data 필요성 재평가**: 이미 구현돼 있음. 실제로 잘 안 쓰면 제거

### 🧹 코드 구조
- **Edge Functions / 서버 컴포넌트 활용**: 현재 동작에 문제 없음. 성능 이슈 생기면 검토

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
