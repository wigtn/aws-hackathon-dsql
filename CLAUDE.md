# CLAUDE.md — OpenSlot / H0 Hackathon 컨텍스트

> 이 파일은 심사 룰 + 심사기준 + AWS Aurora DSQL/PostgreSQL **공식 문서 사실**을 한곳에 고정한다.
> PRD(`docs/prd.md`)의 모든 기술 주장은 여기 "공식 사실"과 대조해 검증해야 한다.
> 출처는 각 항목에 링크. 추정/미확인은 ⚠️로 표시.

---

## 1. 해커톤 룰 (H0: Hack the Zero Stack)

- **공식 룰**: https://h01.devpost.com/rules
- **마감**: 2026-06-29 17:00 PT (등록·제출 동시 마감). 심사 6/30–7/24. 발표 ~7/31.
  - ⚠️ PRD 헤더는 "제출 마감 2026-06-29 17:00 PT"로 맞음. (본문 어딘가 6/29와 D11/D12/D13 일정 정합성 재확인)
- **참가자격**: 개인(18+)·팀·조직. 제재국가 거주자/주최측 임직원/심사위원 제외.

### 1.1 필수 기술 스택 (Zero Stack)
- **Frontend**: **Vercel** 또는 **v0.app** 배포 필수.
- **Backend(DB)**: 다음 AWS DB 중 **하나 이상**을 primary로 — **Aurora / Aurora DSQL / DynamoDB**.
  - → OpenSlot은 **Aurora DSQL + Aurora PostgreSQL** 듀얼. 둘 다 허용 목록 내(Aurora 계열). 규정상 OK.
  - ⚠️ "primary database가 AWS DB여야" 한다는 조항 → Vercel 스토리지(KV/Postgres/Blob)를 데이터 SoT로 쓰면 실격 위험. PRD §7 "Vercel 스토리지로 데이터 대체 금지" 준수가 규정 방어.

### 1.2 4개 트랙 (각 트랙별 1/2/3등 시상)
1. **Monetizable B2C App** — 소비자(이커머스·여행·리테일·호스피탈리티)
2. **Monetizable B2B App** — 비즈니스(금융·테크·헬스케어·보험)
3. **Million-Scale Global App** — 게이밍·소셜·**엔터테인먼트** + 글로벌 확장성  ← **OpenSlot 타깃**
4. **Open Innovation** — 스택만 쓰면 무엇이든

### 1.3 제출물 (필수)
- 데모 영상 **< 3분**
- **아키텍처 다이어그램**(백엔드 연결 표시)
- 배포된 **Vercel 링크 + Team ID**
- **AWS DB 스크린샷**(증빙)
- 기능 설명 텍스트
- **보너스**: 빌드 과정 공개 콘텐츠(블로그/영상)로 **최대 +0.6점**

### 1.4 시상
- 트랙별: 1등 $10k+$10k 크레딧 / 2등 $5k+$5k / 3등 $3k+$3k
- **Best Of(크로스트랙)**: Technical / Design / Most Impactful / Most Original 각 $2k+$2k
- **프로젝트당 최대 1개 상**.

---

## 2. 심사기준 (Stage Two — **4개 동등 가중**)

> ⚠️ **중요**: 4개 기준은 **모두 동일 가중**. Technical만 몰빵하면 안 됨. Design/Impact/Originality도 각 25%.

| # | 기준 | 핵심 질문 | OpenSlot 정렬 |
|---|---|---|---|
| 1 | **Technical Implementation** | "genuine software craftsmanship?" + **thoughtful database integration** | ★ 강점. 크로스리전 강일관 더블판매0. DB integration이 명시 평가축 → DSQL 선택 정당화가 직접 득점 |
| 2 | **Design** | 직관적 UX + cohesive full-stack thinking | ⚠️ 상대적 약점. v0 UI 의존. `/demo` 대시보드·좌석맵 UX 완성도 필요 |
| 3 | **Impact & Real-World Applicability** | meaningful problem + 인프라가 viability 뒷받침 | 중간. 티켓팅 스캘핑은 실제 문제+2026 입법. 단 "레드오션"이 약점 |
| 4 | **Originality** | 창의적 컨셉 or 의미있는 진보 | ⚠️ 주의. 티켓팅 자체는 안 새로움. 공정 재방출+신원묶임+한 원장 위 동시성이 originality 무게중심 |

- **보너스 +0.6**: 공개 콘텐츠. 거의 공짜 점수 → **반드시 수행**.

---

## 3. AWS Aurora DSQL — 공식 사실 (PRD 검증용)

> 출처:
> - What is Aurora DSQL: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/what-is-aurora-dsql.html
> - Concurrency control(blog): https://aws.amazon.com/blogs/database/concurrency-control-in-amazon-aurora-dsql/
> - Cluster quotas/limits: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/CHAP_quotas.html
> - Multi-region 구성: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/configuring-multi-region-clusters.html
> - Resilience: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/disaster-recovery-resiliency.html

### 3.1 아키텍처 / 일관성 (DSQL의 단독 무기)
- **Active-active 분산**, **강일관(strong consistency)**, snapshot isolation, ACID.
- 가용성: **단일리전 99.99% / 멀티리전 99.999%**.
- **멀티리전 peered cluster**: 리전당 1개씩 **2개 Regional 엔드포인트**, 둘 다 **동시 read+write 가능**, **단일 논리 DB**, **강일관**.
- **멀티리전 = 동기 크로스리전 복제**로 강일관 유지. → **커밋 지연↑(~크로스리전 RTT)**는 의도된 비용.
- **Witness 리전**: 암호화 트랜잭션 로그의 제한 윈도우 저장, **엔드포인트 없음**, 두 액티브 리전 파티션 시 **쿼럼 타이브레이커**.
- ✅ **PRD 핵심 주장 검증됨**: "Aurora PG(Global DB 포함)는 **비동기** 복제 → 멀티리전 active-active 강일관 **불가**" → 사실. **이것이 '왜 DSQL인가'의 결정적 근거.**

### 3.2 동시성 제어 (OCC)
- **Optimistic Concurrency Control**. 충돌 검출 = **커밋 시점, 서버측**. 락 없음.
- **충돌 에러코드 = `OC000`**. 정확 메시지:
  `ERROR: change conflicts with another transaction, please retry: (OC000)`
  - ✅ PRD가 `40001`→`OC000` 정정한 것 **공식 일치**.
- (참고) DDL 충돌 = **`OC001`**: `ERROR: schema has been updated by another transaction, please retry: (OC001)`. → 시드/인덱스 중 DDL 동시성 처리에 참고.
- **격리수준 = strong snapshot isolation ≈ PostgreSQL repeatable read**. ✅ PRD 일치.
- **고경합 권고(공식)**: 트랜잭션 작게 / **update-in-place보다 append-only** / **기존 키 갱신보다 새 키 도입**. → ✅ PRD의 **row-per-seat 분산**이 정확히 이 권고를 따름.
- **재시도(공식)**: "모든 트랜잭션은 실패 가정·재시도 가능하게 설계" + **exponential backoff + jitter** + 동기화 재시도 방지 위한 randomness. → ✅ PRD H-4(5회·50~500ms 지터 백오프) 정렬.

### 3.3 한도 (공식, 데이터 모델 설계 강제) — quotas 페이지
**클러스터 쿼터**
- 단일리전 클러스터 **20/계정**, 멀티리전 **5/계정**(증설 가능)
- 스토리지 **10 TiB**(승인 시 256 TiB)
- **최대 커넥션 10,000/클러스터**, **커넥션 생성률 100/s**, 버스트 1,000
- CDC 스트림 5/클러스터

**데이터베이스 한도(중요)**
- **PK 컬럼 합 ≤ 1 KiB** / 보조인덱스 키 합 ≤ 1 KiB (`54000 key size too large`)
- **행 크기 ≤ 2 MiB** / 비인덱스 컬럼 ≤ 1 MiB
- **인덱스/PK 컬럼 수 ≤ 8** / 테이블 컬럼 ≤ 255 / **테이블당 인덱스 ≤ 24**
- **쓰기 트랜잭션 변경 데이터 ≤ 10 MiB** (`54000 transaction size limit 10mb`)
- **트랜잭션 블록 변경 행 ≤ 3,000** (`54000 transaction row limit exceeded`)
  - → ✅ PRD가 좌석 사전생성/시드/재방출을 **청크(≤2,000행)** 로 자른 것 정확.
- 쿼리 메모리 ≤ 128 MiB/트랜잭션
- **스키마 ≤ 10**, **테이블 ≤ 1,000**, **DB는 클러스터당 1개**
- **트랜잭션 최대 5분** (`54000 transaction age limit of 300s`)
- **커넥션 최대 60분** → 재연결 필요. ✅ PRD 일치.
- 메시지 ≤ 10 MiB, 뷰 ≤ 5,000, 시퀀스 ≤ 5,000

### 3.4 미지원 PostgreSQL 기능 (PRD 설계 제약의 근거)
- ❌ **외래키(FK) 미지원** → 앱레벨 인가/무결성 필수. ✅ PRD §2 IDOR 방어 = 정확한 대응.
- ❌ **partial index / expression index 미지원** → ✅ PRD H-2가 "released 좌석 NULL 슬롯 재사용으로 partial index 불필요" 설계로 우회한 것 정확.
- ❌ **트리거 / 뷰(일반) / 시퀀스(serial) / 임시테이블 / savepoint 미지원**.
- ❌ **확장(PostGIS/pgvector) 미지원** → ✅ **"왜 Postgres인가"의 결정적 근거**: geo/vector는 Aurora PostgreSQL이 강제됨.
- **보조 인덱스 = 비동기 생성**: 표준 동기 `CREATE INDEX` 대신 **`CREATE INDEX ASYNC`** 사용, 상태는 **`sys.jobs`** 로 폴링해 `ACTIVE` 확인.
  - ✅ PRD H-1("ASYNC 유니크는 ACTIVE 전까지 미보장 → sys.jobs 폴링 후 sale_opens")이 **정확한 공식 패턴**.
  - ⚠️ 주의: 웹 요약본이 "CREATE INDEX ASYNC 미지원"으로 나오기도 하나 이는 요약 오류. DSQL의 **정식 보조인덱스 생성 문법이 ASYNC**다. 그래도 배포 시 콘솔에서 1회 재확인 권장.

### 3.5 멀티리전 가용성 / 페어링 제약 (히어로 데모 리스크)
- 출처: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/region-availability.html (배포 직전 **반드시 재확인**)
- **멀티리전 클러스터는 단일 Region set 내에서만** 생성. **대륙 간 페어 미지원**(예: N.Virginia + Ireland 불가).
- 정규 예제 패턴 = **us-east-1 + us-east-2 + witness us-west-2** (PRD 채택, ✅ 안전한 기본값).
- ⚠️ 지원 리전/페어는 확장 중 → **배포 시점 재확인**. PRD C-2 D0 하드게이트(ACTIVE 멀티리전 스샷 + 2리전 동시클레임 PoC 실패 시 단일리전 폴백 서면확정) = 올바른 리스크 관리.

---

## 4. Aurora PostgreSQL — 발견 평면 (공식 사실)
- PostGIS(공간 반경 `ST_DWithin`/KNN) + pgvector(`hnsw`, 코사인) **지원**. DSQL이 못 하는 영역.
- 멀티리전은 **Aurora Global Database = 비동기 복제**(강일관 active-active 아님). → 좌석 원장에 부적합, 발견용으로만 적합. ✅ PRD 경계설정 정확.
- 듀얼 DB 정당화 한 줄: **"강일관 동시쓰기(DSQL)"와 "geo+vector 확장(PG)"은 단일 엔진에 공존 불가 → 둘 다 필요."**

---

## 5. 검증 결과 요약 (PRD ↔ 공식)
| PRD 주장 | 공식 검증 | 판정 |
|---|---|---|
| OC000 충돌코드 | ✅ 정확 (메시지까지 일치) | PASS |
| repeatable read 스냅샷 | ✅ strong snapshot isolation | PASS |
| row-per-seat(단일키 회피) | ✅ 공식 고경합 권고 일치 | PASS |
| 3,000행/10MiB/5분 한도 → 청크 | ✅ 정확 | PASS |
| 커넥션 60분 재연결 | ✅ 정확 | PASS |
| FK 없음 → 앱레벨 인가 | ✅ 정확 | PASS |
| partial index 불필요 설계 | ✅ partial/expression 미지원 우회 정확 | PASS |
| ASYNC 유니크 + sys.jobs 게이트 | ✅ 공식 패턴, 배포 시 1회 재확인 | PASS(재확인) |
| 멀티리전 동기복제 = 커밋지연 비용 | ✅ 정직한 트레이드오프 | PASS |
| Aurora PG 비동기→강일관 불가 | ✅ 정확 = '왜 DSQL'의 핵심 | PASS |
| 대륙간 페어 제약 | ✅ 사실, 배포 시 재확인 | PASS |

→ **PRD의 DSQL 기술 주장은 공식 문서와 거의 완벽 정합.** 기술 신뢰도는 매우 높음.

---

## 6. 작업 규칙
- DSQL 관련 새 기술 주장 추가 시 → **반드시 §3 공식 사실과 대조**, 미확인은 ⚠️ 표기.
- 심사 메시지/제출물은 **4개 동등가중 기준 전부**를 의식해 균형 작성(Technical 편향 금지).
- 배포 직전 체크: ① 멀티리전 리전 페어 가용성 ② ASYNC 인덱스 문법 ③ Vercel Team ID/링크 ④ AWS 콘솔 스크린샷(시크릿 마스킹) ⑤ 공개 콘텐츠 2~3건(#H0Hackathon, +0.6).
