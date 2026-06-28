# OpenSlot — 라이브 데모 녹화 시나리오 (한글)

제출 영상의 DEMO 챕터에 넣을 **화면 녹화**용 클릭 단위 시나리오.
목표: 약 60~75초 안에 제품이 실제로 동작하는 모습을 네 가지 심사축
(Technical · Design · Impact · Originality)에 걸쳐 보여주기 — 상표 노출 없이,
막히는 곳 없이, 더듬지 않고.

> 영어 대본은 `narration.md`, 영어 시나리오는 `demo-recording-scenario.md` 참고.

---

## 0 · 녹화 전 준비

- **앱을 깨끗한 상태로 실행**
  ```bash
  npm run build && PORT=3000 npm run start
  ```
  (`.env`로 실제 Aurora DSQL 플레인에 붙음. 콜드스타트 시 카탈로그가 가공명으로
  자동 복원됨 — SKYLINE HORIZON, LUMA, PHANTOM 92, DropZone, AURORA NIGHTS.)
- **브라우저**: Chrome, 1440×900 (또는 1920×1080), **확대 100%**, 확장프로그램 바
  숨기기, 북마크 바 숨기기. **시크릿 창**으로 열어 localStorage를 비운 상태로
  시작(“내 티켓”이 깨끗하게 나옴).
- **OS**: 방해금지 모드 ON(알림 차단). 커서 하이라이트 있으면 켜기.
- **녹화기**: 1080p, 30/60fps, 브라우저 콘텐츠 영역만 캡처(탭/주소창 빼면 더 깔끔).
  QuickTime / OBS / CleanShot 무엇이든 OK.
- **상표**: 시드된 가공 이벤트에서만 진행. 실제 브랜드명 타이핑 금지.
- **한 번 리허설**해서 온세일 이벤트가 녹화 시점에 LIVE(오픈) 상태인지 확인.

> 팁: 비트마다 따로 테이크를 찍고 나중에 컷 편집. 각 테이크 시작/끝에 ~1초
> 정지를 두면 컷이 깔끔해짐.

---

## 1 · 샷 리스트 (목표 ~70초)

| # | 경로 | 동작 | 머무름 | 증명하는 것 |
|---|------|------|--------|-------------|
| 1 | `/` | 홈에 랜딩. 히어로 + 네 가지 보증을 천천히 스크롤. | 4초 | Design · 제품 프레이밍 |
| 2 | `/org/console` | 주최자 콘솔 로드. 드롭 선택기에서 **“SKYLINE HORIZON World Tour”** 선택. | 3초 | B2B 고객 |
| 3 | `/org/console` | **“Sell out”**(데모 컨트롤) 클릭. **판매수 / 매출 / 판매율**이 카운트업되고 **좌석맵**이 보라색으로 채워짐. | 6초 | 실제로 살아있음 + 실수치 |
| 4 | `/org/console` | **On-sale health**(✓ 0 double-sold · ✓ 0 failed checkouts · ✓ bots blocked)와 **Verified ✓** 공정배분 카드를 훑기. | 4초 | Impact + Originality |
| 5 | `/discover` | 상단 **Discover** 클릭. 검색창에 **“indie shows this weekend”** 입력 → 카드 재정렬. **“soon”** 카드의 라이브 카운트다운이 줄어드는 것 확인. | 6초 | Aurora PostgreSQL (geo+vector) |
| 6 | `/event/…` | 멀티좌석 라이브 이벤트(예: **SKYLINE HORIZON**) 열기. 빈 좌석 클릭 → **보라색 + ✓**로 바뀜, 회색은 매진. | 5초 | Design · 좌석 피커 |
| 7 | `/claim/…` | **“Get tickets”** 클릭. 전화번호(`+82 10 1234 5678`) 입력 → **Send code** → 데모 코드 표시 → **Verify & get ticket**. | 8초 | 바이어 플로우 엔드투엔드 |
| 8 | claim 결과 | **“Seat #N is yours.”** 도착 — 영수증에 *confirmed in … · double-booked: never*. **View my ticket →** 클릭. | 4초 | 확정 + 더블판매 없음 |
| 9 | `/me` | 티켓에 **30초마다 바뀌는 게이트 코드**(게이지가 줄어드는 것 보기). | 4초 | 안티스캘핑(회전 코드) |
| 10 | `/demo` | 상단 **Proof** 클릭. 프리셋 **“last seat · 2 regions”** → **▶ Fire stampede**. | 3초 | 머니샷 셋업 |
| 11 | `/demo` | 결과 타일 등장: **OVERSOLD 0** · GRANTED 1 · **OC000 ~799** · 800 buyers; 두 리전에서 **us-east-2 p95 ≥ us-east-1**. 큰 **0**에서 멈추기. | 7초 | **Technical — 제로 오버셀, 실제 크로스리전** |

**11번(0 oversold)에서 끝내기** — 아웃트로로 컷백하기 가장 강한 프레임.

---

## 2 · 짧은 컷 (~40초, 시간 빡빡하면)

비트 **3 → 6 → 7/8 → 11**:
콘솔 “Sell out”(숫자 움직임) → 좌석 선택(보라 ✓) → claim → “Seat is yours”
→ fire stampede → **OVERSOLD 0**. 이것만으로도 스토리가 완성됨.

---

## 3 · 선택 보너스 비트 — 드롭 생성 (Design/Impact)

샷 2와 3 사이에 **“+ New drop”** 클릭: 이름 입력(예: *“Night Market Live”*),
**도시 프리셋** 선택, **지도 핀** 드래그(Aurora PostgreSQL 위치),
**open now** 선택, **Create**. 셀프서브 온보딩 + 두 번째 DB의 geo 측면을 보여줌.
약 8초 추가.

---

## 4 · 녹화 후

- 각 테이크 트림 후 ~60~75초 연속 시퀀스로 이어 붙이기.
- 최종 파일을 **`demo-video/public/demo.mp4`**에 두고 알려주면 — `src/scenes/Demo.tsx`의
  스크린샷 몽타주를 `OffthreadVideo`로 교체하고 최종 MP4 한 파일로 재렌더(전체
  **3:00 미만** 유지).
- 또는 편집기에서 래퍼의 DEMO 챕터(1:06–1:24) 위에 직접 얹고 필요한 만큼 늘리기.

> 위에 읽을 내레이션: `narration.md` → “05 · LIVE DEMO” 참고.
