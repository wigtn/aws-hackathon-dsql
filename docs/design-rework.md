# Design Rework — "실제 서비스처럼" 변경 사안

> 목적: 현재 사이트가 **기술 데모/피치 덱**처럼 읽히는 문제를 고친다. 사용자(주최자·구매자) 화면은 **제품 결과(outcome)** 언어만, 기술 서사(DSQL·리전·OC000)는 **두 곳으로만 격리**한다.
> 시각 방향: **On-Sale Poster** 컨셉 채택 (퍼플 주면 + Syne 디스플레이 + 마키 + 플랫 블록). 레퍼런스 목업: `design-samples/concept-poster/` (index / console / demo / discover / style.css).

---

## 0. 핵심 원칙

**"Speak the user's outcome, hide the plumbing."**
사용자 화면에서 아래 용어는 **전면 금지**:
`Aurora DSQL`, `data plane`, `us-east-1/2`, `witness`, `OC000`, `snapshot·OCC`, `writes by region`, `active-active`, `p95`, `pgvector`, `PostGIS`, `discovery model / plane`, `DSQL ledger`, `hash·seq·fp` 테이블.

기술 언어가 **허용되는 곳은 단 두 곳**:
1. 랜딩(`/`) 하단의 작은 **"How it works"** 한 단락
2. **`/demo` 페이지 = "The proof"** (심사 기술점수용 — 여기선 기술 서사 풀가동)

> 해커톤 제약: 심사 4축 중 *"thoughtful database integration"* 이 있으므로 기술 서사를 **삭제하지 말고 분리**한다. 위 2곳에서 DSQL 가치가 충분히 드러나면 기술점수는 방어된다.

honesty 규칙 유지: 방어매출 등 모델값은 반드시 `· est.` 표기.

---

## 1. 글로벌 변경

| 대상 | 파일 | 변경 |
|---|---|---|
| 디자인 시스템 | `app/globals.css` | On-Sale Poster 토큰으로 교체 — `--purple #5a2be6`, `--bright #c9b4ff`, `--cream #f4efe4`, `--ink #161019`; Syne(디스플레이)+Inter(본문)+IBM Plex Mono(데이터). 마키/플랫블록/포스터행 유틸 추가. 기존 "Terminal Editorial" 뉴스프린트 팔레트 대체. |
| 네비게이션 | `app/layout.tsx` | 마키 티커 + nav(Home/Console/Proof/Discover). nav 라벨에서 기술 용어 제거. |
| 푸터 | `app/layout.tsx` | `OpenSlot · the on-sale platform for event businesses` (AWS·리전 줄 제거; `/demo`에만 남김). |
| 신뢰 마크 | `components/PoweredBy.tsx` | "powered by OpenSlot" 수준의 가벼운 마크만. AWS/DSQL 문구 빼기. |

---

## 2. 랜딩 `/` (`app/page.tsx`)

**제거**
- 스펙 카드 `data plane / regions / witness / isolation / conflict / oversell` (6행) 전체
- 히어로 카피의 "Built on Amazon Aurora DSQL"

**교체 카피**
- 마키: `NOW SELLING ● SOLD-OUT ON-SALES THAT DON'T CRASH ● NO OVERSELLING ● NO BOTS ● A FAIR SHOT FOR EVERY FAN ●`
- 키커: `The on-sale platform for event businesses`
- H1: **`Run a sold-out on-sale without the disasters.`**
- 히어로 대형 스탯: `0` + 라벨 `double-sold seats`
- 리드: `OpenSlot powers high-demand ticket sales and product drops for artists, brands and promoters — with no overselling, no bot armies, and no refund nightmares. Even when the whole world shows up at once.`
- 버튼: `Start an on-sale →` (filled) / `See how it works` (ghost → `/demo`)
- 스펙 스트립 → **제품 증명 4점**: `0 double-sold seats` · `0 bot wins` · `A fair shot for every fan` · `Revenue protected, every drop`

**4 보장 행 (포스터 행 레이아웃 유지, 카피 교체)**
| # | 제목 | 본문 | 태그 |
|---|---|---|---|
| 01 | Never sell the same seat twice | Even in a worldwide rush, every seat sells exactly once. No oversells, no refunds, no chargebacks, no furious fans. | Zero oversell |
| 02 | Scalpers and bots priced out | Tickets are tied to a verified person and device, entry codes rotate at the gate, and a cancellation goes to the next real fan — not the fastest bot. | Anti-scalp |
| 03 | Know your numbers in real time | Live sales, sell-through, and the revenue you protected — per drop, as it happens. | $ / drop |
| 04 | Provably fair | Every fan got the same fair shot, in the exact order they arrived — and you can prove it to artists and regulators. | Auditable |

**신규 "How it works" 스트립 (기술 허용 1/2 — 작게, 절제)**
> How it works — OpenSlot keeps one global source of truth for every seat — strongly consistent across the world, on Amazon Aurora DSQL. So two buyers on opposite sides of the planet can never grab the same seat. Zero oversell isn't a policy we promise — it's structurally impossible. [See the cross-region proof →](/demo)

**클로징 CTA**: `Ready to sell out — safely?` + `Start your on-sale →`

---

## 3. 주최자 콘솔 `/org/console` (`components/OrgConsole.tsx`)

**제거**
- "writes by region · active-active" 패널 (us-east-1:4 / us-east-2:5 바) — 하드코딩 토폴로지 포함
- "▶ Fire a worldwide rush" 버튼 (데모 전용 액션 → 콘솔에서 제거)
- 해시 원장 테이블 (seq·seat·region·fp·hash) — 콘솔에서 노출 금지

**교체 / 신규**
- 헤더 밴드: `STRAY HORIZON World Tour` · `On-sale: LIVE` · `Hallyu Touring · KSPO Dome, Seoul` / 액션 `View seat map`, `Pause on-sale`
- KPI(대형 숫자): `Tickets sold 9 / 60` · `Revenue $1,080` · `Sell-through 15%` · `Revenue protected $1,740 · est.`
- (리전 패널 자리) **"On-sale health" 안심 카드** — 체크리스트: `✓ 0 double-sold seats` · `✓ 0 failed checkouts` · `✓ 16 bots blocked` · `✓ Fair allocation verified`
- **Revenue protected 분해**: `Oversell refunds avoided — $780` · `Scalper margin kept in your sale — $960` · `Total protected — $1,740 · est.`
- **Fair allocation 카드(평문)**: 큰 `Verified ✓` + `All 9 buyers got a seat in the exact order they committed — no bot or insider lane.` + 버튼 `Download fairness report` + 작은 링크 `View technical ledger →` (→ `/demo`)
- 좌석맵 카드: 좌석 그리드 + 15% 용량 미터 유지 (sold=퍼플)

> 데이터 매핑: `app/api/org/metrics`는 그대로 두되 UI는 `region`/`region_mode` 같은 내부값을 **사용자에게 표시하지 않음**(health 카드의 평문 체크로 대체). fairness는 `/api/fairness`의 `verified`/`count`만 사용, 해시·seq는 미표시.

---

## 4. 구매자 `/discover` (`components/DiscoverClient.tsx`) + `/event`, `/claim`, `/me`

**제거**
- `Semantic search · pgvector`, `Radius · PostGIS`, `discovery model · ... (Aurora PG pending)`, `live stock joined from the DSQL ledger` 라벨/푸터 노트 전부

**교체**
- 검색: 라벨 `Search events`, placeholder `Concerts, drops, sports near you…`
- 필터: `Within [25 km ▾]` + `Use my location`
- 칩(자연어 예시 유지): `indie shows this weekend`, `k-pop world tour`, `sneaker drops`, `labubu restock`, `cup final`
- 헤더 라인: `6 events near Seoul` + `Sort: Soonest ▾`
- 카드: 제목 · venue·city · live/soon/sold · open count · 거리 · 카테고리 · **가격 추가** · 액션 `Get tickets`(또는 soon이면 `Join the queue`)
  - STRAY HORIZON $120 / Slow Static $35 / LABUBU $45 / Air Jordan $200 / ERAS $180 / Cup Final $90
- `/event`·`/claim`·`/me`도 동일 원칙: 좌석/티켓/회전코드 등 사용자 가치만, 내부 용어 제거

---

## 5. 데모 `/demo` → "The proof" (`app/demo/page.tsx`, `components/DemoConsole.tsx`)

기술 서사 **허용 2/2** — 유지·강화.
- 제목 reframe: `The proof: how OpenSlot guarantees zero oversell`
- 인트로: `Don't take our word for it. Here's the same single seat under a worldwide rush — on real infrastructure.`
- 유지: 프리셋·Fire stampede·`OVERSOLD 0 / GRANTED 1 / OC000 1999 / BUYERS 2000`·리전 p95(41 vs 63ms)·히스토그램·재현성·Aurora DSQL 언급
- 푸터에 AWS/리전 줄은 여기만 유지 가능

---

## 6. 적용 순서 (제안)

1. `globals.css` 토큰 + `layout.tsx`(마키/nav/푸터) — 디자인 시스템 먼저
2. `app/page.tsx` 랜딩 카피·구조 (How it works 스트립 포함)
3. `components/OrgConsole.tsx` — 리전/스탬피드/해시테이블 제거 + health·fairness 평문 카드
4. `components/DiscoverClient.tsx` — 라벨 제거 + 가격/액션 추가
5. `app/demo` — "The proof"로 reframe
6. `/event`·`/claim`·`/me` 잔여 jargon 스윕
7. `npm run typecheck && npm run build` + 실 DSQL 스모크

## 7. 범위 밖 / 주의
- 백엔드·API·DB 로직은 **변경 없음** (UI 카피/표시만). `region_mode`·`fairnessAllocations` 등은 그대로 동작하되 사용자 화면 표시만 정리.
- 실제 결제·인증은 데모 stub 유지.
- 레퍼런스 목업(`design-samples/concept-poster/`)은 **카피·레이아웃의 정본**으로 참고.
