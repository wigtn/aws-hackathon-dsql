# OpenSlot — 처음부터 테스트하는 법 (QA from scratch)

> 두 가지 모드가 있다: **시뮬레이션**(AWS 불필요, 가장 빠름)과 **실 Aurora DSQL**(엔드포인트 env 필요).
> 데모/영상 녹화는 **로컬에서** 하는 게 안정적(서버리스 상태 휘발 회피).

---

## 0. 준비물 (한 번만)

```bash
node -v      # v20+ (개발 환경은 v24)
git --version
# (실 DSQL 모드만) aws CLI v2 + 자격증명
aws --version
aws sts get-caller-identity        # 계정 800445863365 나와야 함
```

## 1. 클론 + 설치

```bash
git clone https://github.com/wigtn/aws-hackathon-dsql.git openslot
cd openslot
npm install
```

## 2. 모드 A — 시뮬레이션 (AWS 없이, 추천 시작점)

```bash
npm run build         # 13+라우트 컴파일 확인
PORT=3100 npm run start
# 브라우저: http://localhost:3100
```
> 3000은 다른 앱이 점유할 수 있어 3100 권장. `.env.local`이 있으면 자동으로 실 DSQL 모드가 되니, **순수 sim을 원하면** `DSQL_ENDPOINT_US_EAST_1= PORT=3100 npm run start`로 비워서 실행.

## 3. 모드 B — 실 Aurora DSQL

```bash
# 1) (최초 1회) 기존 스키마 정리 — proof 스크립트가 남긴 테이블 제거
node scripts/dsql-migrate.mjs

# 2) .env.local 확인 (이미 존재):
#    DSQL_ENDPOINT_US_EAST_1=fjt32vzqea4jm366gb2ssonbiq.dsql.us-east-1.on.aws
#    DSQL_ENDPOINT_US_EAST_2=5rt32vy2c7qvvcptxzxsjjwiji.dsql.us-east-2.on.aws
#    AWS_REGION=us-east-1
npm run build
PORT=3100 npm run start    # 첫 요청이 DSQL에 스키마 생성+시드(수 초)
```
> 화면 좌상단 네비/콘솔에서 데이터플레인은 응답 메타로 확인 가능. `curl localhost:3100/api/demo/run -d '{"capacity":1,"buyers":10,"seed":1}'` → `config.live_data_plane`이 `multi`면 실 멀티리전.

---

## 4. 기능별 수동 테스트 (클릭 + 기대결과)

브라우저에서 순서대로:

### 4.1 홈 = B2B 랜딩 (`/`)
- 기대: "Run a global on-sale without overselling" 헤드라인, 주최자 CTA("Run your on-sale", "Open the console"), 가치카드 4개(Zero oversell / Scalpers priced out / Revenue defended / **Verifiably fair**). **컨슈머 마켓처럼 안 보여야 정상.**

### 4.2 주최자 온보딩 (`/org/onboarding`)
- 조직명·연락처 입력 → 플랜(Self-serve / Enterprise) 선택 → 약관 체크 → "create organizer account" → `/org/console`로 이동, 헤더에 조직명 + "account active".

### 4.3 주최자 콘솔 (`/org/console`) — **데모 핵심**
1. "**+ new drop**" → 제목·프리셋·정원·가격·**오픈 시각(now / +1min / 직접지정)** → 생성.
2. **demo controls** 패널(라벨됨)에서 "**fill to sold out**" → 좌석이 양 리전에서 채워짐, KPI(매출·sell-through) 상승, "writes by region" 분포.
3. "**+ waitlister**" ×2 → "**cancel → re-offer**" → 좌석 ★(잠금오퍼) + 로그 "locked offer to #1".
4. "**▶ simulate the on-sale**" → OC000(막은 더블판매) + **방어매출 $**.
5. **Fairness ledger 패널**: fill 후 체인 채워짐 → "✓ verified", 리전분산. "**simulate tampering**" 클릭 → "✗ tamper detected" + 깨진 seq 빨강.

### 4.4 구매자 흐름 (`/discover` → 이벤트 → 클레임 → 내 티켓)
1. `/discover`에서 검색("indie weekend") / 반경 조절 → 드롭 발견.
2. 라이브 이벤트 클릭 → 좌석맵(상단 "powered by OpenSlot") → 좌석 선택 → "claim".
3. 전화번호 → "send code" → **demo code** 표시 → verify → 좌석 확정(commit latency·OC000·더블판매0 영수증).
4. `/me` → 티켓 + 30초 회전 바코드.

### 4.5 스케줄 오픈 확인
- 미래 오픈 드롭을 만들면 이벤트 페이지에 **카운트다운 + 클레임 잠김**(NOT_OPEN), 시각 도달 시 자동 "on sale".

### 4.6 히어로 데모 (`/demo`)
- 프리셋 "last seat · 2 regions" → "▶ fire stampede" → **Oversold: 0**, OC000, 리전별 p95, 히스토그램. seed 바꿔 재실행해도 oversold 0 고정.

---

## 5. 자동 검증 (객관 증거)

```bash
# 서버 띄운 상태에서:
PORT=3100 npm run verify     # oversold>0면 exit 1. 현재 24/24 PASS
```

## 6. 실 DSQL 크로스리전 증명 (영상용 머니샷)

```bash
node scripts/dsql-setup.mjs
# 24명 동시 양리전 → 1당첨·OC000·oversold 0·강일관 read 출력
```

## 7. API 직접 확인 (선택)

```bash
# 공정원장 + 변조감지
curl "localhost:3100/api/fairness?eventId=ev-kpop-world"          # verified=true
curl "localhost:3100/api/fairness?eventId=ev-kpop-world&tamper=3" # verified=false, broken_at=3
# PII 마스킹 (buyer_id 없어야 함)
curl "localhost:3100/api/claim?eventId=ev-kpop-world" | grep -c buyer_id   # 0
```

---

## 8. 트러블슈팅

| 증상 | 원인/해결 |
|---|---|
| 포트 충돌 | 3000 점유 → `PORT=3100` 사용 |
| 실 DSQL 첫 요청 느림/실패 | 콜드스타트 시드(수 초) — 재요청. 안 되면 `node scripts/dsql-migrate.mjs` 후 재시작 |
| 배포 URL에서 상태가 들쭉날쭉 | 서버리스 인메모리 휘발(여러 람다). **상태 흐름은 로컬에서** 테스트/녹화 |
| OTP 코드 안 보임 | `OPENSLOT_DEMO_OTP=off`면 숨김. 기본은 표시 |
| DSQL 콘솔에 클러스터 안 보임 | 리전을 us-east-1/us-east-2로, 서비스는 "Aurora DSQL", 계정 800445863365 |

## 9. 끝나면 (실 DSQL 썼을 때, 비용 정리)
```bash
# 데모/영상 다 찍은 뒤에만:
aws dsql delete-cluster --region us-east-1 --identifier fjt32vzqea4jm366gb2ssonbiq
aws dsql delete-cluster --region us-east-2 --identifier 5rt32vy2c7qvvcptxzxsjjwiji
```
