# PRD — OpenSlot 보강(Remediation) v1.0

> 출처: 독립 code-review(74/100) + 독립 우승확률 평가. 목적 = **유일한 강점축(Technical) 방어 + 최대 드래그(Design/B2B 적합도) 해소 + 듀얼DB 실재화.**
> 정본 우선순위(독립 평가): ① 데모 안정성(버그) ② B2B 프레이밍 ③ 영상 ④ 공개콘텐츠 ⑤ Aurora PG.
> 이 문서의 FR은 모두 **수용기준(AC) + 대상 파일**을 가진다. 구현은 이 문서를 따른다.

---

## 0. 목표 / 비목표

**G1** 실 DSQL 데모가 콜드스타트·동시요청·멀티리전에서 **안 깨진다.**
**G2** Technical 서사의 약한 고리(OC000 수치 불일치·멀티리전 silent degrade) 제거.
**G3** 공개 API가 타인 PII(buyer_id)를 노출하지 않는다.
**G4** 심사위원이 `/`에서 **B2B 인프라 제품**으로 읽는다(컨슈머 마켓 아님).
**G5** 듀얼 DB 실재화(Aurora PG 실 프로비저닝 + 스샷).

**비목표**: 실 결제/정산, 실 인증(세션 봉인은 데모 stub 유지하되 PII 노출만 차단), 풀 모바일 최적화.

---

## 1. 워크스트림 A — Technical 하드닝 (데모 전 필수)

### FR-A1 (C1) 환경변수 단일화 + 멀티리전 정직 표기
- **문제**: `DSQL_ENDPOINT`(demo/run) / `DSQL_ENDPOINT_US_EAST_1`(db.ts) / `_US_EAST_2`(dsql.ts) 3종 혼재. `poolFor`가 리전 엔드포인트 없으면 PRIMARY로 **silent 폴백** → "멀티리전"이 단일리전으로 조용히 강등.
- **해결**:
  - `lib/db.ts`에 단일 기준: `DATA_PLANE = aurora iff DSQL_ENDPOINT_US_EAST_1`. **신규** `export const MULTI_REGION = !!(US_EAST_1 && US_EAST_2)`, `export function activeRegions(): RegionId[]`.
  - `app/api/demo/run/route.ts:46`: `process.env.DSQL_ENDPOINT` → `DATA_PLANE`/`MULTI_REGION` 사용.
  - **(reviewer 추가) `next.config.ts:9`**: `OPENSLOT_DATA_PLANE`도 레거시 `DSQL_ENDPOINT` 기준 → `DSQL_ENDPOINT_US_EAST_1`로 통일. 안 고치면 `_US_EAST_1`만 set 시 DATA_PLANE=aurora인데 배지=sim으로 **표시 거짓**(동종 silent degrade).
  - `lib/db/dsql.ts poolFor`: 리전 엔드포인트 없으면 **silent 폴백 금지** — `MULTI_REGION=false`면 모든 쓰기를 PRIMARY로 보내되, 응답/메트릭에 `region_mode: "single"` 표기.
  - `/api/org/metrics`·`/demo` 응답에 `region_mode`(single|multi) 포함. UI는 single이면 "single-region (multi-region not configured)" 1줄 표기(PRD §9 C-2 서면 폴백 정렬).
- **AC**: 두 엔드포인트 set → claim이 지정 리전 풀로 라우팅, UI "multi-region active". 하나만 set → 동작하되 UI가 "single-region" 정직 표기. **silent degrade 없음.**
- **파일**: `lib/db.ts`, `lib/db/dsql.ts`, `next.config.ts`, `app/api/demo/run/route.ts`, `components/DemoConsole.tsx`, `components/OrgConsole.tsx`

### FR-A2 (C3) **[수정됨 — prd-reviewer]** OCC 결과를 정직하게 라벨링 (OC000 강제 금지)
- **재진단**: 원래안("withOccRetry(BEGIN…COMMIT)로 OC000 실재화")은 **틀렸다.** row-per-seat + 랜덤 좌석 선택은 buyer들이 *서로 다른 행*을 써서 OC000이 안 난다 — 이건 AWS의 "spread updates / 새 키 도입" 권고(CLAUDE.md §3.2)대로 **정상이자 의도된 동작**이다. 낮은 OC000은 버그가 아니다. OC000은 *같은 행 경합*(capacity=1 또는 매진 임박)에서만 빈번. 또한 OC000을 **보여주는 화면 `/demo`는 항상 sim 경로**(`app/api/demo/run`이 새 SeatLedger 생성, DSQL 미경유)라 claim을 고쳐도 화면 수치는 안 바뀐다.
- **해결(수정)**:
  1. **claim 결과를 정직하게 3분류**: `won` / `lost`(rowCount 0 = no-op, OCC 정상 패배 → 재시도) / `conflict`(OC000, 드묾). 현재 `oc000` 카운터는 "no-op 패배"를 OC000으로 오표기하지 않게. `/me`·claim 영수증 라벨을 "lost the race (retried)"와 "OC000 conflict"로 구분.
  2. **withOccRetry 주석↔코드 일치**: claim이 withOccRetry를 안 쓰면 `lib/db.ts`·`dsql-data.ts` 주석의 "wrapped in withOccRetry" 문구를 정정(거짓 주석 제거). 단발 conditional UPDATE는 그 자체로 OCC의 정당한 형태임을 주석화.
  3. **실 OC000 증거는 proof 스크립트가 정본**: `scripts/dsql-setup.mjs`(2-phase 배리어, capacity=1, 실 OC000 23)가 "실 DSQL에서 OC000/더블판매0" 증거. 영상/서사는 "/demo=스톰 시뮬레이터(부하생성), proof 스크립트=실 DSQL에서 같은 보장 성립"으로 **정직 분리**.
  4. **(스트레치, 선택)** capacity=1 drop에 한해 `/api/demo/run`이 실 DSQL 대상으로 proof 로직을 돌리는 옵션 추가 → 대시보드가 **실 OC000** 표시. 미구현 시 proof 스크립트 로그로 대체.
- **AC**: 화면/영수증의 OC000이 **측정 대상을 정확히 반영**(spread claim=낮음 정상, capacity=1 stampede=높음). 거짓 주석 제거. "sim 숫자를 실 DSQL인 척" 하는 서사 없음. (원래 AC "일반 claim OC000>0"은 **폐기** — 그게 오히려 AWS 권고 위반.)
- **파일**: `lib/db/dsql-data.ts`, `lib/db.ts`(주석), `components/ClaimFlow.tsx`/`MyTickets`(라벨), (선택) `app/api/demo/run/route.ts`

### FR-A3 (C4) 시드 멱등 + 멀티인스턴스 레이스 제거
- **문제**: `ensureReady`가 인스턴스 로컬. 동시 콜드스타트 → `DROP TABLE seats` 한복판에 타 인스턴스 INSERT, PK충돌(ON CONFLICT 없음) → 첫 요청 500.
- **해결**:
  - `init()`에서 **`DROP TABLE seats` 제거**(데이터 파괴 금지). 스키마는 `CREATE TABLE IF NOT EXISTS`만. (proof 테이블 타입 불일치는 1회성 수동 마이그레이션으로 분리 — 운영 스크립트.)
  - **분산 시드 락**: `seed_marker(id text PK)` 테이블. 인스턴스가 `INSERT INTO seed_marker VALUES('v1')` 시도 → 성공한 1개만 시드 수행. 충돌(PK)나면 타 인스턴스가 시드 중 → **events 채워질 때까지 폴링: 간격 500ms, 최대 30회(15초), 초과 시 throw가 아니라 `readyPromise=null` 리셋 후 에러 반환**(다음 요청이 재시도).
  - 모든 시드 INSERT(`drop_slots`/`seats`/`waitlist`)를 `insertEvent`처럼 **dup 무시 try/catch**로. (DSQL `ON CONFLICT` 지원 불확실 → try/catch가 정본, ON CONFLICT는 보조.)
  - **(reviewer 추가, 영구 독 방지)** `ensureReady`의 `readyPromise`가 **reject로 캐싱되면 이후 전 요청 영구 실패** → `init()` 실패 시 `readyPromise=null`로 리셋하는 래퍼 필수.
- **(reviewer Critical 추가) FR-A3.1 proof 테이블 스키마 마이그레이션 — 배포 전 1회 필수**
  - **문제**: `DROP TABLE seats`(line 110) 제거 시, 이미 `scripts/dsql-setup.mjs`를 돌린 클러스터엔 **uuid 컬럼 seats**가 남아 있고, 앱 `CREATE TABLE IF NOT EXISTS`는 no-op → 앱의 **text 값 INSERT가 타입 충돌로 500**. **우리 데모 클러스터가 정확히 그 상태**(proof 이미 실행)라 즉시 터진다.
  - **해결**: 배포/시드 전 **1회 운영 스크립트** `scripts/dsql-migrate.mjs`로 `DROP TABLE IF EXISTS seats`(+seed_marker 초기화) 실행. 앱 init은 절대 DROP 안 함. 실행순서(§5)·CI/배포 체크리스트에 게이트로 명문화.
- **AC**: 동시 콜드스타트 다수에서 첫 요청 500 없음. 시드 1회. 재호출 멱등. init 실패가 영구화 안 됨. **배포 전 마이그레이션 1회 실행 확인.**
- **파일**: `lib/db/dsql-data.ts`, `scripts/dsql-migrate.mjs`(신규)

### FR-A4 (M1) 공개 스냅샷 PII 마스킹
- **문제**: `snapshot`/GET `/api/claim`이 `seats`를 `SELECT *`로 반환 → 모든 좌석 `buyer_id`·`reserved_for` 노출.
- **해결**: 스냅샷 좌석을 공개 shape로 매핑: `{ seat_no, section, row_label, status, occupied: !!buyer_id, reserved: reserved_for!=null && reserved_until>now }`. `buyer_id`·`reserved_for` 제거. sim·dsql 양쪽.
  - **(reviewer 추가) OrgConsole 회귀 방지**: `OrgConsole.tsx:220-221`이 같은 GET `/api/claim`을 쓰고 `title=`locked offer → ${s.reserved_for}``로 **buyer_id를 노출** + `data-status=s.reserved_for?...`로 ★ 렌더. 마스킹 후 → ★는 `reserved` 불리언으로, **title은 비식별 텍스트 "locked offer (#1 waitlister)"**로 교체. (org 운영자에게 "누구"가 필요하면 인증된 별도 org 엔드포인트로 분리 — 데모 범위 밖, 비식별 텍스트로 충분.)
  - `SeatMap`은 `occupied`/`status`만 사용(이미 buyer_id 미사용 확인 필요).
- **AC**: 공개 API·GET 응답에 `buyer_id`·`reserved_for` 부재. 좌석맵·콘솔 ★·MyTickets·ClaimFlow 정상(회귀 없음).
- **파일**: `lib/data.ts`(sim snapshot), `lib/db/dsql-data.ts`(snapshot), `app/api/claim/route.ts`, `components/SeatMap.tsx`, `components/OrgConsole.tsx`

### FR-A5 (Majors 묶음) 입력검증·백엔드 패리티·정리
- **M4**: `confirm`/`cancel`에 `seatNo`/`buyerId` 검증(없으면 400). `app/api/claim/route.ts`.
- **M5**: `sweep` 액션을 공개에서 제거(또는 `x-cron-secret` 헤더 가드). cron 용도 명시.
- **M3 패리티**: `createDrop` ID 스킴 sim·dsql 동일화(둘 다 `ev-custom-${Date.now().toString(36)}-slug`). sim `buyerHasActiveSeat` active 집합에 `'sold'` 포함(dsql과 일치).
- **bigint→number**: dsql `snapshot` 좌석의 `reserved_until`/시간 컬럼을 매퍼에서 `Number()`로 정규화(클라 산술 버그 방지). `as unknown as SeatRow[]` 제거하고 명시 매퍼.
- **정리**: `lib/sim/demo.ts`의 죽은 코드 `...(counts ? {} : {})` 제거.
- **AC**: 타입체크·verify 24/24 유지. sim/dsql 동작 일치 스모크 통과.
- **파일**: `app/api/claim/route.ts`, `lib/sim/store.ts`, `lib/sim/engine.ts`, `lib/db/dsql-data.ts`, `lib/sim/demo.ts`

---

## 2. 워크스트림 B — B2B 적합도 프레이밍 (Design/Impact 드래그 해소)

### FR-B1 홈(`/`)을 B2B 랜딩으로 전환
- **문제**: `/`가 구매자 발견 마켓처럼 보임 → "컨슈머 앱?" 의심(Design 0.40 원인).
- **해결**: `/` 히어로를 **비즈니스 가치**로 교체. 카피: *"The on-sale infrastructure for event businesses."* 서브: 초과판매0·반스캘핑·방어매출. 주 CTA 2개: **"Run your on-sale →"**(`/org/onboarding`) / **"See a live drop (buyer view) →"**(`/event/...` 또는 `/discover`). 구매자 발견은 `/discover`로 이동(또는 `/` 하단 "buyer storefront preview" 섹션으로 강등).
- **AC**: `/` 첫 화면이 B2B 인프라 제품(주최자 대상)으로 읽힘. 발견은 부차 데모로 분리.
- **파일**: `app/page.tsx`, (신규) `app/discover/page.tsx`, `components/DiscoverClient.tsx`, `app/layout.tsx`(nav)

### FR-B2 화이트라벨 프레이밍 (구매자 = 주최자 매장)
- **해결**: 구매자 페이지(`/event`,`/claim`,`/me`)에 "powered by OpenSlot" 뱃지/푸터. 이벤트 페이지를 "주최자의 스토어프론트"로 프레이밍(주최자명 강조). 
- **AC**: 구매자 화면이 "OpenSlot 컨슈머 브랜드"가 아니라 "주최자 매장을 OpenSlot이 구동"으로 읽힘.
- **파일**: `app/event/[id]/page.tsx`, `components/ClaimFlow.tsx`, `app/me/page.tsx`, `app/layout.tsx`

### FR-B3 nav/메시지 재정렬 + 제출 텍스트
- nav 리드를 Organizer로. `README.md`/제출 설명 한 줄: *"고객 = 이벤트 비즈니스(과금). 구매자는 주최자 매장에서 무료 거래."* 매출 방어액($)으로 리드.
- **AC**: 네비·문서가 B2B 우선.
- **파일**: `app/layout.tsx`, `README.md`

---

## 3. 워크스트림 C — Aurora PostgreSQL 실재화 (듀얼DB + 2번째 스샷)

### FR-C1 Aurora PG Serverless v2 프로비저닝 (PostGIS + pgvector)
- **해결**: AWS CLI로 VPC(서브넷 2AZ·SG)·Aurora PostgreSQL Serverless v2 클러스터 생성 → `CREATE EXTENSION postgis; CREATE EXTENSION vector;` → `events(venue_geom geography(Point,4326), embedding vector(1024))` + GiST/HNSW 인덱스 → 시드 → **실 `ST_DWithin` + HNSW 쿼리 1회 성공** → **콘솔 스샷**(확장 보이게).
- **AC**: 제출 필수 AWS DB 스샷 2번째 확보. "듀얼 DB 실재" 방어 가능.
- **산출**: `scripts/pg-setup.mjs`, `docs/AWS.md`(PG 섹션)

### FR-C2 (후순위) 발견을 실 PG로 배선 (LAB-43)
- `AURORA_PG_URL` 있으면 `discover`가 실 PostGIS/pgvector 쿼리 사용. 없으면 현행 유지.
- **AC**: 동일 발견 결과 실 DB 재현.

---

## 4. 워크스트림 D — 제출 패키징 (확률 최대 레버)

### FR-D1 데모 영상 3분 (org콘솔 오프닝) — LAB-44
- `docs/DEMO.md` originality 프레이밍: 문제→트레이드오프→DSQL 해소→**라이브 증명**→제품(org콘솔)→공정재방출→회전바코드→아키텍처+AWS 스샷. **0:00–0:40 = `/org/console` + 멀티리전 ACTIVE 콘솔 + oversold=0.**
### FR-D2 공개콘텐츠 2~3건 #H0Hackathon (+0.6) — LAB-41
### FR-D3 손그림 아키텍처 다이어그램 (제출 필수물 + 영상컷)

---

## 5. 실행 순서 (정본)

0. **A3.1 마이그레이션 1회**(`scripts/dsql-migrate.mjs`: 기존 uuid `seats` DROP) — **다른 무엇보다 먼저**. 안 하면 A3가 새 500을 연다.
1. **A1·A3·A4**(데모 안 깨지게: env+next.config·시드레이스+영구독방지·PII+org회귀) — 최우선.
2. **A2**(OCC 정직 라벨링 + 거짓 주석 제거) + **A5**(패리티/정리).
3. **B1·B2·B3**(B2B 프레이밍) — Design/Impact 인식.
4. **C1**(Aurora PG 스샷) — 듀얼DB 실재.
5. **D3 다이어그램 → D1 영상 → D2 콘텐츠**.
6. 각 단계 후 `npm run typecheck && npm run build && npm run verify`(sim) + 실 DSQL 스모크. Vercel 재배포.

> **D1 멀티리전 메모(reviewer M-4)**: 우리는 us-east-1+us-east-2 둘 다 ACTIVE라 `MULTI_REGION=true` → 영상 0:00 "multi-region active" 컷 정상 촬영 가능. 단 클러스터 삭제/리전 이슈로 한쪽이 빠지면 A1이 "single-region" 정직 표기를 띄우므로, **그 경우 영상 히어로는 `scripts/dsql-setup.mjs` 실 OC000 로그 + sim `/demo`로 대체**(CLAUDE.md §C-2 폴백 정렬).

## 6. Linear 매핑 (신규 티켓 후보)
- LAB-51 [P0] Technical 하드닝 A1–A5 (env·OCC·시드레이스·PII·패리티)
- LAB-52 [P0] B2B 프레이밍 B1–B3 (홈 랜딩·화이트라벨·nav)
- LAB-39 [P0] Aurora PG 프로비저닝(기존) — FR-C1
- LAB-43 [P1] 발견 실PG 배선(기존) — FR-C2
- LAB-44/41(기존) — 영상/콘텐츠. (+ 신규) 아키텍처 다이어그램.
