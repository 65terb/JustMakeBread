# Track 1 로드맵

현재 사용자-facing 게임 제목은 정확히 `Just Make BREAD!`이다. 이전 `Just Make Bread`는 역사적 결정 기록으로만 보존하며, Git 저장소 slug `Just-Make-Bread`, package name, Vercel project/domain, source IDs, routes, assets, and exports는 변경하지 않는다.

이 문서는 일정·범위·작업 라우팅을 위한 내부 로드맵이다. 최종 게임 규칙은 `docs/DECISIONS.md`와 `docs/GAME_DESIGN_TRACK1.md`가 우선하며, `docs/EXECUTION_PLAN.md`는 이 로드맵의 단계별 실행 순서를 따른다. 로그 문서는 검증 증거이며 완료 판정의 최종 근거가 아니다.

현재 집행 개정은 `2026-08-09 카메라·장르·아트 방향 감사`와 이후 사용자 비교 피드백을 반영한다. B+ family 방향 자체는 사용자 피드백으로 채택됐으며, 아직 사람에게 남은 gate는 `bplus-ortho`·`bplus-balanced`·`bplus-perspective` 중 최종 projection, shallow Z 폭, block visual scale뿐이다. 어느 projection이나 크기도 최종 승인으로 선언하지 않는다.

로드맵 유지 규칙:

- 일정·수치·예상 파일 같은 실행 세부는 검증 결과에 따라 소폭 조정할 수 있다.
- 핵심 정체성, 채택 게이트, 사람 승인 조건, fallback 조건을 바꾸는 변경은 사소한 조정으로 취급하지 않고 사용자 결정과 `DECISIONS.md` 동기화를 요구한다.
- 새로운 사실이 생기면 기존 문장을 조용히 덮어쓰지 않고 현재 상태·검증 증거·다음 게이트를 함께 갱신한다.
- `ROADMAP.md`와 `EXECUTION_PLAN.md`가 충돌하면 실제 구현을 시작하지 않고 두 문서를 같은 작업 단위에서 정렬한다.
- 작업 완료 시 필요한 `DECISIONS.md`, `GAME_DESIGN_TRACK1.md`, `EXECUTION_PLAN.md`, 협업·리뷰·플레이테스트·라이선스 로그 동기화를 작업 범위에 포함한다.

상태는 다음 네 가지 중 하나만 사용한다.

- `미착수`: 현재 저장소에 기능이나 산출물이 없다.
- `구현됨·미검증`: 코드나 문서 산출물은 있으나 사람 플레이 검증이 없다.
- `사람 플레이 검증 완료`: `docs/PLAYTEST_LOG.md`에 실제 사람의 재현 가능한 검증 기록이 있다.
- `동결`: 제출 후보 이후 신규 변경을 금지하고 치명적 버그만 다루는 상태다.

자동 테스트, 타입 검사, 빌드, 자동 브라우저 확인은 사람 플레이 검증 완료로 승격시키지 않는다.

## 1. 목표

- 2026-08-24까지 제출 후보 빌드 완성
- 2026-08-25부터 기능 동결
- 2026-08-26 제출 완료
- 첫 30~90초의 플레이 가능성, 가독성, 안정성 우선
- 첫 30~90초 안에 단어 블록이 실제 규칙을 바꾼다는 차별점을 보여 줌
- 최종 아트보다 먼저 B+ family 내부 projection·공간 가독성·shallow Z·block visual scale을 사람 gate에서 확인한다. 실패 시 `legacy-a`는 사용자-facing 후보가 아닌 내부 rollback 경로로만 사용한다.
- 평균 시나리오는 `기본 생산 + [빠르게!] + [두 배로!]`가 모두 실제 규칙으로 작동하는 작은 완성 런으로 닫는다. 대신 Seed·리더보드·복잡한 점수와 추가 콘텐츠를 잘라 두 수식 블록의 완성도를 확보한다.

## 2. 현재 기준선

2026-08-10 A/B/C 감사 기준선은 `master` / `2ebd9365b6cab5638888230e4f709a387d450081`이다. KayKit·material·stack·collision·presentation·SFX runtime 작업은 이미 `af9e866edf02e3937c2289f7c92f9e86803df563`에 커밋되어 이 기준선에 포함되며 현재 dirty가 아니다. 현재 closeout 대상은 A 보안·Credits, B B+ 10° yaw, C Stage 0 빵 목표 1개다. 구현 커밋에서 제외할 dirty 로그는 `docs/CODEX_COLLAB_LOG.md`, `docs/REVIEW_LOG.md`, `docs/PLAYTEST_LOG.md`이며, 별도 34 commits·227 blobs는 기준선 시점의 pre-closeout evidence로 명시해 보존한다. origin은 `https://github.com/65terb/Just-Make-Bread.git`로 연결했고, 원격 heads empty와 Vercel GitHub authorization은 확인됐지만 project import/link·공개 URL·deploy는 아직 없다.

| 영역 | 실제 구현 상태 | 자동 테스트 상태 | 사람 플레이 검증 상태 | 남은 문제 | 다음 마일스톤 |
|---|---|---|---|---|---|
| 웹 기반·빌드 | `기술 검증 통과·사람/공개 미검증` — Vite, TypeScript, Three.js, 정적 Vercel 설정과 `dist` 빌드 구성이 있다. `npm.cmd run check:deploy`가 production build 뒤 비대화식 local preview에서 루트·세 카메라 query·invalid-first query, 해시 JS/CSS, active runtime GLB 2개와 CC0 pickup WAV 1개, 승인 public allowlist를 검사하고 child·port 정리를 확인한다. 제한 밖에서 정확한 `npm.cmd run check`가 타입 검사·245/245 테스트 통과, 독립 `npm.cmd run build`는 main `680.11 kB`, lazy GLTFLoader `44.80 kB`로 성공했으며 기존 500 kB 초과 경고가 유지된다. readiness는 public 8개·585,398 bytes, dist 14개·1,988,718 bytes, runtime binary 580,972 bytes, audio 1개·88,244 bytes, working privacy candidate 93개·error 0(기존 COLLAB metadata report 2건)으로 통과했다. 제한 sandbox 안에서는 Vite config loader의 parent directory 접근 권한 오류가 발생하며 프로젝트 결함과 구분한다. | `기술 검증 통과` — 사람 기록 없음. | origin과 Vercel GitHub authorization은 연결됐지만 project import/link·공개 URL·실제 deploy, 외부 직접 접근과 새로고침은 확인하지 않았다. | M6 |
| 플레이어 이동·경계 | `구현됨·미검증` — WASD, 짧은 입력 보정, 월드 경계 클램프, 네 방향 벽이 코드에 있다. | 이동·경계 관련 상태 테스트가 있다. | `구현됨·미검증` — `PLAYTEST_LOG.md`에 사람 기록 없음. | 실제 첫 이동과 경계 인식, 입력 시작을 사람에게 확인받아야 한다. | M1 |
| 임시 카메라 | `구현됨·미검증` — 일반·누락·잘못된 view는 `bplus-balanced`로 시작하고, 명시적인 `view=legacy-a`만 deprecated/internal rollback으로 유지한다. M3-V0 public comparison은 `bplus-ortho`·`bplus-balanced`·`bplus-perspective` 세 B+ 후보다. 세 후보는 같은 authoritative layout과 18% closer framing, X dead-zone·smoothing·clamp·Z 비반응을 공유한다. | 카메라·M3-V0 config/layout 테스트가 projection·query·follow·safe area와 충돌 회귀를 검증한다. | `구현됨·미검증` — 구현자 브라우저 비교만 있으며 최종 카메라 사람 플레이 기록 없음. | 세 B+ 후보의 가림·운반·수량 가독성을 사람이 비교하고 최종 projection을 선택해야 한다. Z 폭과 블록 visual scale은 후속 tuning이다. | M3-V0 |
| 재료 집기·직접 투입 | `구현됨·미검증` — Stage 1 공개 후 `wheat`, `flour`, `bread` 중 같은 종류 재료를 1~5개까지 E로 쌓아 들고 고정 `분쇄`·`굽기`·제출대에 여유만큼 bulk 투입한다. | 단일·stack pickup, 혼합·상한 거부, 부분 전달·잔량·수동/자동 제출·결정론 테스트가 있다. | `구현됨·미검증` — 사람의 stack 운반 기록 없음. | 1~5개 실루엣과 설비·제출대 bulk 전달을 사람에게 확인해야 한다. | M2B |
| 블록 집기·내려놓기 | `구현됨·미검증` — 공개된 `분쇄`·`굽기` 생산 블록을 Space로 들어 유효한 월드 위치에 다시 놓을 수 있다. | B+ view options·실제 pickup/drop·스냅 회귀 테스트가 있다. | `구현됨·미검증` — 사람 이동·배치 검증 없음. | 이동 기회비용과 배치 가독성을 사람 플레이로 조정한다. | M3-V0.5 |
| 최소 생산 수직 슬라이스 | `구현됨·미검증` — 플레이어만 보이는 시작 → 밀 파이프·밀 → 고정 `분쇄` → 밀가루 → 고정 `굽기` → 빵 → 제출대의 사건 기반 공개와 직접 운반. | 공개 순서·숨김 차단·생성·상한·호환성·처리·출력·제출·결정론 테스트가 있다. | `구현됨·미검증` — 사람의 전체 흐름 기록 없음. | first-pass Stage 1 목표와 35초 시간 압박, 무입력 미완료를 사람 플레이로 확인해야 한다. | Stage 1 P0 |
| Stage 1 P0 공개·코드 기반 비주얼 | `구현됨·미검증` — 중립 작업장, 서쪽 벽 고정부에서 실내 +X로 곧게 나온 수평 원통 파이프와 정면 열린 mouth, mouth→바닥 약 0.55초 전방 burst·하강 표현, 단순 고정 큐브 `분쇄`·`굽기`, 카메라에서 읽히는 북쪽 벽 수납형 제출대, 형태가 다른 토큰, 월드 E 힌트와 600ms 비차단 one-shot 공개 정착을 사용한다. 첫 빵 출력 뒤에만 최소 목표 HUD를 표시하며 Stage 2 오브젝트는 없다. | 상태·공개 lifecycle과 플레이어 모션·밀 출현·revealVisual helper를 자동 테스트로 검증하고 시각 가독성 자동 테스트는 없다. | `구현됨·미검증` — 구현자 브라우저 확인만 있으며 사람 승인 기록 없음. | 초기 공개, 정면 mouth와 직선 파이프, 단일·5개 적체, 운반물, 처리 중/유휴 구분, 벽 제출함과 목표 HUD, 공개 정착의 가독성을 사람에게 확인해야 한다. | M4, M5 |
| 토큰·설비 가독성 | `구현됨·미검증` — 토큰은 형태·색상으로 구분되고, 고정 큐브형 `분쇄`·`굽기`와 `밀 생성원`·`제출대` 라벨, 출력 위치와 상호작용 링이 있다. 첫 빵 전에는 화면 고정 HUD가 없고, 첫 빵 뒤에는 `빵을 제출하세요`와 제출 수량만 표시하며 실패·완료일 때 최소 결과 피드백을 유지한다. | 상태·카메라 자동 테스트와 모션 helper 테스트는 있으나 시각 가독성 자동 테스트는 없다. | `구현됨·미검증` — 가독성 플레이테스트 기록 없음. | 최소 5개 토큰 적체, 라벨 안전 영역, 벽 투입구, 목표 HUD와 병목 판독을 사람에게 확인해야 한다. | M5 |
| 수식 블록·시간 압박 | `구현됨·미검증` — `[빠르게!]`의 기존 소모형과 `[두 배로!]`의 10초 충전·4초 active/drain 순환을 GameState가 소유한다. Double은 world/ejected·held·양쪽 socket에서 같은 시계를 유지하지만, active 증폭은 Double이 실제로 붙은 admitted/grounded production block의 qualifying completion에만 적용한다. mill 부착이면 mill, heater 부착이면 heater만 atomic pair를 만들고 world/held 또는 다른 block의 결과는 single이며 출력 하나가 phase를 소비하거나 gauge/root를 제거하지 않는다. | Double domain의 exact 10→4 boundary/bounded-frame 회귀와 parsed v010/v014를 소비하는 block-scoped GameState/Q40 생산 output·presentation regression이 있다. Main의 `0.05초` frame cap과 단일 production advance caller에 근거해 multi-cycle large-delta event equivalence는 계약에서 제거했다. | `구현됨·미검증` — 자동 기술 gate는 있으나 자연 Double 플레이·시각/밸런스 승인은 없다. | 10→4 반복, 위치 이동 중 게이지 지속, active 중 부착 block의 복수 출력·block 이동·drain 가독성, inactive/world/held 단일 출력, wall RESET을 사람 플레이로 확인한다. `[한 번 더!]`/`[또!]` 제3 증폭 블록은 여전히 별도 마일스톤이다. | M3-V1 → M3-V2 → 사람 승인 |
| 스테이지·온보딩 | `구현됨·미검증` — 첫 주문은 빵 1개·무제한 시간이며, 단발 성공/실패 latch·token/process cleanup·transition lock·wall RESET attempt transaction이 있다. 설비는 전환 cleanup에서 사라지지 않는다. | lifecycle/score/surplus/large-split/설비 지속 회귀가 있다. | `구현됨·미검증` — 첫 완료 전광판 전 과정과 사람 플레이 미검증. | 중앙 누적 점수·성공 시 authoritative breakdown 보조 보드·최종 점수 hold·CLEAR 또는 실패 GAME OVER의 벽면 상승/복귀와 종료 상태 설비 모션 정지를 사람 플레이로 확인한다. Hive는 public staging 뒤 조건부 검토다. | M3-V0.5 |
| 비주얼·사운드·성능 | `구현됨·미검증` — dedicated Wheat V010, Flour V014, and Bread V002 live material runtimes with atomic procedural fallbacks를 current runtime status로 기록하고 v007은 `?character=v007` rollback/fallback, v005는 `?character=v005`, v002는 `?character=legacy` rollback, procedural player는 v008→v007→v005 load/validation failure fallback으로 둔다. `Running_A`는 validation-only이며 run/dash gameplay는 없다. block stepping은 accepted block X displacement 기반 presentation-only다. superseded character/material v001과 36개 WAV는 public payload에서 제외했으며, 현재 public/runtime audio는 CC0 `pickup-mouth-pop.wav` 1개만 사용한다. whitelist는 `material-picked-up`·`stack-increased`이고, Adobe deposit/output은 약관상 원본 재배포를 하지 않아 silent이며 그 외 모든 family도 silent다. | 빌드·candidate/rollback fallback·privacy scan·오디오 수명/voice cap·현재 1개 WAV·lifecycle 자동 검사는 있으나 최종 모션·stride·stack contact·front-side feel·시각·청취와 기기별 검증은 없다. | `구현됨·미검증` — 최종 모션·시각·청취 품질 플레이테스트 기록 없음. | v008 motion/stride/stack contact/front-side feel과 사람 승인이 남아 있다. 현재 pickup 사운드의 사람 청취·볼륨 승인은 pending이며 Adobe deposit/output은 새 배포 가능 근거 전까지 비활성이다. | M5 |

## 3. 현재 집행 방향과 승인 게이트

### 3.1 잠정 추천

- 채택 방향: `B+ 얕은 2.5D 생산 문장형 디오라마 + D의 수식 블록 재배치 일부 흡수`
- 내부 rollback: `legacy-a` 정돈된 3/4 디오라마 공장 경로를 명시적 내부 rollback으로만 보존한다.
- B+ family 방향은 사용자 피드백으로 채택됐다. `M3-V0`의 사람 gate는 세 B+ projection 중 최종 projection, shallow Z 폭, block visual scale의 tuning에만 남아 있으며 이후 `M3-V1 [빠르게!]`와 `M3-V2 [두 배로!]`를 순서대로 검증한다.
- 고정 레인, 점프, 중력, 자유 카메라, 순수 횡스크롤 액션, 전면 자동화 편집 모드는 현재 제출 범위에서 제외한다.

### 3.2 반드시 보존할 불변식

- Three.js 브라우저 웹 빌드와 결정론적 `GameState`
- authoritative 상태와 presentation 상태 분리
- WASD 직접 조작과 E 재료 운반
- `밀 → [분쇄] → 밀가루 → [굽기] → 빵 → 제출`
- 같은 재료 최대 5개 운반 또는 사람 승인된 동등한 반복 부담 완화 장치
- 현실 기계보다 큰 단어와 결합 규칙이 먼저 읽히는 단어 블록 정체성
- 자동 테스트·브라우저 검증·사람 플레이·공개 배포 증거의 분리
- 사용자 dirty 변경과 에셋 라이선스 기록 보호

### 3.3 사용자 승인 없이는 바꾸지 않을 것

- M3-V0 사람 플레이 이후 세 B+ projection 중 최종 projection, shallow Z 폭, block visual scale 결정
- 캐릭터·밀·밀가루·빵의 최종 사용자 제작 모델 채택
- Stage 0~2의 최종 목표 수량·제한 시간·점수 규칙
- 온라인 리더보드·Seed와 Hive의 실제 연동은 현재 구현·승인하지 않는다. Hive는 public staging 안정화 뒤 공식 요구·인증·SDK/웹 호환성·개인정보·무로그인 심사 링크·시간 대비 효과를 확인하는 조건부 feasibility spike와 사용자 go/no-go 대상으로만 둔다.

### 3.4 실무자가 검증 결과에 따라 조정 가능한 것

- 고정 카메라의 정확한 FOV·yaw·pitch·거리
- 압축 생산선의 정확한 좌표와 얕은 Z 폭
- 토큰 출력·적체 슬롯의 미세 위치
- 모델 scale, stack spacing, 접촉 epsilon
- VFX·SFX의 gain·지속 시간·강도
- 테스트가 보장하는 범위 안의 일정 순서와 예상 파일 분리

## 4. 완료·진행 이력과 이후 마일스톤

### M0 — 기준선 감사와 문서 동기화 / 8월 6일

- 코드·문서 상태 대조
- 잘못된 완료 표기 수정
- 카메라 전제 정리
- 직접 자원 운반 규칙을 다음 구현 게이트로 명시

완료 판정은 문서 상태 동기화까지이며, 사람 플레이 완료를 의미하지 않는다.

### M1 — 조작 기반 / 8월 6일~8일

- 이동
- 임시 플레이어 추적 카메라
- 블록 집기·내려놓기
- 자원 스택 집기·내려놓기
- 설비·제출대 직접 투입
- 상호작용 대상 우선순위
- 월드 경계
- 설비 식별

던지기와 물리 엔진은 제외한다.

현재 Stage 1 P0 코드의 동일 재료 1~5개 stack 직접 운반과 사건 기반 설비 공개를 우선한다. 공개된 `분쇄`·`굽기` 생산 블록은 Space로 다시 옮길 수 있으며, 배치 자동 흡수는 M2A 확장·내부 호환 경로로 남긴다.

### Stage 1 P0 — 공개 연출과 코드 기반 비주얼 통합 / 현행 구현 이력·회귀 기준

- 플레이어만 보이는 중립 시작 상태
- 1.0초 파이프 공개 뒤 1.25초 간격 밀 생성
- visible 밀 pickup 뒤 고정 `분쇄`, 밀가루 output 뒤 고정 `굽기`, 빵 output 뒤 제출대 공개
- E 직접 운반, 관찰 지연, 첫 주문 빵 1개 제출 목표(후속 주문은 별도 target 옵션)
- Current material runtime status: dedicated Wheat V010, Flour V014, and Bread V002 are the current live runtime candidates. Each has its own atomic procedural fallback on validation, load, or clone failure. The combined material payload is compatibility-only for Wheat and is not the live Flour or Bread authority. Worker v010a and its documented rollback chain remain separate character-runtime policy.
- 분쇄 `2.40초`·굽기 `1.65초` 처리, 서쪽 벽 수평 직관 파이프·정면 mouth·북쪽 벽 제출함, 실제 이동 거리 기반 플레이어 모션과 두 팔 운반 포즈
- 분쇄·굽기·제출함은 600ms 비차단 one-shot 공개 정착과 reduced-motion 즉시 최종 상태를 사용하며, 설비 링·출력 포켓·벽 고정부는 공개 애니메이션에 끌려가지 않음
- 첫 빵 출력 뒤에만 `빵을 제출하세요` / 제출 수량 두 줄 HUD를 표시하고 긴 상시 HUD는 노출하지 않음
- Stage 2 `[빠르게!]`·`[두 배로!]`와 Stage 2 장식은 노출하지 않음

상태: `구현됨·미검증`. 자동 테스트·빌드와 구현자 브라우저 확인은 있으나 사람 플레이·공개 배포 검증은 없다.

### M2 — 최소 생산 수직 슬라이스 / 8월 8일~11일

- 밀 → 분쇄 → 밀가루 → 굽기 → 빵 → 제출대
- 실제 월드 토큰
- 기본 생산 블록 버퍼 최대 5 (저장+예약 합산; 명시적 fixture override는 유지)
- 이동 가능한 생산 블록의 자동 흡수 + 수동 물류 보완
- 출력 관찰 지연
- 첫 주문 빵 1개 제출
- 자동 클리어 금지
- 사람 플레이테스트

Stage 1 P0 이후 M2 확장에서 자동 흡수·자동 제출을 사람 플레이로 비교한다. 현재 초기 배치는 무입력 자동 클리어가 되지 않으며, Stage 1의 이동 가능한 생산 블록·직접 운반 경로를 먼저 검증한다.

### M2A — 이동 가능한 생산 블록과 하이브리드 물류 코어 / 역사적·내부 확장 경로

- 분쇄·가열 블록의 Space 집기·유효 스냅 배치
- 배치 상태의 호환 토큰 예약·순차 자동 흡수
- 자동화되지 않은 구간의 E 직접 운반
- 관찰 지연과 출력 오프셋
- 반경 내 관찰된 빵 자동 제출과 원거리 수동 제출
- 초기 배치에서 최소 한 구간 수동 물류 유지
- 동일 자원 stack 운반·bulk 투입은 M2B 구현 작업으로 추가됐지만 사람 플레이 승인 전이다.

상태: `구현됨·미검증`인 기존 코드·테스트 경로를 보존한다. Stage 1 P0 활성 공정과 혼동하지 않으며, 재개 시 별도 티켓과 사람 플레이 게이트를 둔다.

### M2B — 동일 재료 stack 운반과 bulk 투입 / 현행 구현 기준·사람 승인 대기

- E 1회당 관찰된 월드 토큰 하나를 같은 종류 stack에 추가하고 최대 5개로 제한
- 혼합 재료·6번째 재료의 원자적 거부
- 설비·제출대의 호환 여유만큼 안정적인 ID 순서로 bulk 전달하고 잔량 유지
- 1~5개 운반 표현과 기존 두 팔 carry pose 가독성 확인
- 사람 플레이에서 한 개 운반·stack 운반·부분 전달을 비교하고 채택 상태를 결정

상태: `구현됨·미검증` — 순수 상태·표현 helper 테스트는 있으나 사람 플레이와 공개 배포 검증은 없다.

### M3-V0 — B+ 공간·가독성 수직 슬라이스 / B+ family 방향 채택·내부 tuning 미검증

목표는 채택된 B+ family 안에서 실제 플레이가 더 잘 읽히는 projection·shallow Z·block visual scale을 빠르게 판정하는 것이다.

포함 범위:

- 현재 Stage 1 규칙과 `GameState` 결정론 보존
- 현재 A보다 약 15~25% closer framing으로 시작하는 B+ 직교·낮은 FOV 원근 카메라를 같은 압축 생산선에서 비교
- X축 중심 이동과 충돌 우회·상호작용 반경을 함께 보존하는 `3.6m` 얕은 자유 Z
- `밀 생성 → 집기 → [분쇄] 투입 → 처리 → 밀가루 출력·적체`
- 흰 벽, 매우 옅은 쿨그레이 바닥, grid·체크무늬·기둥 제거
- 최종 모델 대신 기존 fallback 또는 명확한 greybox 사용
- 800×600과 1280×720의 동일 검증 시나리오

현재 구현은 URL query `?view=bplus-ortho`, `?view=bplus-balanced`, `?view=bplus-perspective`로 세 B+ projection을 같은 빌드에서 선택한다. query는 첫 값을 소유하고 값 없음·잘못된 첫 값은 fail-closed로 `bplus-balanced`에 돌아간다. 명시적 `?view=legacy-a`는 deprecated/internal rollback으로만 남는다. `?compare=views`를 붙인 경우에만 B+ 세 버튼 비교 패널을 표시하며, 버튼은 선택한 `view`를 정규화한 URL로 full reload해 같은 초기 GameState/lifecycle에서 시작한다. 일반 플레이 URL에는 패널이 없다. 세 B+ 모드는 M1-derived X `[-12.35, 12.35]` / width `24.7`, Z `[-3.6, 3.6]` / depth `7.2` authoritative layout을 `GameStateOptions`와 렌더 경계에 함께 사용하며, 모든 실제 token slot 기준 세 구간의 collision-free 이동 하한은 약 `0.56초`다. 약 18% closer framing, X축 dead-zone·부드러운 추적·layout-derived clamp를 적용하고 Z축 이동은 카메라에 전달하지 않는다. 들고 있는 생산 블록은 북쪽 벽에 붙은 설비 기준의 보이지 않는 X-only 제약과 half extent까지 벽 충돌 경계에 포함하며 invalid continuous-X/contact/collision drop에서는 계속 들고 있는다. balanced는 FOV `21`, 현재 B+ 원근 기준 거리 배율 `1.2`의 실제 PerspectiveCamera 후보이며, 사람 gate는 최종 projection·Z 폭·block visual scale·이동 체감에 남아 있다. 화면 레일 표현은 없다.

제외 범위:

- `[빠르게!]`, `[두 배로!]`, 점수, Seed, 다중 스테이지
- 캐릭터 최종 모델 제작 — 대회 전 Blender procedural character pipeline은 `REJECTED`이며 추가 수동 재시도는 예약하지 않는다. user-authored worker v008 exact8은 기본 runtime candidate로 연결했고, v007은 `?character=v007` explicit rollback/fallback, v005는 `?character=v005`, KayKit worker v002는 `?character=legacy` explicit rollback으로 유지하며, procedural runtime fallback은 v008→v007→v005 load/validation failure safety다. `Running_A`는 validation-only이며 run/dash gameplay는 없다. paid AI 후보 또는 사용자가 만든 Blender base mesh는 현재 기본 ticket이 아니며 별도 visual/runtime gate에서만 판단한다. v008 motion/stride/stack contact/front-side feel과 최종 모션·시각·사람 플레이 승인은 pending이며 재료·소품 경로는 별도다.
- `main.ts` 전면 재작성과 대규모 render 디렉터리 생성
- 고정 레인, 점프, 중력, 자유 카메라

완료 게이트:

- 파이프·분쇄 입력·밀가루 출력이 한 화면에 동시에 보인다.
- 캐릭터와 밀·밀가루 수량이 현재 A보다 작거나 불명확해지지 않는다.
- W/S 얕은 깊이 이동이 경로 선택 또는 가림 회피에 실제 가치를 준다.
- 입력 방향, 상호작용 대상, 출력 위치가 800×600에서도 읽힌다.
- 기존 생산·stack·bulk·충돌·관찰 지연·이벤트·오디오 테스트가 회귀하지 않는다.
- 사용자 사람 플레이에서 A보다 읽기 쉽거나 플레이 의도가 강해졌다고 승인한다.

중단·복귀 조건:

- 당일 안에 위 완료 게이트를 충족하지 못함
- 전체 공정을 넣기 위해 오브젝트가 지나치게 작아짐
- 설비·캐릭터 가림을 해결하려면 핵심 게임 규칙을 다시 써야 함
- 얕은 Z가 전략 없이 조작 부담만 늘림
- 800×600에서 라벨·입출력·수량을 동시에 읽을 수 없음

중단 시 B+ 변경을 확장하지 않고 명시적 `legacy-a` 내부 rollback으로 돌아간다. 유효했던 흰 환경·압축 배치·출력 적체 개선만 rollback 경로에 선택적으로 재사용할 수 있다.

### M3-V0.5 — Stage 0 주문·전환 lifecycle / B+ 내부 tuning gate 후 미착수

- 최초 온보딩 주문은 빵 1개, 시간 제한·숨은 시간 감점 없음
- 성공 시 completion latch·기본 점수 1회·공정 정지·공통 cleanup·기존 파이프 퇴장·`[빠르게!]`와 다음 주문 공개
- 시간 제한이 있는 후속 주문 실패 시 failure latch와 원인 관찰을 유지하고, wall RESET 뒤에만 attempt cleanup·동일 stage 재시작을 수행한다. 과거 Retry 버튼·`R`/`Enter` gameplay 경로는 superseded다.
- 같은 simulation tick의 제출·deadline은 deadline 이내 authoritative 제출 성공 우선
- 전환 중 이동 허용·상호작용 잠금과 첫 성공 `+100`은 후보로 남기고 구현 티켓에서 확정
- 온라인 leaderboard·Seed는 미구현이다. Hive 실제 연동도 구현·승인 상태가 아니며 public staging 안정화 뒤 조건부 feasibility spike와 사용자 go/no-go를 거친다. 결과 계약은 특정 공급자에 종속하지 않고 adapter를 붙일 수 있는 형태로 유지하며, 핵심 루프나 무로그인 플레이를 불안정하게 하면 대회 후로 보류한다.

이 수직 슬라이스는 B+ projection·shallow Z·block visual scale tuning gate 결과를 받은 뒤 착수하며, 현재 첫 주문의 1개 target 구현을 lifecycle 전환 완료로 오해하지 않는다.

### M3-V1 — `[빠르게!]` 독창성 수직 슬라이스 / V0 승인 후

목표는 단어 블록이 라벨이 아니라 실제 공정 규칙이라는 점을 3초 안에 전달하는 것이다.

포함 범위:

- 직접 집을 수 있는 `[빠르게!]` 임시 블록 1개
- 분쇄 소켓 부착·분리 또는 승인된 동등한 명시적 결합
- authoritative 처리 시간 변화
- 처리 모션·상태등·SFX 리듬의 동기화
- 부착 전후 병목 차이를 읽을 수 있는 짧은 목표
- 중복 부착·중복 처리·재시작·큰 delta 회귀 테스트

완료 게이트:

- 설명 없는 플레이어가 `[빠르게!]`를 집고 올바른 설비에 부착한다.
- 부착 뒤 3초 안에 처리 속도 변화가 시각·음향·결과로 읽힌다.
- 플레이어가 소진 정지를 피하려고 스스로 블록을 분리하는지, 그리고 실제 처리 중에만 연료가 감소하는지 이해한다.
- presentation이 authoritative 상태 적용을 늦추거나 두 번 발생시키지 않는다.
- 첫 90초 안에 기본 생산과 첫 수식 블록 효과를 경험한다.
- 사용자 사람 플레이 승인을 받는다.

V1이 실패하면 `[두 배로!]`를 삭제하지 않고 V1의 규칙·표현을 먼저 고친다. Fast가 단어 규칙으로 읽히지 않는 상태에서는 Double도 같은 정체성 문제를 반복하므로 V2 착수만 보류한다.

### M3-V2 — `[두 배로!]` 산출량·버스트 수직 슬라이스 / V1 승인 후 대회 필수

목표는 `[두 배로!]`가 단순 숫자 증가가 아니라 하나의 생산 결과를 두 개의 읽히는 토큰으로 바꾸는 규칙임을 보여 주는 것이다.

포함 범위:

- 직접 집기와 승인된 소켓 부착·분리
- authoritative output count 2와 단일 batch·pair identity
- 두 토큰이 서로 다른 결정론적 궤적·착지 슬롯을 사용
- 선형 사슬에서 배수 위치 자체는 원리적으로 동등하며, 하류 capacity·waste·bottleneck 때문에 증폭분이 폐기되는 예외에서만 위치 차이를 검증
- rapid/pair/rapid-pair 표현 fixture와 실제 Stage runtime의 승인된 mode 분리
- VFX·SFX pair cue, voice cap, lifecycle cleanup
- 중복 산출·같은 위치 겹침·재시작·큰 delta·removed token cleanup 회귀 테스트

완료 게이트:

- 설명 없는 플레이어가 `×2` 또는 분기 아이콘과 큰 단어를 같은 규칙으로 이해한다.
- 두 개 출력이 한 개처럼 겹치거나 파티클 덩어리로 보이지 않는다.
- Fast와 Double의 차이가 속도와 산출량으로 즉시 구분된다.
- 어느 설비에 붙이는지가 최소 한 번 실제 선택으로 작동한다.
- Fast+Double stress에서도 토큰·오디오·VFX·프레임이 안정적이다.
- 사용자 사람 플레이 승인을 받는다.

Double은 대회 최소 범위다. 일정이 부족하면 Double을 삭제하는 대신 Seed·리더보드·점수판·추가 주문·후처리·추가 애니메이션을 먼저 제거한다. 기술적으로 Double을 닫을 수 없는 상황이 확인되면 임의로 범위를 내리지 않고 사용자에게 scope failure를 보고한다.

`[한 번 더!]`(라벨이 길면 `[또!]`)는 Fast와 Double의 효과 자체를 증폭하는 후보로만 기록한다. Fast/Double 사람 승인 전에는 현재 마일스톤에 넣지 않으며, M3-V2 이후 별도 마일스톤에서 범위·조합·사람 검증을 정한다.

### M4 — Soft Word Factory 핵심 아트 교체 / 카메라 승인 후

필수 방향:

- 의상·로봇 관절 장식이 없는 흰색 저폴리 사람형 마네킹
- 밀·밀가루·빵의 새 사용자 승인 모델
- 현실 기계가 아닌 단순 단어 박스형 `분쇄`·`굽기`
- 생산 블록과 구분되는 제출 목표 오브젝트
- 흰 벽·옅은 쿨그레이 바닥, 체크무늬·촘촘한 grid·기둥 없음
- 접촉 그림자, 제한된 기능색, 정리된 베벨과 바닥 접촉
- 현재 exact8 계약은 `Idle_A`, `Walking_A`, `Holding_A`, `CarryWalking_A`, `Running_A`, `BlockPush_A`, `BlockPull_A`, `BlockMoveFront_A`다. 일반 이동은 `Idle_A`/`Walking_A`, 재료 운반은 `Holding_A`/`CarryWalking_A`, I1 front/side 조작은 `BlockMoveFront_A`/`BlockPush_A`/`BlockPull_A`를 사용한다. `Running_A`는 validation-only이며 run/dash gameplay는 구현하지 않는다.

제작 순서:

1. 승인된 카메라에서 캐릭터·재료 실루엣과 화면상 목표 크기 확정
2. 대회 전 Blender procedural character pipeline은 `REJECTED`다. 현재 next gate는 기본 v008 exact8의 motion/stride/stack-contact/front-side feel과 human visual approval이며 I7 general motion polish는 그 뒤에만 시작한다. v007은 `?character=v007` rollback/fallback, v005는 `?character=v005`, v002는 `?character=legacy` rollback으로만 유지하고, procedural player는 v008→v007→v005 load/validation failure fallback이다. paid-AI/user-Blender 후보 선택은 현재 기본 ticket으로 재개하지 않으며, 밀·밀가루·빵과 소품은 별도 제작 경로로 평가한다.
3. 닫힌 mesh·피벗·scale·재질·node·clip 계약 검증
4. 1~5개 물리적 적층과 몸 관통·부유·교차 확인
5. 기존 fallback을 유지한 GLB 원자적 통합
6. 분쇄·굽기·제출대·환경의 최소 조형 정리

외부 소싱은 캐릭터 6, 밀 6, 밀가루 5, 빵 5, 제출 6 후보를 이미 비교했으나 통합 승인 후보가 없었다. 같은 수준의 무료 에셋 반복 소싱은 기본 계획에서 제외한다. 대회 전 Blender procedural character bounded pipeline은 자동 smoke 실패 후 `REJECTED`로 닫혔고 추가 수동 재시도는 예약하지 않는다. 현재 user-authored worker v008 exact8은 기본 runtime candidate이며 v007은 `?character=v007` explicit rollback/fallback, v005는 `?character=v005`, KayKit v002는 `?character=legacy` explicit rollback, procedural runtime fallback은 v008→v007→v005 load/validation failure safety다. `Running_A`는 validation-only이며 run/dash gameplay는 없다. v008 기술 통합은 사람 모션·시각 승인 전의 구현 후보이며, paid AI 후보 또는 사용자 Blender base mesh의 별도 proof는 기본 ticket이 아니라 사람 gate에서 판단한다. procedural props와 재료·환경 후보는 별도로 평가한다. 유료 서비스 결제·파일 업로드·외부 전송은 별도 사용자 승인 없이는 수행하지 않는다.

사람 승인 게이트:

- 캐릭터가 무료 로봇 에셋이나 연습용 모델처럼 보이지 않는다.
- 빵·밀가루 1~5개가 몸을 관통하지 않고 물리적으로 지지된 적층으로 읽힌다.
- 출력된 토큰이 같은 점에 겹치지 않고 적체 수량과 병목을 보여 준다.
- 밀·밀가루·빵이 캐주얼하지만 조잡하지 않은 하나의 형태 언어로 읽힌다.
- 걷기와 carry-walk에서 발 미끄러짐과 상체 떨림이 허용 범위 안이다.

### M5 — 제출 가능한 게임 패키지 / 8월 18일~21일 목표

평균 시나리오의 필수 범위:

- 기본 생산을 학습하는 첫 주문
- `[빠르게!]`를 사용하는 짧은 주문
- `[두 배로!]` 또는 Fast+Double의 산출량 선택을 보여 주는 주문
- 제한 시간 또는 명확한 완료 압박
- 실패·완료 후 즉시 재시작
- 최소 목표·결과 정보
- 현재 public/runtime은 CC0 pickup WAV 1개와 `material-picked-up`·`stack-increased` whitelist만 사용하며, Adobe deposit/output과 그 외 SFX family는 silent다. 최종 청취·볼륨 승인은 pending이다.
- 새 사운드 방향에서 사용자 승인된 새 후보만 primary에 통합한 뒤 청취·밸런스·기기 검증
- 흡수·처리·출력·제출의 핵심 VFX
- 디버그 링·중복 grid·임시 피드백 정리
- 800×600·1280×720·일반 1080p 성능 확인

조건부 확장:

- 네 번째 이후 추가 주문
- 로컬 최고 기록과 ruleset version
- 월드 점수판과 연속 스테이지 전환 수직 슬라이스

다음은 M5 필수 범위가 아니다.

- Seed·challenge ID·layout hash
- 온라인 리더보드
- Hive feasibility 검토(실제 연동 아님)
- 3개 스테이지 강제
- 캐릭터 애니메이션 9개 완비

### M6 — 외부 플레이테스트와 제출 후보 / 8월 21일~24일

- `npm.cmd run check:deploy`로 Vercel root-base 정적 구조, B+ query 직접 접근, 해시 JS/CSS, active runtime GLB 2개, approved public allowlist, CC0 pickup WAV 1개와 그 hash/license, privacy scan과 preview cleanup을 반복 검증
- 설명 없는 신규 플레이어 블라인드 테스트
- 첫 빵·첫 `[빠르게!]` 성공 시간과 혼동 지점 기록
- 공개 URL 직접 접근, 새로고침, 재시작, 탭 복귀
- 800×600·1280×720·일반 16:9 검증
- `prefers-reduced-motion`, mute, 에셋 로딩 실패 fallback
- 제목·200자 소개·16:9 썸네일·선택 데모 영상
- Codex가 비교·구현·테스트·리뷰한 부분과 사람이 결정한 부분의 증거 정리
- 치명적 문제 외 신규 기능 중단

완료 게이트:

- 공개 링크에서 별도 승인 없이 브라우저 플레이 가능
- 자동 검증·브라우저 검증·사람 플레이 기록이 서로 구분되어 있음
- 사용자 최종 플레이 승인
- 모든 외부·사용자 제작 에셋과 직접 합성 음원의 provenance 기록 완료

### M7 — 동결·제출 / 8월 25일~26일

- 신규 기능·새 모델·새 카메라 후보 추가 금지
- 치명적 버그와 제출 차단 문제만 수정
- 수정 후 focused·전체·브라우저 재검증
- 백업 배포와 직접 URL 확인
- 최종 제출

## 5. 범위 사다리

### 필수

- 사람이 선택한 B+ 최종 projection
- 밀 → 분쇄 → 밀가루 → 굽기 → 빵 → 제출의 완전한 생산 루프
- 사람에게 읽히는 재료 1~5개 운반·bulk 투입·적체
- 단순 흰색 캐릭터와 사용자 승인 재료·환경 품질
- `[빠르게!]` 하나의 실제 규칙·부착·표현
- `[두 배로!]` 하나의 실제 pair 산출 규칙·부착·표현
- 실패·완료·즉시 재시작
- 핵심 VFX·SFX와 공개 배포
- 사람 플레이테스트

### 조건부

- B+ 내부 최종 projection·shallow Z·block visual scale tuning
- 로컬 최고 기록
- 월드 점수판과 연속 Stage 1→2 전환
- 약한 후처리
- 네 번째 이후 추가 주문과 추가 modifier 조합

### 대회 이후 보류

- 생산 동사 블록 자유 배치
- 전면 자동화 편집·실행 모드
- Seed challenge와 layout hash
- 온라인 leaderboard 및 실제 Hive 연동(대회 전 feasibility spike·사용자 go/no-go 전까지 보류)
- 사용자 제작 퍼즐·유령 기록
- 다층 공장과 추가 단어 블록

### 현재 제외

- 고정 레인, 점프, 중력, 래그돌, 물리 엔진, 던지기
- 순수 횡스크롤 액션 피벗
- 자유 카메라와 복수 카메라 모드
- 과열 — 기존 제외 목록의 “과열 규칙은 추가하지 않는다” 문구는 2026-08-10 철회했다. `[빠르게!]`의 소진·정지·자동 회복을 설계할 때 처리 중 자원 상태를 검증할 필요가 있기 때문이며, 현재 과열 runtime이나 확정 규칙이 구현됐다는 뜻은 아니다.
- 모바일 최적화
- 현실적인 고디테일 산업 기계
- 강한 Bloom·전역 외곽선·과도한 후처리
- 대회 전 엔진 이전

## 6. 일정 시나리오와 후퇴 기준

### 최상 시나리오

- B+ 내부 projection·Z·block tuning gate 통과
- 사용자 제작 캐릭터·재료와 정리된 환경
- 기본·Fast·Double 3개 주문
- pair bread burst와 월드 결과 표현
- 외부 플레이테스트와 공개 배포 완료

### 평균 시나리오 — 기본 계획

- 사람이 선택한 B+ 최종 projection
- 기본 생산 + `[빠르게!]` + `[두 배로!]` 3개 주문
- 사용자 제작 캐릭터·재료 핵심 모델
- 즉시 재시작, 핵심 VFX·SFX, 로컬 결과
- Seed, 점수판, 온라인 기능 보류

### 최악 시나리오

- B+ 내부 tuning 실패 시 `legacy-a` 내부 rollback
- 한 개의 완성도 높은 Stage 1
- Fast와 Double을 하나의 짧은 challenge 안에 모두 유지
- 캐릭터·재료·흰 환경의 첫인상 개선
- 공개 배포와 재시작을 우선
- 다중 스테이지 연출·점수판·기록 경쟁·추가 콘텐츠 삭제

후퇴 판단은 이미 투입한 작업량이 아니라 남은 기간 안에 플레이 가능한 완성도를 닫을 수 있는지를 기준으로 한다.

## 7. 동결 기준

- M3-V0는 B+ family 방향 채택 상태이며 projection·shallow Z·block visual scale tuning gate를 남긴다.
- M3-V1이 사람 플레이를 통과하기 전에는 M3-V2를 시작하지 않는다.
- M3-V2가 사람 플레이를 통과하기 전에는 점수판·Seed·추가 주문을 시작하지 않는다.
- 8월 18일 이후 검증되지 않은 새 핵심 규칙 추가 금지
- 8월 22일 이후 콘텐츠·기능 추가 금지
- 8월 24일 제출 후보 생성
- 8월 25일부터 치명적 버그만 수정

## 8. 작업 라우팅과 문서 동기화

- 모든 구현 티켓은 마일스톤과 승인 게이트를 명시하고 해당 범위 밖의 기능을 포함하지 않는다.
- 작업 시작 전에 `DECISIONS.md` → `GAME_DESIGN_TRACK1.md` → `ROADMAP.md` → `EXECUTION_PLAN.md` → 관련 로그를 읽는다.
- 구현자는 working tree와 검증까지만 수행하고 stage·commit·push하지 않는다.
- 리뷰어는 동일 context에서 읽기 전용 감사하고 finding별 delta를 구현자에게 돌려보낸다.
- finding이 없고 독립적인 이력 가치가 있을 때만 리뷰어가 정확한 파일·hunk를 stage·commit한다.
- 카메라·장르·핵심 아트·필수 modifier 범위가 바뀌면 `DECISIONS.md`와 `GAME_DESIGN_TRACK1.md`를 같은 work unit에서 갱신한다.
- 구현 순서나 cutoff가 바뀌면 `EXECUTION_PLAN.md`를 같이 갱신한다.
- 실제 구현·검증 사실은 `CODEX_COLLAB_LOG.md`, 중요한 finding은 `REVIEW_LOG.md`, 사람 판단은 `PLAYTEST_LOG.md`, 에셋·음원은 `ASSET_LICENSES.md`에 기록한다.
- 자동 테스트만으로 `사람 플레이 검증 완료` 또는 `동결`을 선언하지 않는다.
- 문서 수치가 바뀌면 마지막 exact check/build 결과를 기록하되, 과거 검증을 사람 승인으로 승격하지 않는다.

## 9. 사용자 결정 상태

1. `승인` — B+ family V0를 조건부 비교·tuning 작업 단위로 시작한다.
2. `확정·사람 시각 pending` — 대회 전 Blender procedural character pipeline은 `REJECTED`다. user-authored worker v008 exact8은 기본 runtime integration candidate로 연결했고, v007은 `?character=v007` 명시적 rollback/fallback, v005는 `?character=v005`, KayKit worker v002는 `?character=legacy` 명시적 rollback으로 유지한다. procedural runtime fallback은 v008→v007→v005 load·validation failure safety다. `Running_A`는 validation-only이며 run/dash gameplay는 구현하지 않는다. paid AI 3D service 후보 또는 사용자 Blender base mesh는 현재 기본 ticket이 아니며 별도 visual/runtime gate로 비교한다. v008 motion·stride·stack contact·front-side feel과 최종 모션·시각·사람 플레이 승인은 pending이고 재료·소품 경로는 별도다.
3. `확정` — 대회 최소 범위에 `[빠르게!]`와 `[두 배로!]`를 모두 포함한다. Double을 위해 Seed·리더보드·점수판·추가 콘텐츠를 먼저 줄인다.
4. `확정` — 첫 온보딩 주문은 빵 1개·시간 제한 없음이며, 성공과 후속 실패는 단발 latch와 공통 cleanup을 사용한다. current-stage 실패 cleanup과 재시작은 wall RESET 입력 뒤에만 실행한다.
5. `미결정` — 전환 중 이동 허용·상호작용 잠금과 첫 성공 `+100` 수치는 lifecycle 구현 티켓에서 확정한다.

V0 구현은 시작할 수 있고 B+ family 방향은 채택됐지만, 최종 projection·shallow Z 폭·block visual scale은 사람 gate 뒤에도 최종 승인 전까지 열어 둔다. 모델 제작 방식이 결정되기 전에는 유료 결제·외부 업로드·대량 제작을 시작하지 않는다.
## 2026-08-10 — M3-V0 B+ balanced 후보·legacy-a 사용자 노출 종료 (현재 상태)

- 공개 비교 후보는 `bplus-ortho`, `bplus-balanced`, `bplus-perspective` 세 가지다. `bplus-balanced`는 거리 배율 `1.2`, FOV `21`의 실제 PerspectiveCamera 후보이며, 기본·누락·잘못된 `view`의 fail-closed 대상이다.
- `legacy-a`는 구현을 즉시 삭제하지 않고 `view=legacy-a` 명시 시에만 접근 가능한 deprecated/internal rollback으로 보존한다. 일반 URL과 comparison UI에는 노출하지 않는다.
- 세 B+는 18% closer framing, X dead-zone `2.25`, smoothing `0.18s`, X clamp `-4.5..4.5`, Z 비반응을 공유한다. authoritative layout·게임 규칙은 불변이다.
- B+ family 방향은 사용자 피드백으로 채택됐지만 balanced의 사람 비교, 최종 projection 선택, Z 폭과 블록 visual scale 조정은 미검증·후속 tuning gate다. 이번 구현은 어떤 final projection이나 사람 플레이 완료도 선언하지 않는다.
## 2026-08-10 — A/B/C pre-closeout status

- Work Unit A is reviewer-closeout material on top of baseline `2ebd9365b6cab5638888230e4f709a387d450081`; protected collaboration/review/playtest logs remain separate dirty history. Pre-closeout evidence is the existing 34-commit/227-blob remote-empty audit; no deploy claim is made.

### 2026-08-10 공개 추적 차단 gate

- 향후 GitHub 저장소는 private로만 생성하고 게임의 공개 route·UI·자산에는 저장소 링크를 노출하지 않는다.
- `check:privacy`의 Git config·history 차단과 `check:deploy`의 전체 public/dist/served payload privacy scan이 모두 통과해야 private push 또는 Vercel import 후보가 된다.
- 제3자 attribution은 유지하지만 개인 Git identity/email, 로컬 경로, source map, Vercel Git metadata는 공개 payload에서 0이어야 한다. private 저장소 생성·push·deploy·공개 URL·사람 플레이는 아직 미완료다.
- Work Unit B applies a shared B+ 10-degree presentation yaw candidate. Work Unit C makes the active Stage 0 first order one bread with deterministic surplus preservation. B+ final projection/human tuning and lifecycle transition work remain pending.

## 2026-08-10 — Current lifecycle vertical-slice status

The Stage 0→Stage 1 lifecycle, score ledger, completion-only world scoreboard, first-pass Stage 1/2/3 targets and timers, `[빠르게!]` attach/processing/fuel path, failure hold, wall RESET attempt transaction, and authoritative cleanup path are implemented in the current working tree. The former persistent score tab and completion toast are removed. Cleanup removes tokens/process state but preserves equipment visibility; repeated machine presentation freezes outside active-order phases. The scoreboard rises vertically from behind the north wall at a fixed wall-behind Z, carries the cumulative number on the central board, and then falls vertically behind the wall. Successful result presentation validates raw score entries/subtotals, aggregates repeated categories before applying the presentation row bound, reveals the ordered rows on the physical auxiliary board, holds the unchanged final numeric score for `1.0s`, and then shows `CLEAR` for `0.4s`; failure shows exact ASCII `GAME OVER` without an auxiliary board. No board extrudes toward the player. Revealed mill and baking production blocks are movable again through Space pickup/drop and cannot cross a world wall while carried; a continuous-X/contact/collision-invalid drop retains the held block without a release snap. Stage 0 remains one untimed bread. The current balance policy is Stage 1 `10/35`, Stage 2 `15/40`, Stage 3 `25/45`; Fast remains `1.8×/8s/6s`, Again+Fast derives `3.24×`, and score remains `targetBread * 100 + remainingWholeSeconds * 10` with no balance bonus. The former `8/60` and Unit 3 `3.6×` values remain historical provenance only; human balance tuning and the current M1-derived `24.7×7.2` gameplay-bound feel remain pending.

Current automated evidence: focused GameState 83/83, input 8/8, M3-V0 view 13/13, camera 10/10, presentation 14/14 (128/128); full check typecheck plus 224/224; build main 679.63 kB and lazy GLTFLoader 44.80 kB with the existing >500 kB warning plus Galmuri11 normal/bold WOFF2 assets; check:deploy passed with public 6 files/496,195 bytes, audio0, runtime binary 492,728 bytes, dist12/1,896,694 bytes, and preview cleanup verified. The I1 delta adds split-independent rail endpoints, a compensated 60/600-frame travel accumulator, exact production-rail release X without grid snapping, and raw A/D rail projection while preserving normal-player diagonal input; front/side manipulation feel and human approval remain pending browser verification.

The current B+ implementation uses the M1-derived `24.7×7.2` gameplay world. In B+ views, the mill and baking blocks are wall-attached facilities on the north wall at `z = bounds.minZ + 1.1`; no visible rail is rendered, and repositioning is an invisible X-only constraint. During manipulation the player follows the captured block/player contact by the exact actual block X delta, with player Z and relative contact preserved; W/S and other non-X input move neither entity, and collision blocking stops both. Outside manipulation the player remains free on Z. Carry visuals, authoritative held positions, and valid drops use the same constraint. Wall, true-contact-penetration, or player-overlap failures retain the held block; valid production-rail release preserves the exact finite held X, while the legacy path retains its explicit grid compatibility policy. This is implemented and automatically tested, but front/side manipulation feel remains in the human tuning gate; the legacy path is preserved only for explicit internal compatibility.

The public material sidecar is now active-attribution-only: 1,203 bytes, SHA-256 `8c9558b50f3a5f0a3b0eda656620992011fecd94269af0ac3fba0070bf164d77`. Public evaluation-history markers are guarded against recurrence; private asset history remains in `ASSET_LICENSES.md`.

## 2026-08-21 — First-pass stage balance implementation

- `TUNE-STAGE-BALANCE-FIRST-PASS-10-15-25` is the current numeric/policy unit. The frozen typed policy owns wheat spawn `1.25`, mill/heater base processing `2.40`/`1.65`, and Stage 1/2/3 `10/35`, `15/40`, `25/45` target-time pairs. Fast `1.8×/8s/6s`, Double `10s/4s/output2`, atomic active same-block Again+Double output4, token cap120, wheat cap30, and the existing score formula remain unchanged.
- GameState selects per-block processing duration from the policy while retaining an explicit uniform duration override for isolated fixtures. Again+Fast is derived from the configured Fast source as `1.8 × 1.8 = 3.24`; it reuses the existing Fast fuel/recovery/work owner and does not add a clock, loop, or score rule. Observation/absorption delays and radii are unchanged. Invalid production-block kinds and non-finite/non-positive Stage2/Stage3 target-time overrides fail closed before authority initialization.
- Focused command/evidence: `npx vitest run src/game/stageBalancePolicy.test.ts src/game/stage2Lifecycle.test.ts src/game/gameState.test.ts src/game/capacity.test.ts src/game/doubleModule.test.ts src/game/worldReset.test.ts src/ingredientPickDropInteraction.test.ts src/p4RPrimaryIntegration.test.ts src/stage0ProgressiveTutorial.test.ts src/playerRunning.test.ts src/stage3AgainModule.test.ts src/q40AssetRuntimeVisual.test.ts --reporter=dot` — `12 files / 329 tests PASS`, including the natural default Stage 0→Stage 1→Stage 2→Stage 3 target/time recurrence and fail-closed selector/override coverage. `npx tsc --noEmit`, build, privacy, `check:deploy`/readiness, `git diff --check`, and package-lock boundary pass. Full `npm run check` top-level exit is `1` because the same two inherited export fixture tests fail; `127` files and `1097` tests pass (`1099` total). Browser/human balance tuning remains pending.

## 2026-08-11 — I2 floor-wall seam correction

I2 keeps the authoritative M1 B+ X `[-12.35, 12.35]` / width `24.7` and Z `[-3.6, 3.6]` / depth `7.2` bounds, collision, camera, and block lane unchanged. Its I8S correction derives one finite visual outer rectangle from the shared `0.34` wall-thickness and `0.02` seam policy. The helper-derived current visual outer bounds are X `[-12.75, 12.75]`, Z `[-4, 4]`, footprint `25.5×8.0`; floor width/depth, north/south wall runs, east/west wall runs, bands, and contained corner boxes all use that rectangle, so floor edges and wall-run endpoints coincide without independent length formulas or background wedges. Human seam/game-feel approval remains pending.

### 이동 보조 입력 후보 — 구현 보류

현재 rail·collision·직접 운반 판독을 먼저 사람 gate에서 확인한다. Shift hold 달리기(A)는 짧은 이동 비용을 줄이지만 병목과 이동거리 판독을 약화할 수 있고, 단발 대시(B)는 wall/production collision의 swept·large/split 결정론과 조작 중 허용 규칙을 추가로 요구한다. 현재 추천은 C(걷기 유지)이며, 사용자의 별도 승인 전에는 run/dash gameplay를 구현하지 않는다. 재검토 시 현재 v007의 `Walking_A` playback-rate만으로 충분한지, `Running_A`를 validation-only 후보로 유지할지와 별도 run/dash gameplay 승인 여부, foot sliding·camera follow·input reset·lifecycle lock·접근성 영향을 사람 gate와 함께 확인한다.

이번 interaction UI delta에서는 authoritative 반경/hit-test를 유지하면서 active 범위 원과 visible rail 표현을 제거한다. E/Space는 canonical selector가 고른 단일 대상에만 world-space keycap으로 표시하고, 화면 밖·lifecycle lock·focus 상태에서는 숨긴다. 하단 `result-feedback`는 조작 도움말이 아니라 score reason/failure 상태이므로 필수 lifecycle 표현으로 유지하며, 별도 상시 도움말 패널은 두지 않는다.
## I1 current status — block manipulation authority

This supersedes the earlier fixed-player wording. Active B+ production-block manipulation now captures the interaction position without teleporting, accepts only raw A/D as X movement, and applies the actual block X delta to the player so the captured relative contact and player Z remain fixed; W/S or other non-X movement moves neither entity. Front/side modes expose deterministic `block-move-front`, `block-push`, and `block-pull` presentation proxies. Wall/block/player collision, canonical split-independent rail endpoints, compensated continuous travel, exact production-rail release X without grid snapping, no-tunneling movement, invalid-drop retention, lifecycle cancellation, and normal-authority restoration are implemented; front/side game-feel and human acceptance remain pending. I8 focused/full/deployment evidence is recorded in the current closeout entry.

## 2026-08-11 — I3 shared motion foundation

I3 adds only the reusable presentation foundation requested by the Motion Direction Guide: eight named presets, deterministic easing/value sampling, split-delta-stable controller time, reduced-motion immediate completion, interrupt/restart/cancel/reset cleanup, and an exact-once event ledger. No existing output/reveal/player consumer was broadly retuned and no scoreboard, sound, character, Double, or Stage2 feature was started. Initial preset durations are tunable implementation candidates, not final balance or human visual approval. I4 may consume this foundation only after the I3 reviewer gate passes.

Final I3 technical evidence is full check `236/236`, build main `680.21 kB` with lazy GLTFLoader `44.80 kB`, and check:deploy public `6 files / 496,195 bytes`, runtime `492,728 bytes`, audio `0`, dist `12 files / 1,897,273 bytes`, preview cleanup verified. Working privacy has `85` candidates and `0` findings; staged privacy is `0/0`. The module is not imported by the runtime bundle, so prior browser presentation evidence remains unchanged; human motion polish is pending.

## I4 current status — physical score board

 I4 connects the shared I3 motion foundation to the existing physical scoreboard only. The board is hidden behind the north wall, rises vertically above the wall for a score-only numeric count, holds, and falls vertically behind the wall again. Its Z coordinate is fixed behind the wall; no forward extrusion, stage/goal copy, new score HUD, or authoritative score/lifecycle change was introduced. The existing lifecycle failure/wall RESET path and device pause/cleanup remain separate and are not replaced by the board.

Technical evidence: scoreboard plus motion focused `13/13`, full check typecheck plus `240/240`, build main `683.48 kB`/lazy GLTFLoader `44.80 kB` with the existing >500 kB warning, and check:deploy public `6 files / 496,195 bytes`, runtime `492,728 bytes`, audio `0`, dist `12 files / 1,900,544 bytes`, preview cleanup verified. Working privacy is `87` candidates/findings `0`; staged privacy is `0/0`. Browser smoke at `800x600`, `1280x720`, and `1920x1080` confirmed the initial board is hidden, the current screen has no added score/goal overlay, and no console warning/error was captured; completion/failure live motion still needs a reviewer/user browser pass. I5+ remains blocked until the I4 reviewer gate passes.

## I5 — collected SFX and minimal settings (current work unit)

I5 integrates only the legally safe CC0 pickup source. The active public payload has `pickup-mouth-pop.wav` (88,244 bytes, SHA-256 `D604FFB77E3E794886BD3AEF0DAF54AB7AF8CA980712997B50A5567A7EF7DC43`) and its manifest. `material-picked-up` and `stack-increased` use one `pickup_admission` cue with zero cooldown and exact-once admission semantics. The selected Adobe deposit/output WAVs are held out because raw public serving would be standalone source redistribution; those events and all non-whitelisted families remain silent. Set A/v2 remains rejected/history only.

The small top-right settings control exposes only SFX master volume and mute, with conservative default, persistence/clamping, accessibility, and gameplay-input isolation. It is independent of audio unlock and does not preview, download, or create sound. Focused/full/deployment/privacy evidence and browser settings checks are implementation gates; final listening and volume approval remain pending. I6 character work and I7 motion polish do not enter this unit.

## I5 technical verification closeout (supersedes the prior I4-gate hold)

I4 reviewer PASS was accepted before starting I5. Audio/settings/deployment focused coverage is `37/37`; exact full check is typecheck plus `242/242`; build is main `679.68 kB` with lazy GLTFLoader `44.80 kB`; and check:deploy passes public `8 files / 585,398 bytes`, runtime `580,972 bytes`, audio `1 WAV / 88,244 bytes`, dist `14 files / 1,988,288 bytes`, with preview cleanup. Working privacy is `91` candidates/findings `0`, staged privacy `0/0`, and pre-push origin audit has `0` new commits/blobs. Browser checks covered `800x600`, `1280x720`, and `1920x1080` settings placement, slider, mute/restore, reload persistence, keyboard isolation, and empty console logs. Human listening and final volume approval remain pending.
## I6 current status — user-authored character motion runtime (2026-08-11)

This section supersedes earlier v005/v007-default wording in the current status rows. The default runtime candidate is `stage1-worker-user-motion-v008.glb` (331,360 bytes, SHA-256 `570a79b751234d5e8fd32ea9b4d3b96258240f76735065a4b6837ea97056a0c4`) with the versioned v008 license sidecar. v007 remains the explicit `?character=v007` rollback/fallback, v005 remains `?character=v005`, and v002 remains `?character=legacy`; a failed candidate load or exact action contract retries v007/v005 before the procedural player fallback.

I6 admits the exact eight actions `Idle_A`, `Walking_A`, `Holding_A`, `CarryWalking_A`, `Running_A`, `BlockPush_A`, `BlockPull_A`, and `BlockMoveFront_A`. Running is validated only; no run/dash input is added. Block clip selection consumes measured authoritative block displacement and the existing I1 front/side presentation mode while the player position, collision, X-only block movement, lifecycle, camera, and timing remain unchanged. The v008 block clips additionally use a provisional 1.6 m/cycle accepted-displacement phase for stepping; browser runtime, human motion/stride, stack contact, and final visual approval remain pending. I7 general motion polish is not part of I6.

## I7 existing presentation motion quality — current implementation (2026-08-11)

I7 is limited to existing gameplay events. The I3 shared motion presets and exact-once ledger now drive short source-hold/burst/soft-settle output, captured-point pickup, renderer-resolved visible input-pocket/slot insertion and submission, token-only lifecycle cleanup, and a low-amplitude active-device signal. Existing authoritative state, score, timing, collision, input, camera, character, audio, and asset contracts are unchanged. Current procedural/source output points remain the fallback-safe visual origins; rejected Tripo derivatives and overlays are not integrated.

The selected E/Space target keeps one on-screen keycap and may receive one subtle contact highlight; off-screen, focus, and lifecycle suppression hide both. A terminal Stage 0/Stage 1 bread transfer remains alive through the completion latch until it reaches the visible dock slot, while failure/wall RESET/blur/pagehide still clear it immediately; reduced motion snaps it to the slot before cleanup. Interaction radii, help UI, global token lighting, and extra HUD remain absent. This is technical implementation evidence only: browser motion/occlusion/readability, stack and device feel, performance, listening, and final human approval remain pending until reviewer/user verification.

I6 technical closeout evidence is player-runtime focused `17/17`, affected focused aggregate `137/137`, full check typecheck plus `247/247`, build main `682.43 kB` with lazy GLTFLoader `44.80 kB`, and deployment readiness public `10 files / 916,586 bytes`, active/rollback runtime binaries `911,140 bytes`, audio `1 WAV / 88,244 bytes`, and dist `16 files / 2,322,227 bytes`; working, staged, and pre-push privacy scans passed with zero findings. Browser smoke at `800x600`, `1280x720`, and `1920x1080` loaded the then-current default v007 and explicit v005 rollback with no captured console warning/error; I8M supersedes that default with v008. These are technical checks only; final motion, stride, stack-contact, and human visual approval remain pending.

## I8 current status — block follow-delta (2026-08-11)

I8 supersedes the earlier fixed-player interpretation. Space captures the current block/player contact without teleport; raw A/D moves a wall-mounted production block along X and applies its exact actual delta to the player, preserving relative contact and player Z. W/S/other movement is ignored, A+D is zero, and wall/player/other-block collision or bounds stopping holds both at the same contact endpoint. Invalid drop retains manipulation; release, lifecycle, and blur restore normal player authority, while wall RESET is the sole gameplay attempt reset. Front/side presentation remains the v008 `BlockMoveFront_A`/`BlockPush_A`/`BlockPull_A` mapping; the I8M stepping phase is presentation-only. I9 wall reset and later units remain unstarted.

I8 evidence: focused GameState/input/player-runtime `111/111`; full check typecheck plus `262/262`; build main `691.37 kB`, lazy GLTFLoader `44.80 kB`; check:deploy public `10 files / 916,586 bytes`, runtime `911,140 bytes`, audio `1 / 88,244 bytes`, dist `16 files / 2,331,167 bytes`, privacy and preview cleanup passed. Browser front/side feel and human approval remain pending.
## I8M current status — v008 block-manipulation stepping (2026-08-11)

I8M makes v008 the default character runtime candidate and keeps v007 at `?character=v007` as an explicit rollback/fallback, with v005/v002 older rollback paths and procedural load-failure safety. The three dedicated block clips bind to a provisional `1.6 m/cycle` phase derived only from accepted block X displacement; zero/blocked/lifecycle delta stops phase advance and 1/2/3/60/600 frame partitions converge. No run/dash input, GameState rule, collision, grid, camera, audio, or layout change is included. Focused/full/build/deployment/privacy checks pass; browser stepping feel, stride, stack contact, front/side readability, and human visual approval remain pending. I9 wall reset and I10/I11 are not started.

## I8S current status — shared floor/wall visual rectangle (2026-08-11)

I8S keeps the authoritative M1 gameplay bounds X `[-12.35, 12.35]` / width `24.7` and Z `[-3.6, 3.6]` / depth `7.2` unchanged and corrects only the presentation seam. A single finite visual outer rectangle now owns the floor span, full wall and lower-band footprints, run endpoints, and corner intersections. The current helper-derived visual outer bounds are X `[-12.75, 12.75]`, Z `[-4, 4]`, footprint `25.5×8.0`; north/south runs use exact outer-rectangle X endpoints, east/west runs use exact outer-rectangle Z endpoints, wall centerlines derive from the same rectangle, and corners are wall-centerline intersections. The `0.34` wall plus `0.08` band thickness receives `0.02` perpendicular floor underlap. `main.ts` consumes helper-owned placement only; no visible rail, help, radius, camera, layout, or gameplay change was introduced. Focused seam coverage is `5/5`, full check is `270/270`, build main is `695.67 kB` with lazy GLTFLoader `44.80 kB`, and deployment/privacy gates pass. Browser evidence and final human seam approval remain technical/human gates; I9 remains blocked until I8S reviewer PASS.
## I9 wall reset authority/interface — implementation-owned slice (2026-08-11)

The current P0 reset slice owns a failure-time player-pose snapshot, a current obstacle snapshot, and one persistent physical reset authority: the nearest safe, visible playable-side wall is selected deterministically and frozen by stable id/generation/position until the exact button receives E. The physical button survives blur, pagehide, hidden, focus, and tab switching; only transient prompt/input/audio presentation may pause. Missing or invalid pose, stale generation, and unavailable candidates fail closed. Accepted in-range E emits one immutable `reset` snapshot and starts the reset presentation before the physical button is removed; a new failure creates one new generation. The integrated camera/suction/central scoreboard handoff and approved V006 compact goal display remain separate. I9 browser/readability and human reset-feel approval are pending.

## I9 latest presentation surface correction (2026-08-11)

The copied first-stage tutorial raw-text board and CSS/canvas keycap atom are `SUPERSEDED / DO NOT INTEGRATE` and are absent from the runtime preview. The existing Primary scoreboard is the single reusable physical template for central/tutorial/auxiliary roles; central timer/score/`CLEAR`/`GAME OVER` content remains on its independent dynamic panel texture/material surface. The tutorial semantic surface adapter composes decoded transparent PNG `W/A/S/D/E` standard and `SPACE` wide atlas regions plus Galmuri text into its panel map; the former full baked tutorial-panel PNG is reference-only and absent from public/runtime declarations. `SHIFT` has no gameplay binding. The earlier physical-shell asset fallback wording is `SUPERSEDED HISTORICAL / NOT CURRENT`; the active runtime uses the fixed code-native template and rejects GLB/Tripo scoreboard assets. Q24-E adds only the approved V006 dock geometry and one compact code-owned bread pictogram/current-target display at `goalBoardMount`; no dock scoreboard frame/backplate/panel/root is created and no board is baked into V006. Camera, suction, central board, and implementation-owned wall reset remain the current I9 scope; human visual/readability approval remains pending.

P4-A current scoreboard runtime uses the original fixed physical template: frame `4.15×1.55×0.26`, panel `3.8×1.25`, original frame/panel/glyph colors, and exactly `frame` plus `panel` children. Central, tutorial, and auxiliary roles share that factory and vary only world transform plus permitted uniform scale; each owns independent panel content/material. The earlier variable-size true 3D nine-slice wording is superseded historical reference only. CSS/projective/fixed-pixel, full-panel image, and GLB/Tripo paths remain rejected; Q24-E deliberately does not instantiate that factory for the dock and uses one compact code-owned goal display instead, with human visual/readability approval pending.

## P1 current status — continuous production-rail release/contact (2026-08-11)

P1 preserves the exact finite held X and fixed rail Z on successful production-block release; continuous rail release has no grid snap, while the explicit legacy/non-rail path retains grid compatibility. Captured front/left/right contact is accepted at the physical boundary and within the bounded release tolerance, while true penetration, wall/bounds, and other-grounded-block overlap retain the held block atomically. P1 focused/full/build/deployment/privacy checks pass; browser smoke at `800x600` and `1280x720` is console-clean, while complete front/side release feel remains a human gate. P2 and P3 are technically closed; P4-A is the current reviewer-gated unit, while P4-R/B/C remain queued. Scoreboard GLB/Tripo asset integration is rejected and is not a current path; human visual approval remains pending.

## P2 current status — corrected PNG world prompts (2026-08-11)

P2 replaces the stale teal-border prompt package with the corrected black-outline atlas: 1x SHA-256 `a18d46e10a3f99eb9677a6e60470ae657c66a6b3df86073f12b0063d0293a640` and 2x SHA-256 `81b170ae08c0366308efb3a962df8fe83fa39c0b824246455a6f4374396f5272`. The source and served package metadata, UV manifests, provenance, license, and deployment allowlist agree on the same bytes, black border, alpha-zero exterior, and no-halo contract.

Primary has one reusable Three PNG-atlas world-plane consumer and one shared prompt boundary. Priority is authoritative reset E (when present), material/delivery E, then actionable production-block SPACE; target ID, position, action label, highlight, and atlas region cannot diverge. Suppression and cleanup cover hidden/out-of-range/off-screen/focus/page-hidden/lifecycle/held/non-actionable/atlas-unready states; `SHIFT` remains unbound. P2 and P3 are technically closed, and P4-A is current with P4-R/B/C still reviewer-gated; human readability/visual approval remains pending. Scoreboard GLB/Tripo work is rejected and is not a current gate. Q24-E is the separate approved V006 dock/goal-board integration; B1/B2 and modules remain separately gated.

Verification: focused keycap/prompt/Three/asset suites `23/23`; exact full check typecheck plus `352/352`; build main `738.49 kB` and lazy GLTFLoader `44.80 kB` with the existing large-chunk warning; check:deploy public `20 / 1,464,629 bytes`, UI `8 / 215,542 bytes`, runtime `1,242,500 bytes`, audio `1 / 88,244 bytes`, dist `26 / 2,925,025 bytes`, privacy findings `0`, and preview cleanup. Browser matrix covered `bplus-ortho`, `bplus-balanced`, and `bplus-perspective` at `800x600`, `1280x720`, and `1920x1080` (9 loads), with one canvas and console warning/error `0` on every load. No stage, commit, push, or deploy occurred.

### P2 focus-gate residual correction

The shared gate now carries persistent window focus. Blur immediately clears the single world prompt/highlight and repeated RAF-style synchronization stays empty until a focus event; focus restores only the current authoritative reset/material/block target. The pure regression covers blur, three suppressed syncs, and one focused restore. The in-app browser matrix was rerun after a fail-safe guard for environments where `document.hasFocus` is not callable: 9 loads, one canvas each, console warning/error `0`. Final focused/full/build/deploy evidence is current; P3 remains reviewer-gated.

## P3 current status — ordinary floor put-down and repick (2026-08-12)

P3 adds the missing ordinary floor route without changing delivery authority. For a held material stack, compatible machine/submission targets remain higher priority; otherwise the existing E action attempts a deterministic reachable front-anchor placement for all held entries (1–5). Bounds, wall, player, device, production-block, module, existing-token, and pairwise token collision checks are atomic. Invalid candidates return `invalid-floor-drop` and retain the held stack; valid drops preserve identity/order/count and can be picked up again. Held Fast modules keep compatible attachment priority and otherwise use E for one ordinary-floor module entity with the same atomic retention rules; SPACE remains production-block-only.

The shared P2 PNG prompt path supplies the ordinary-floor E action target and continues to keep prompt, highlight, and executed action in parity. Floor-drop visuals use the existing nonblocking transfer motion after authoritative state mutation. Focused state/prompt/presentation coverage is `118/118`; exact check is typecheck plus `358/358`; build main is `744.87 kB` with lazy GLTFLoader `44.80 kB`; check:deploy passes public `20 / 1,464,629 bytes`, UI `8 / 215,542 bytes`, runtime `1,242,500 bytes`, audio `1 / 88,244 bytes`, dist `26 / 2,931,400 bytes`, working privacy findings `0`, staged privacy `0/0`, and preview cleanup. Browser evidence covers material floor drop and repick at `800x600` and material floor placement/prompt parity at `1280x720`, console warning/error `0`; live Fast-module browser flow was not run and remains covered by focused authority tests. P4 result/reset/suction/camera, B1/B2, balance, process-block assets, and final scoreboard work remain reviewer-gated.

## Q24-A current status - approved bread + worker v010a integration (2026-08-13)

Q45 is technically closed and Q24-A is the current isolated integration unit. The active worker candidate is v010a with fallback `v010a -> v008 -> v007 -> v005 -> procedural`; the active bread candidate is a separate validated GLB loader with procedural fallback. Approved transforms, hashes, sidecars, provenance, allowlist, and deployment-readiness checks are bounded to this unit. Held-contact/readability and human runtime approval remain pending. Wheat, flour, pipe, dock, modules, Q44, Stage2, and later asset work are not part of this unit.

## Q34 current status — normal-follow camera scale separation (2026-08-12)

The M1 bounds remain X `[-12.35, 12.35]`, center `0`, width `24.7`, and Z `[-3.6, 3.6]`, depth `7.2`; they continue to derive follow clamps and world anchors. The helper-derived visual outer bounds are X `[-12.75, 12.75]`, Z `[-4, 4]`, footprint `25.5×8.0`, and remain presentation-only. The normal B+ follow camera no longer consumes the M1 whole-map frame. It uses the pre-M1 player-relative baseline `12.8` orthographic height and `26` perspective horizontal distance, each multiplied by the existing `0.82` closer-scale token. The M1 map-wide/result frame remains a separate fit source, and result return seeding is unchanged. Q34 is camera/framing-only; P4-C, GameState, assets, physics, balance, Double, and Again remain untouched.

## Q24-B current status — approved Wheat V010 runtime integration (2026-08-13)

Q24-B integrates only the user-final-approved Wheat Color A runtime candidate. The dedicated GLB is loaded atomically with a procedural Wheat fallback; the older combined material payload remains a validated compatibility record and is no longer the live Wheat loader authority. The GLB bytes, embedded-image/no-external-URI structure, FrontSide material preparation, license/provenance sidecars, public allowlist, and SHA-256 are checked independently.

Held Wheat uses the approved uniform scale `1.08`, anchor `(0.005, 0.470, 0.844)`, Euler XYZ `(-90, +90, 0)` degrees, X step `0.118`, and upper-row Z step `0.077` for deterministic counts `1–5`. World/output/pile orientation remains future token-physics authority. Raw imported triangles are render-only; each Wheat visual owns one separate closed bottom-aligned box proxy for gameplay/collision/raycast boundary. Bread, flour, pipe, dock, modules, Q44, and later Stage2 work remain outside this unit. Technical browser/readability evidence is distinct from human approval.
## Q24-C current status — approved Flour V014 runtime integration (2026-08-13)

This section supersedes earlier active Flour procedural-default wording in this roadmap. The dedicated approved Flour V014 runtime is the current default: `stage1-flour-token-b2-v014.glb`, SHA-256 `270820ae7a5c21b5825da1d7284e6acd540544e93c08891773f9cab4f3ff8660`. Procedural Flour is only the atomic fallback after validation, load, clone, or preparation failure.

Wheat V010 and Bread V002 are the dedicated live material runtimes with their own atomic procedural fallbacks. The older combined material payload is compatibility-only for Wheat and is not the live Flour or Bread authority. Sidecar/provenance/license, embedded-resource/schema, transformed-bounds, allowlist, and deployment checks remain technical evidence; human visual approval remains separate.

## Q24-D current status - approved straight Wheat source V014 runtime (2026-08-13)

Q24-D integrates the user-final-approved provider-textured straight Wheat source runtime at public/assets/objects/stage1-wheat-source/stage1-wheat-source-v014-textured.glb, 3,013,048 bytes, SHA-256 adc78bf98b72ed807a26008e08f3273ddbc6570e5582b8a453f6c6dc29578bc8. The runtime uses the exact sanitized sidecar/provenance/license records, uniform scale 0.86, named spawn/exit anchors, one render-only root, and a separate axis-correct closed gameplay proxy. The proxy contains the independently computed scaled render Box3 with a bounded 0.000001m clearance and does not authorize visual geometry. Procedural straight-pipe rendering remains an atomic validation/load/clone/preparation fallback, and existing emission timing, token identity, and GameState authority are preserved. Dock, modules, Q40, Q44, and Stage2 are queued separately; technical/browser evidence is not human approval.

## Q24-E current status - approved submission dock V006 runtime (2026-08-13)

Q24-E integrates the user-final-approved wall-mounted V006 dock from `public/assets/objects/stage1-submission-dock/stage1-submission-dock-local-trial-v006.glb`, 51,544 bytes, SHA-256 `440a270cd78ee2c289e4e64d530b24a67e8909b35840df9af7182522d10e7cff`. The runtime validates the exact GLB schema/bounds, named anchors, sanitized sidecar, provenance/license, and deployment identity before an atomic swap. It uses a separate closed interaction proxy and preserves the procedural dock on any failure.

## Q24-F current status - calibrated token scale and player-local held orientation (2026-08-13)

Q24-F audits Wheat, Flour, and Bread together. The historical `0.92` / `1.12` sweep is superseded by the current `TUNE-INGREDIENT-VISUAL-SCALE` provisional first pass: Wheat `0.72`, Flour `1.36`, and Bread `1.36`. The typed profile is shared across held/world/output/pile and their separate closed gameplay proxies, while immutable asset/sidecar scales and bytes remain unchanged. Wheat's approved asset metadata scale remains `1.08`, and Flour's sidecar canonical scale remains `1.08`; these are distinct from the measured presentation calibration. The old Bread procedural `.64` visual branch is removed as a separate scale authority.

Held placement uses the normalized player-local forward/right basis and quaternion composition (`playerYaw * intrinsicRotation * stackOffset`) every frame. Wheat's flat-on-palm basis keeps head/grain outward and stem/base toward the player; world/output/pile roots remain identity-oriented and do not inherit player facing. Counts `1–5`, proxy containment, Q24-A/B/C/D/E, production, and GameState authority remain unchanged. Technical browser evidence is separate from human readability/hand-feel approval; the new ratios remain human-play tunable, and Q24-F does not start Q24-G, modules, Q40, Q44, Stage2, physics, or balance.

## Q40 current status - approved module and process-block runtime boundary (2026-08-13)

Q40-A is the current isolated presentation-asset integration boundary. The approved shared Fast/Double cube and separate Stage0 socketless / Stage1 socketed process-block GLBs are loaded only after exact hash, schema, named-anchor, transformed-bound, and actual GLTFLoader validation. Stage0 and Stage1 presentation roots swap atomically from the authoritative lifecycle phase; procedural visuals remain the fallback on any failure. GameState IDs, collision footprint, output/token authority, timing, input, and interaction rules are unchanged. Runtime labels/progress/capacity and the Fast label/gauge are presentation children only; Double material is prepared without Double gameplay. Q40-A does not start Q44, animations, Stage2, physics, sound, or later asset work. Technical browser/deployment evidence and human visual approval remain separate gates.

The dock keeps exactly one compact transparent code-owned goal display immediately above the dock at validated `goalBoardMount`; it composes the approved bread pictogram and live submitted/required counts. No additional PhysicalScoreboardTemplate frame/backplate/panel/root is instantiated for the dock, in either V006 or procedural fallback. V006 contains no board, bread, or UI art; the QA-only blue board and V005 provider inputs are excluded. Bread submission/transfer uses `breadContact` and dock-wide/suction framing uses `suctionTarget`; GameState submission radius, counts, scoring, and timing remain unchanged. Technical/browser evidence is separate from human runtime approval. Q40-A is the current isolated module/process presentation unit; Q44 and Stage2 remain queued.

## Q40-A current correction status (2026-08-13)

Q40-A now admits the exact approved cube and process GLBs only after byte/hash/schema/sidecar/named-anchor/GLTFLoader checks. Stage0 socketless and Stage1 socketed roots swap atomically from lifecycle state. Process render clones derive their floor placement from measured transformed bounds with `0.001m` contact tolerance, and their matching hidden proxies use the same visual offset without changing GameState or the `2.2m x 2.2m` collision authority. Imported and procedural process shells share the neutral soft-white `#f3f5f4` matte authority (roughness `.84`, metalness `0`) with coherent visible-mesh shadow flags. The front face contains only a large centered `분쇄` or `굽기` label; the named top-face frame places authoritative occupied (`stored + reserved`) / `block.capacity` above a horizontal authoritative progress gauge, neutral when idle. The old `진행`/denominator copy, colored front plate, cyan square, processing/reveal rings, feedback ring, and colored interaction halo are removed. `빠르게!` remains a separate module child and `두 배로!` is prepared but not instantiated. Human visual approval remains pending, and the Wheat pipe plate issue is explicitly outside this unit.

## P2 Fast E and exact socket insertion — current status (2026-08-13)

Same-unit correction: SPACE is production-block-only with no Fast/module
target, action, prompt, or message. Fast insertion and detach share one
transformed named-anchor controller, including outside-mouth approach,
moved-block endpoint updates, reverse detach, and bounded scale-only pulse.

Fast is now the bounded E-only module interaction slice. Empty-hand pickup and attached detach use E; held Fast attaches to the transformed Stage 1 `fastPocketSeat` through the named insertion axis/pivot or performs the deterministic ordinary-floor drop, with atomic retention on invalid operations. SPACE remains production-block-only, including while Fast is attached, and no Fast/module SPACE prompt or action remains. Stage 0 socketless blocks reject Fast attachment.

The approved insertion presentation approaches from the actual socket mouth, applies the deterministic whole-module 180-degree flip, seats at the authored transformed seat, and pulses. Its temporary proxy is noninteractive/noncolliding until handoff; the seated rear gauge and carried `빠르게!` label are named runtime children, and the label is fitted inside `frontLabelFace` from measured text aspect. Focused/full/build/deploy/browser checks are technical evidence; Fast live route and human visual/readability approval remain pending. P3 and later units are not started.

## Current sequential live-play queue (2026-08-20)

`BUG-STAGE2-NATURAL-TRANSITION-V014-MISSING` remains active for reviewer verification. The first divergence was in main's natural `stage2-started` presentation handoff: the event could precede the approved v010 source pair, and the previous one-shot request discarded the intent when the existing transform owner returned `false` for missing targets. `q40Stage2NaturalTransitionComposition` now retains the event id/timestamp and shares main's install-variant decision: the existing v010 owner remains active until the current stage1-socketed mill/heater roots have the expected runtime identity, bindings, matching socket-bank snapshots, and exactly one `fast-pocket` member; v012/socketless, partial, stale, and mismatched pairs remain pending. Late v010 readiness is published through one shared reversible persistent-root/status/socket transaction consumed by main and the parsed regression. A rejected transform request remains pending with one explicit bounded retry: source-install, parsed-v014-ready, or focus/resume edges arriving before the first attempt retain one event-local credit, duplicate edges saturate, and the next eligible second attempt consumes it; after a second false steady frames add zero callbacks until a new valid policy edge, while reset/new-stage/invalidation clears the credit. After natural begin, main samples the current strict v010 pair plus the current requested/ready v014 generation/request authority and saturates the same event-local credit once, allowing startup-preloaded v014 to recover on the next ordinary composition without focus, reinstall, or republication. It then arms the same transform owner and leaves exact-two sockets, receipts, Double admission, and GameState authority to their existing owners. The production-consumed GameState Stage0→Stage1→Stage2 plus parsed v010/v014 regressions now run three explicit readiness orders: A v010-before-v014; B v014-before-v010 after the natural event; and C startup-preloaded v014 before the natural event with current v010. They cover shared late install where required, false-once→true retry, q40 lifecycle commit/transform midpoint, Double receipt/scene admission, and actual E pickup/attach; focused Q40 evidence is `38 tests PASS`. The a5 dock geometry is preserved and was not the natural-entry gate. Full natural browser/human Stage2 evidence remains pending.

`IDEA-E-PICK-DROP-ONLY` is implemented from baseline `e1abbc94076a7fbb6193dca83001dd6966645bfa`: ingredient/output E now means pickup when empty-handed and normal world drop when holding, with no direct ingredient delivery/deposit. The follow-on `BUG-HELD-INGREDIENT-STACKING-UNAVAILABLE` is an implemented partial-overlap live correction: below the existing five-token stack cap, an eligible nearby observed same-type world token wins the shared E target and is added once; production outputs join that rule only after the normal observation boundary while unobserved outputs remain ineligible; otherwise E remains the ordinary floor drop. The implementation preserves existing floor/world auto-intake, module E attach/detach, and other interaction owners; reviewer technical PASS is complete for this live bug while human play remains separate.

`BUG-ADJACENT-INGREDIENT-DROP-REJECTED` is the active implementation unit and is now in review. The reviewed production-block fix remains intact; the remaining live dock root cause was the square `1.1m` GameState surface versus the parsed V006 anisotropic proxy (`1.77m × 0.63m`, half extents `0.885m` / `0.315m`). At the production center `(9.9, -3.135)`, the parsed in-room face is `z = -2.82`, while the old square contract placed the face at `z = -2.035`. V006 stays at its authored wall mount and the dependency-neutral `SUBMISSION_DOCK_GAMEPLAY_GEOMETRY` contract now aligns GameState interaction/floor-drop/automatic-intake/player-navigation contact, the procedural fallback, and main V006 placement/proxy validation to that footprint. A valid ordinary forward drop remains first; when wall/object contact blocks it, GameState probes the nearest deterministic in-room face layout using existing collision, map/player/navigation/object/token, stack, and `2.25m` envelope checks. Full compatible block capacity and full dock goal retain collision geometry in the placement scan, while later intake remains full-gated. Generic production-block and module-versus-token ranking keeps the baseline scalar/radial metric; the dock-only ranking seam uses its anisotropic footprint. The independent production-view/parsed-V006 oracle covers all-cardinal blocked→recovery, production-block full→process-completion slot opening, persistent full-goal dock closure under large/split updates, and diagonal/corner priority; the focused suite is `8 files / 225 tests PASS`. No visual move into the room, renderer displacement, direct E submission, global radius change, or raw-mesh gameplay authority was added; human/browser dock-contact feel remains pending.

`BUG-BLOCK-MANIPULATION-BATCH-INTAKE` is the current implementation unit. The GameState update order now keeps automatic observation/reservation/absorption active for a held production block at its current authoritative position while `processProductionBlocks` alone pauses that block's work/progress and therefore does not reinterpret elapsed time on release. A held E stack is published as one ordinary-world batch; the next eligible simulation boundary stores all compatible observed members that fit in stable batch order, or only the stable prefix when capacity is partial, while ordinary world tokens retain the legacy `0.12s` cadence. The existing token presentation transfer owner consumes the same token-stored events at one frame timestamp for simultaneous accepted motions. Focused evidence is `5 files / 195 tests PASS` (batch-intake `6`, ingredient E `3`, P4-R `37`, token presentation lifecycle `8`, GameState `141`); broader lifecycle/Q40 checks remain regression gates and human/browser play remains pending.

The registered order remains: `BUG-HELD-INGREDIENT-DELIVERY-INTERACTION` is superseded history; `TUNE-SUBMISSION-DOCK-ABSORPTION-MARGIN` is closed; the reopened `BUG-STAGE2-GAMEOVER-DUAL-SOCKET-RESET` is implemented after reviewer technical PASS for its live reset/focus regression; `TUNE-INGREDIENT-VISUAL-SCALE` is closed and the `FEATURE-PLAYER-RUNNING` implementation is complete but in-review for the provisional hold-Shift `1.5x` movement pass and short-tap/M3-V0 authority delta; `STAGE3-AGAIN-MODULE-OWNERSHIP-VISUAL` is the current in-review Unit 2 beneath the Stage3 Again parent. Human running feel and tutorial redesign remain separate pending work.

The Stage2 lifecycle correction keeps the exact-two v014 Q40 request/roots through the intermediate full-reset transition, but reset pair resolution/cache is non-publishing: Fast and Double remain locked/non-presented until the existing reversible q40+Double admission transaction commits both together. That transaction publishes Fast at the pair's Fast pose and fresh Double admission at the pair's Double pose, and rolls both back on factory, q40, receipt, scene, or postcondition failure. The policy derives a disjoint physical/pickup separation from `max(2 × FLOOR_DROP_MODULE_COLLISION_HALF_EXTENT, 2 × PICKUP_RADIUS) + COLLISION_SEPARATION_EPSILON` using the shared dependency-neutral `0.68m` Q40 body (`0.34m` half extent), checks deterministic anchor-axis candidates against floor/map bounds plus current player/reset/button, grounded production-block, dock, and wheat constraints after lifecycle token cleanup, and fails closed as a complete pair if none is valid. Dynamic-token checking is not claimed after that cleanup boundary. Failure-hold Double remains visible but noninteractive, wall RESET preserves admitted module ownership, and blur/focus re-arms the current Stage2 request without selecting socketless roots or replaying an already-dual transform. Reviewer technical PASS is complete; browser/human replay remains pending.

`TUNE-SUBMISSION-DOCK-ABSORPTION-MARGIN` is implemented with reviewer technical PASS. It adds only the automatic `0.15m` tolerance needed for the measured `2.1626m` near-edge heater output to enter the inclusive `2.25m` automatic envelope; explicit interaction remains `2.1m`, and the later Stage2 lifecycle, ingredient scale, running, and Stage3 Again rows remain queued. Human play/feel approval remains pending.

## ARCH-ATTEMPT-RETRY-WORLD-PRESERVATION — current status (2026-08-20)

Wall RESET is the sole user-facing current-stage reattempt. The legacy gameplay Retry action/button/`R`/`Enter` path is removed; technical loader/factory/generation/installation retry and rearm remain. Wall RESET is not a model, block, module, or Q40 reposition/reload. The typed attempt transaction resets timer/deadline, submission progress, attempt materials/outputs/reservations/buffers/source/process elapsed, and current-attempt score to the stage-entry cumulative snapshot, while retaining completed-stage score, block/socket/root identity and pose, module identity/status/attachments/roots, and current Q40 generation/request/admission/receipt/active variant. It resets only Fast dynamics to fuel `8`/not overheated and Double dynamics to charging with `0` charge/active time. Failure hold preserves held block/module/material state until the transaction commits. The final `처음으로` full Stage0 restart remains a separate deferred unit; Stage3 now has a reviewer-verified lifecycle foundation in `STAGE3-LIFECYCLE-FOUNDATION`, while Again module/effect work and final balancing remain queued.

## STAGE3-LIFECYCLE-FOUNDATION — current status (2026-08-20)

Unit 1 adds the typed natural Stage2-success→Stage3 lifecycle with Stage3 policy values inherited from Stage2, stage-entry score checkpointing, same-tick success precedence, Stage3 failure hold, and wall RESET attempt semantics. Stage2 success is an intermediate same-world boundary: actual held Fast, held Double, and held production-block identity/status/heldBlockId/manipulation ownership survive natural bread submission into Stage3 while attempt materials still clean; genuine Stage3 completion keeps the existing terminal boundary. Stage3 reuses the admitted exact-two v014 roots/socket banks and Q40 request/generation/admission/receipt; it does not replay topology/transform/factory work or implement Again. The shared typed `stage3LifecyclePresentation` seam is consumed by main and the parsed-v014 production regression, which measures zero post-admission factory/model/transform/receipt/scene-binding work across Stage3 start, focus/visibility, failure, wall RESET, and resume; actual E-held Fast and Space-held production-block terminal cases are covered. Current focused production-consumed coverage passes (`6 files / 85 tests`); reviewer technical PASS is complete and this queue-scoped commit closes the automated gate. Full check remains non-green only for the two inherited export fixtures; human/browser approval remains pending.

## STAGE3-AGAIN-MODULE-OWNERSHIP-VISUAL — current status (2026-08-20)

The transitive current-bank region now uses indexed exact-member checks with scalar Map.get/size only; the source guard rejects iterator protocols and per-call object/function forms. The parsed blocked/recovery oracle runs 600 blocked production calls with Q40 generation/request/admission/receipt/root/socket authority unchanged, then one Again admission and 600 steady calls without duplicate work.

Unit 2 is in review. Natural Stage3 entry admits one typed Again module (`또!`) through a finite GameState preflight and the main-consumed allocation-free composition seam, reusing the admitted exact-two v014 world. Fast/Double/Again share the max-two occupancy contract, full occupancy rejects a held third module without replacement, and stale socket/generation/root bindings fail closed. Again's shared cube is gray alone/world/held and transitions only presentation color to Fast yellow or Double cyan when paired on the same block; no Again gameplay effect is implemented in Unit 2. Parsed-v014/main-order tests cover null/throw factory and scene-bind faults with explicit rearm, both socket orders on both blocks through actual E interactions, full occupancy, current-bank corruption/stale-generation rejection, reset/focus/repeated entry, and color rollback/idempotence. Current focused evidence is `1 file / 11 tests PASS` plus the `5-test` queue registry; strict tsc, standard build, privacy, deployment readiness/check:deploy, diff, and package-lock pass. Full check is an honest top-level exit `1` with only the two inherited export fixtures failing; human/browser approval remains pending. Again+Fast remains a separate effect unit; the active-four Again+Double unit is tracked below; final overlay/처음으로 remains separate.

## STAGE3-AGAIN-FAST-REAPPLICATION — committed-superseded historical Unit 3 (2026-08-20)

This independently reviewable Unit 3 is now committed-superseded as a historical gameplay-effect unit beneath `MILESTONE-STAGE3-AGAIN-MODULE`, implemented against baseline `607012e81d4b3c6fd79951f431d66aa006c58c2f`. Its historical `3.6x` rule used `AGAIN_FAST_COPY_COUNT = 2`; that name/value and rule remain provenance only. Current behavior uses the named `AGAIN_FAST_REAPPLICATION_COUNT = 1` authority and derives `3.24x` as one additional application of the configured Fast `1.8x` source (`1.8 × 1.8`), with no multiplier, fuel, work, timing, or eligibility change. Only same-block Fast+Again attachment through distinct coherent current exact-two socket members enables the reapplication. Fast alone, Again alone, another block, world/held/detached, stale/corrupt bank, zero fuel, and overheat remain ineligible. `processingElapsedSeconds` is conserved base-equivalent work: each fixed slice adds `boostedDuration * currentMultiplier + (slice - boostedDuration)`, completion clamps to remaining work, and historical work is never reinterpreted when the module changes. The existing Fast eligibility decision drains fuel once and owns recovery; a partial-fuel slice emits one overheat event and continues at base rate after fuel reaches zero, with the existing recovery authority starting on later ineligible steps. A successful output commit stops that block's current fixed-step loop and discards leftover real time, so a second stored input has zero work, fuel, pulse, and `process-started` event in the completion step and begins only on the next deterministic step; output-plan null/commit failure remains terminal and retryable with the input retained. Parsed-v014/main-facing GameState regressions cover both blocks/socket orders, actual E attach/detach, action-boundary work preservation, exact completion/no-overrun fuel, partial-fuel `2.3h` work, the parsed two-input completion boundary, ineligible/corrupt controls, large/split output parity, and wall RESET module/Q40 identity. Focused Unit 3 evidence remains `3 files / 163 tests PASS` (`16` Stage3 Again, `142` GameState, `5` queue registry); strict TypeScript, standard build, privacy, deployment readiness/check:deploy, and diff/package-lock pass. Full `npm run check` remains an honest top-level `EXIT=1` with `124 files / 1022 tests`, `1020` passed; only the two inherited `export-chatgpt-sources` fixture failures remain. Reviewer verification and human balance/play approval remain pending; the active-four Unit 4 and final overlay/start-over remain separate review/queue boundaries.

## STAGE3-AGAIN-NONROTATING-INSERTION-PRESENTATION — current status (2026-08-20)

This is the next independently reviewable render-only presentation unit after the reviewed Unit 2 baseline. The retained `AgainInsertionPresentationOwner` consumes the existing transformed socket-seat capability and samples normal attach `0.60s` / detach `0.42s` paths, including the derived outside-mouth waypoint and small body-depth-based contact rebound; reduced motion is a bounded `0.12s` path. The authored `또!` quaternion remains fixed and no gauge, rotation, spin, flip, pulse, scale, opacity, proxy, socket, or gameplay authority is changed. The existing body-only companion-color owner remains the only color writer and uses the named gray/Fast-yellow/Double-cyan authorities; reset/lifecycle invalidation snaps it to the authoritative pairing. The main/test composition seam owns root application as the complete rendered pose, pickup source-world-minus-held-root child offset, acquisition sampling, pre-action capture, ordinary held handoff, hidden-time exclusion, and authoritative snap. The accepted pre-E rendered Again quaternion is now retained through pickup, ordinary held, drop/world, and subsequent attachment actions; an incompatible retained orientation fails closed without interpolation. Parsed-v014 production coverage drives actual GameState E pickup/attach/detach order through that seam and proves source continuity at `0/90/179.999/180ms`, `(0,-1)/(1,0)/(0,1)` facing quaternion parity, transformed-parent pickup, terminal-to-next-held-frame equality, retained sample/workspace identity, normal/reduced timing, pause/resume, zero child offset, unchanged Q40 counters, and shared held-acquisition motion. Current focused evidence is `3 files / 24 tests PASS`; adjacent parsed Q40/module-prompt/lifecycle coverage is `8 files / 99 tests PASS`. Current state is in review; technical gates pass and human/browser timing/readability approval is pending. Again+Fast `3.6x`, Again+Double `4x`, pacing, tutorial, and final overlay/처음으로 remain queued and untouched; capacity safety work is tracked separately by `TUNE-WORLD-TOKEN-AND-WHEAT-CAPACITY`.

## TUNE-WORLD-TOKEN-AND-WHEAT-CAPACITY — current status (2026-08-20)

This independently reviewable capacity unit is in review against baseline `027ccca62f8f03fa812f6ce7ec3a0fce901841f4`. The single dependency-neutral authorities are `WORLD_MATERIAL_TOKEN_CAPACITY = 120` and `ACTIVE_WHEAT_CAPACITY = 30`; they supersede the prior current `30`/`10` values without changing production timing, stage goals, wheat emission pacing, or the existing 1|2 Double output schema. The canonical token ledger, output plans, and bounded presentation pool use the total ceiling; the wheat source uses the wheat-specific ceiling and clamps cap-held time to one bounded pending wheat interval with no backlog for deterministic recovery after removal. Focused capacity/GameState/presentation/parsed-Q40/queue evidence is `5 files / 185 tests PASS`; strict TypeScript, standard build, working privacy, deployment readiness/check:deploy, and diff/package-lock pass. Full `npm run check` is an honest top-level exit `1` with `124 files / 1019 tests`, `1017` passed; only the two existing `scripts/export-chatgpt-sources.test.js` fixture failures remain. Again+Fast and the active-four Again+Double unit are separate gameplay-effect boundaries; pacing, tutorial, and final overlay/처음으로 remain queued.

## STAGE3-AGAIN-DOUBLE-ACTIVE-ATOMIC-4 — current status (2026-08-21)

This independently reviewable Unit 4 is active/in review against baseline `0de347aa62b3e9472f63bfed8b008b83501a2d6e`. The named `STAGE3_DOUBLE_AGAIN_OUTPUT_COUNT = 4` policy is selected only for a natural Stage3-active, grounded/admitted production block with already-active Double and admitted Again attached through distinct current exact-two v014 socket bindings. Double alone remains `2`; Again alone and inactive/charging/expired Double+Again remain `1`; stale/corrupt generation/root/bank/binding, duplicate socket, other-block, held/world, failure-hold, and final-result-hold cases do not select four.

GameState extends the existing output-plan/commit owner with one deterministic four-ID/position/landing-slot batch and one atomic all-four-or-none transaction. The net material ledger is checked after input removal; output-plan, capacity, commit, event, and presentation preflight faults retain the input/work and publish no partial outputs. `DoubleAgainOutputPresentationComposition` is the one main/parsed-primary preflight and quad-event consumer: it validates event/batch tick, occurrence time, source material, target, all four emitted IDs/order/positions, and current canonical token object/status/type/position identity before mutation. The concrete source port supplies a prepared `prepareOutputSources` transaction whose `commit()` adopts all four records at one event timestamp and whose identity-safe `rollback()` removes only this attempt's entries, preserving replacements/unrelated records. Duplicate, stale, swapped, incomplete, missing-source, conflicting, or full-pool presentation fails closed without partial records. Double's charge/active clock, Fast dynamics, processing work/completion boundary, observation, score, capacity/wheat authorities, RESET, Q40 identity, and lifecycle locks remain unchanged.

The parsed shipped-v014 production regression reaches Stage3 naturally, performs real Double/Again E pickup and socket attachment on both blocks and both socket orders, drives input through empty-hand E pickup, ordinary floor drop, and the next fixed-boundary batch auto-intake, proves actual before/at/after active-expiry output ordering (`4`/`1`/`1`), meaningful full-step split parity, other-block `1` isolation, two-quad A/B replay rejection after A retirement, malformed/missing/canonical-mismatch source rejection, bounded full-pool rejection, commit/throw/replacement rollback, near-cap success/rejection, exact four IDs/order and shared timestamp, and 600 steady post-recovery calls with no duplicate output/event work. The same action remains world-only with stored/reserved/work deltas zero; the next boundary absorbs the exact dropped ID once. Focused evidence is `5 files / 210 tests PASS`; strict TypeScript, build, privacy, deployment readiness/check:deploy, diff, and package-lock checks pass. The full `npm run check` top-level exit is reported separately because only the two inherited `scripts/export-chatgpt-sources.test.js` export-fixture tests fail. Browser/human output feel and balance approval remain pending. No third socket/model/topology, timing, tutorial, balance, final overlay, asset, audio, or package work is included.

## HARDEN-Q40-REQUIRED-ASSET-LOAD-TIMEOUT-RETRY — current status (2026-08-21)

This independently reviewable Q40 loader hardening unit is implemented against baseline `d281bfc41edb52b95c4ddafd27d059720cf40cc8` and remains in review. The required approved-only runtime set now uses one coordinator-owned `60,000ms` absolute attempt deadline, the existing maximum of three attempts, and retry delays of `150ms`/`300ms`. Each attempt receives its generation, `AbortSignal`, and one ordinary-abort port; required sidecar/GLB/body/parser paths and the optional Stage2 sidecar/GLB/body path propagate that signal while preserving sidecar validation, payload hash verification, and GLTF parse order. A first ordinary sibling failure aborts remaining attempt work before retry ownership is released; a deadline is an ordinary failed attempt and consumes one budget slot; lifecycle pause/cancel aborts stale work without consuming ordinary failure budget and resumes through the existing single-attempt lifecycle path. Late candidate or parsed-resource settlement is ignored and disposed through the owning boundary; the required parsed-source ledger is a non-retaining `WeakSet<object>` marked before disposal, so duplicate/throwing late cleanup cannot retain disposed graphs. Terminal success/failure clears timers, listeners, and controllers without changing approved-only visibility or introducing a fallback/loading UI. Main and tests share the typed optional Stage2 request/parse/validation boundary. Focused Q40 evidence is `44 tests PASS`; strict TypeScript and the standard build are required before reviewer closeout. Full check and human/browser verification remain separately reported; no Stage3, block-intake, tutorial, balance, or future effect work is included.

## BUG-STAGE2-NATURAL-FAILURE-RESET-AUTHORITY-MISSING — current status (2026-08-20)

This separate live regression is in review against baseline `26441bb9fb085b0e9a5b34e253f1bb4b93cdf85f`. Read-only tracing found that natural Stage2 deadline failure was incorrectly routed to `stage1-failure-hold`; the existing reset phase guards and Q40 lifecycle mapping consequently omitted the real Stage2 failure world. The narrow correction adds the typed `stage2-failure-hold` to the existing lifecycle, physical reset-button authority, player movement-to-button gate, Q40 v014 continuation, and main failure-camera/reset-preservation gates.

The production-consumed GameState sequence is natural Stage0→Stage1→Stage2 completion, Stage2 deadline failure, one synchronized wall RESET target, shared E reset, and same-Stage2 resume. It proves one button target/root path, exact-once reset request, held-material cleanup, held Fast and production-block preservation, Fast/Double dynamic reset, stable blocks/modules/Q40 generation, no v014 downgrade, and main primary-E routing when the player is empty-handed. Focused evidence is `4 files / 83 tests PASS` (Stage2 lifecycle `25`, wall reset `10`, main reset wiring `10`, Q40 phase retention `38`); Stage1/Stage3 existing regressions remain in the focused lifecycle file. Full and human/browser verification remain pending until the gates are run.

The queue remains in review. Stage3/Again effects, balance, tutorial, and final overlay/start-over are not part of this unit; the existing dock/capacity/input work is preserved.

The current delta closes the production-oracle gap with `src/i9Presentation/resetProductionComposition.ts`: main and the parsed natural Stage2 regression now consume the same retained failure-event, physical-sync, prompt, and non-repeat E dispatch boundary. The executable order is natural Stage0→Stage1→Stage2 with parsed v010→v014/q40 exact-two and Double receipt/scene admission, actual Fast/Double E pickup/attach, real deadline failure, collision-safe wall admission and physical root/controller, one shared E reset request, and same-Stage2 resume. Focused evidence is `4 files / 96 tests PASS`; the broader GameState/lifecycle/Q40/main/reset matrix is `9 files / 287 tests PASS`. Module/Q40 identities, roots, socket banks, scene parents, and generation/request/receipt counters remain stable; browser/human verification is still pending.

The reset physical implementation is now extracted to `src/i9Presentation/resetPhysicalProductionComposition.ts` and consumed identically by main and the parsed production oracle. The shared owner contains failure-camera/collision/wall admission, GameState authority synchronization, controller/readiness revalidation, and actual root application; no test-local wall/controller/root algorithm remains in the primary oracle. The exported `runI9ResetMainVisualFrame` is the single top-level frame entry used directly by main and the parsed oracle; its lower physical helper is internal to that slice. A typed physical-sync fault or skipped frame hides/clears stale root, retained snapshot/readiness, and RESET prompt authority; the next valid frame restores exactly one root/listener. No production boolean or test-only empty shortcut remains. Focused reset/Q40 evidence is `6 files / 117 tests PASS`; queue status remains in review and browser/human reachability approval remains pending.

## BUG-FINAL-RESULT-HOLD-WORLD-CONTINUATION — current status (2026-08-21)

This independently reviewable bug unit keeps the admitted completed Stage3 v014 workshop in place during the indefinite `final-result-hold`. The configured `createCompletedWorldProductionConfiguration` is the one main-used frame/lifecycle boundary: the live `syncVisuals` entry and the parsed primary both call its retained `runFrame` entry with concrete raw owner snapshots and concrete root/frame sinks. The shared boundary, not main or the fixture, owns candidate/variant/request/generation validation, lifecycle and logical-admission policy, approved/admitted count derivation, typed fault classification/routing, and module projection order before publishing one typed `stage2-completed-world` capability/frame. It validates final-result-hold, active Stage2, current parsed-v014 candidate identity, matching generation/request epoch, persistent `starter-block`/`heater-block` roots under the expected scene, exact-two current socket-bank bindings, and Fast/Double/Again logical, retained-proof, and installed visual roots. Main consumes the same frame’s active variant/count fields through its frame sink and final dataset path; stale or partial terminal state fails closed. Valid lifecycle pause/resume performs no Stage2 invalidation, request, transform, receipt, factory, scene, or root replay. GameState remains input-locked and frozen, while the two persistent roots, exact-two socket banks, and Fast/Double/Again identity/status/parent/binding/pose state remain stable and noninteractive.

The parsed production regression drives natural Stage0→Stage1→Stage2→Stage3 completion after real parsed v010/v014 exact-two Q40 and Double admission plus Again publication, performs actual Again/Double E pickup and socket attachment, then consumes the same configured production boundary through final-result-hold, focus/visibility round trips in both orders, 600 steady samples, real candidate/root/socket/Double/Again authority damage, A↔B unresolved alternation, same-generation recovery, epoch reset, and strict module-proof rejection. Each damaged frame hides retained readiness first; physical faults converge through one finite fault-bit attempt per validity cycle, while logical admission faults request only the exact committed GameState module proof. No valid-world repair issues a receipt, generation, factory, transform, or duplicate scene root. Focused evidence is `4 files / 95 tests PASS`; strict TypeScript and the standard build pass. Browser/human final-world replay, the final score overlay, and `처음으로` full Stage0 restart remain pending/separate work. No commit/stage/push/deploy was performed.

## FEATURE-CAMPAIGN-RESULT-FOUNDATION — verified foundation, activated by vertical slice

- Implemented the reusable domain/UI foundation: GameState-owned `CampaignResultSnapshotV1` plus `campaign-result-committed` result-id event, exact-schema completion-store owner, pure app-screen/result action state, and isolated responsive result DOM/presentation tokens. The following vertical slice is the first main consumer; the foundation itself remains dependency-neutral and does not own gameplay.
- Focused `npx vitest run src/campaignResultFoundation.test.ts src/game/gameState.test.ts src/game/stage2Lifecycle.test.ts --reporter=dot`: `3 files / 182 tests PASS`, including natural public Stage0→Stage1→Stage2→Stage3 submission, manual and automatic completion rollback with pending/active batch identity, partial committed-stage/set/map/order/duplicate/breakdown falsifiers, snapshot/ledger parity, duplicate/failure/fresh-campaign controls, exact-byte completion-store matrix, typed action transitions, isolated semantic DOM, CSS contract, and reduced-motion controller. Proportional Q40/Stage3/RESET/capacity/atomic-output coverage is `7 files / 122 tests PASS`.
- Standard TypeScript/build/privacy/deploy-readiness/diff/package-lock gates pass. Full `npm run check` is honestly classified top-level exit `1`: `129` files, `1112/1114` tests pass; the only failures are the inherited protected export fixture cases. Browser/human visual evidence is not applicable to the unmounted foundation and remains pending for the later activated result/menu slice.

## FEATURE-CAMPAIGN-RESULT-MENU-VERTICAL-SLICE — current status (2026-08-21)

- The typed `createCampaignResultProductionComposition` in `src/campaignResultProductionComposition.ts` is the single main/production-recurring result frame and lifecycle boundary. It accepts concrete raw GameState/lifecycle, completed-v014 Q40/module, physical central/auxiliary, camera return/follow-seed, result/menu mount, and persistence owners, and internally constructs the completed-world configuration and result application. Its ordered entry derives final-result-hold, physical presentation completion, hidden-board state, camera readiness, exact-two socket/binding and module identity validity, approved/admitted counts, lifecycle delegation, and overlay projection; callers do not pass pre-derived gate booleans, candidate/count/admission formulas, or parallel mappings. Main's visual-frame/transition/key/lifecycle paths and the connected parsed primary enter this same boundary. It consumes a matching `campaign-result-committed(resultId)` once, reads the immutable GameState snapshot by identity, attempts `createCampaignCompletionStore.writeCompleted()` once, and keeps persistence failure diagnostic-only. Before all raw-owner gates pass the overlay count remains zero.
- The same owner mounts one retained semantic result dialog, freezes the underlying canvas input/ARIA state, projects the authoritative cumulative score and four rows, pauses its caller-stepped entry while hidden/focused out, makes Escape a no-op, and handles click/Enter/Space through the one typed `campaign-result-go-main-menu` action. Routing is a contained destination-first transaction: prepare, append/mount, commit main-menu, remove/dispose source result, then dispose the completed run. Prepare/append false or throw cleans only the attempted destination and retains the result/world with the canonical retry message; source/presentation/run disposal faults are contained after admission. The menu retains the existing Settings access and has exactly one typed `튜토리얼` action. A valid completion record boots to the menu, while missing/invalid/unavailable records remain on fresh Stage0 and tutorial start never clears the completion key.
- Production recurrence: natural GameState Stage0→Stage1→Stage2→Stage3 submission produces the real result event/snapshot, and `src/stage3AgainModule.test.ts` now feeds the same `createCampaignResultProductionComposition` boundary with shipped v014 Q40/Double/Again owners, actual E/socket attachment, the completed-world production frame, real Three physical CLEAR/board-lower roots, and the result-camera follow-seed owner. The same top-level entry handles both focus/resume→blur/pagehide and blur/pagehide→focus/pageshow orders; it waits through each physical/camera/capability gate, authority faults fail closed and recover through the owning production path, and 600 steady frames preserve one root, one store write, zero route commits, zero duplicate mount work, and zero valid-world Q40/admission replay. The focused shared-boundary command `npx vitest run src/campaignResultApplication.test.ts src/stage3AgainModule.test.ts src/campaignResultFoundation.test.ts src/game/stage2Lifecycle.test.ts --reporter=dot --configLoader runner` is `4 files / 71 tests PASS`; the broader connected matrix is `12 files / 339 tests PASS`. Full `npm run check` has actual top-level exit `1`: 130 files and 1121/1123 tests pass; only the two inherited protected `scripts/export-chatgpt-sources.test.js` fixture cases fail. Browser/human visual and hands-on play approval remains pending; the later visual menu and one-minute mode are untouched.

## MODE-ONE-MINUTE-GAMEPLAY-COMPOSITION — unmounted implementation (2026-08-21)

- `src/game/oneMinuteGameplayComposition.ts` now re-exports the unmounted high-level readiness/gameplay factory owned by the GameState module. The single typed owner consumes the committed integer-unit policy, reads concrete existing GameState production/material/module authorities, owns run ID, readiness → countdown → active → result, pause/load, submitted-bread count, exact terminal ordering, immutable result event identity, retry, and exact-once disposal. The preparation owner exposes only raw state identity; GameState keeps a module-private WeakMap keyed by the exact genuine session and GameState created by the high-level factory. There is no constructor extra-argument admission, structural predicate, importable registry getter, claimant/controller, or public capability property. It does not add a campaign phase, target, failure hold, RESET, score authority, or parallel clock/processing/intake/module loop.
- The production-consumed tests use the actual GameState world owner, real wheat source and public E pickup/drop with next-boundary absorption, ordinary output1, Double2, Again+Fast3.24× fuel/work, same-block atomic4, commit-fault retry, real active dock transition, Fast/Double/Again public interaction, readiness fault recovery, paused countdown, deadline terminal, input lock, retry, raw bypass locking, retained-capability hot-path counters, composition-exclusive exact batch provenance, full-shape/Proxy/copied-method/cross-state/stale-identity attacks, dynamic namespace guards, a direct dynamic import of the internal module with plain/copied/Proxy bridges proving no callback runs, and getter/Proxy/nested-construction cleanup proving construction-turn isolation. The internal module now contains only typed contracts and the pure readiness projection; all runtime construction is GameState-owned. The pending session is consumed by exact options identity before constructor option access, and the separate in-progress marker rejects nested high-level preparation through `finally` cleanup. Focused evidence is `2 files / 43 tests PASS`; the connected command covering composition, GameState, policy, lifecycle, balance, Stage3, Q40, tutorial, and movement is `9 files / 316 tests PASS`.
- TypeScript, build, privacy, deployment readiness, diff, and package-lock checks pass. Full `npm run check` is honestly top-level exit `1`: `132` files and `1164/1166` tests pass; only the two inherited protected `scripts/export-chatgpt-sources.test.js` fixture cases fail. Main/menu/DOM activation, visual presentation, storage, and browser/human play remain future work.

## MODE-ONE-MINUTE-POLICY-FOUNDATION — inert foundation (2026-08-21)

The one-minute policy foundation is implemented as the dependency-neutral `src/game/oneMinutePolicy.ts` owner with no main/GameState/UI/storage/runtime wiring. It freezes the exact 60-second duration, named `100 × submittedBreadCount` score helper, fully revealed two-block/two-seat starting capability with four globally unique block-owned socket IDs, one unattached-floor Fast/Double/Again each, zero seeded materials, safe monotonic count rules, run-scoped result identity, exact-60 terminal snapshots, exact-boundary submission ordering, immutable result V1, and the exact two typed result actions/copy. Its pure lifecycle is `readiness → countdown → active → result`; the retained clock is integer `1/60` simulation units (`180` countdown / `3600` active), public seconds are derived, supported deltas are grid-validated, countdown overshoot is conserved into active units in the same reducer call, active time clamps at 60.00, and pause/load advance zero.

Verified evidence: focused `npx vitest run src/game/oneMinutePolicy.test.ts --reporter=dot --configLoader runner` is `1 file / 20 tests PASS`; proportional campaign-foundation/stage-balance/Stage3 atomic-output coverage is `4 files / 67 tests PASS`. `npx tsc --noEmit`, build, privacy, deployment readiness, and diff checks pass. Full `npm run check` is actual top-level exit `1` with `131` files and `1141/1143` tests passing; only the two inherited protected export-fixture cases fail. One-minute gameplay composition, route/menu/presentation activation, storage, new assets/audio, and human approval remain queued/future work.

## TUTORIAL-STAGE0-12-STEP-REWORK — current status (2026-08-21)

This isolated tutorial unit replaces the historical eight-step Stage 0 sequence with one typed authoritative twelve-step progression. Eleven steps are visible cards; `stage1-handoff` is the non-card terminal handoff. GameState owns pipe/mill/heater/dock reveal and mill-operation gates, including the attempt-local proof that can only be closed by the same mill's public Space pickup → measurable move → grounded drop. Main and the natural primary use one typed E/Space/action/transition/presentation composition. The production path is movement displacement → running displacement → wheat E pickup/drop → next-boundary wheat intake → public mill Space move/drop → operation → flour E pickup/drop → next-boundary heater intake → bread output/dock reveal → authoritative bread submission → natural Stage 1. Direct E delivery, proximity-only progression, raw Shift keydown qualification, zero/stale/wrong mill proof, and timer-only milling are rejected.

The existing success cue is reused exactly once per authoritative tutorial transition. The upper-center DOM panel renders shared W/A/S/D, Shift, E, and Space keycaps; success styling is green followed by transform-only upward travel and next-card entry from above, with reduced motion preserving the same states and no opacity animation. Stage 1 lifecycle hides/disposes the panel; the legacy Three.js tutorial-board role remains disabled, so no second root or input authority is introduced. Flour ordinary-floor drop is presentation-only until the later matching heater `token-stored` event, so no same-action intake is implied.

The current main-used `createStage0TutorialProductionComposition` is configured with concrete raw GameState, MovementInputState, panel, and typed audio owners; its application-lifetime movement-frame owner reads raw W/A/S/D/Shift, applies the same authoritative movement delta, measures actual before/after position, derives running only from a Shift-qualified displaced sample, and consumes the tutorial sample after movement. `createPlayerMovementProductionApplication` is the shared main/primary application slice for raw keydown/keyup, tap and frame advance; it sends the authoritative post-move distance once to the retained traveled-distance and movement-audio sinks and returns that same consumer distance to the camera/frame path. Stage1 terminal disposal detaches and drains the tutorial sink/reset state once but leaves the shared frame, keydown/keyup, tap, walk, run, and authoritative displacement path active; a later reset can attach one fresh tutorial runtime without an old observer/audio owner. Runtime observers and panel projection are non-authoritative fault boundaries: faulty listeners are isolated, a failed DOM projection hides the panel, retries only once, performs zero additional render/retry/audio/gameplay work over 600 steady syncs, and reopens only on a new authoritative/reset edge. It constructs the tutorial runtime/presentation owner, owns the focus-hidden clock, reset, and Stage 1 disposal, and the natural primary uses the real source/observation path rather than `addWorldToken`. Run completion is transactional around the authoritative pipe reveal, and the presentation/audio checks cover all eleven cards, shared keycaps, green/transform-only motion, unchanged opacity, reduced motion, hidden-time pause, and terminal disposal. Focused evidence is `4 files / 179 tests PASS` (`stage0ProgressiveTutorial`, `gameState`, `inputState`, `playerRunning`). Proportional audio/lifecycle/token/Q40/Stage3 regressions are `9 files / 219 tests PASS`; parsed Q40/transition/Again/tutorial-board siblings are `4 files / 84 tests PASS`. TypeScript and the production build pass. Browser/human responsive, timing, and readability evidence remains pending; no later balance, menu, result-overlay, asset, audio, or package queue was started.

## FEATURE-MAIN-MENU-VISUAL-ENTRY-INTEGRATION — current status (2026-08-21)

The final menu/mode integration slice is implemented in the working tree. `createCampaignResultProductionComposition` is the shared main/production boundary for campaign-run, campaign-result, main-menu, one-minute-run, and one-minute-result. It consumes concrete owners and owns typed action routing, destination-first preparation/append/commit/disposal, Settings/confirmation gating, lifecycle pause/resume, one-minute frame projection, and result/menu screen transitions. Main no longer owns a global Enter/Space tutorial shortcut or mode-specific score/storage/localized-text policy.

The valid completion record boots the exact two-card menu; nonvalid records boot fresh Stage0. Tutorial preserves completion persistence. One-minute uses the committed high-level composition and real readiness owner, projects the 3/2/1/시작! countdown, immutable active HUD, exact-60 result and typed retry/main-menu actions, and disposes the prior run only after the destination is admitted. Campaign result remains the existing one-action route and completed-v014 world continuation. The menu includes the frozen title/copy, one Settings node, static code-native silhouettes, responsive/a11y structure, transform-only/reduced-motion behavior, and active-run confirmation.

Verification: the focused integration command is `npx vitest run src/campaignResultApplication.test.ts src/campaignResultFoundation.test.ts src/game/oneMinutePolicy.test.ts src/game/oneMinuteGameplayComposition.test.ts src/stage3AgainModule.test.ts src/game/gameState.test.ts src/game/stage2Lifecycle.test.ts src/stage0ProgressiveTutorial.test.ts src/playerRunning.test.ts src/ingredientPickDropInteraction.test.ts src/game/stageBalancePolicy.test.ts src/game/capacity.test.ts --reporter=dot --configLoader runner` — `12 files / 304 tests PASS`. TypeScript, build, privacy, deployment readiness, diff, and package-lock gates pass. Full `npm run check` has actual top-level exit `1`: `131` files and `1167/1169` tests pass; only the two inherited protected `scripts/export-chatgpt-sources.test.js` export-fixture cases fail. Browser/human visual, responsive, and hands-on play approval remain pending. No commit, stage, push, or deploy was performed.

## FEATURE-MAIN-MENU-VISUAL-ENTRY-INTEGRATION — document-reload B status (current, 2026-08-22)

The selected B boundary is implemented in the current working tree. `DocumentBootIntentV1` owns exact prepared/commit records plus a ready marker and the completion admission table; boot selects menu, fresh campaign, or one-minute before mode-specific runtime construction. The commit-record write return is the conservative navigation point: pre-commit faults retain the source, while verification/read/reload faults leave the full shell inert and reload-pending. Same-URL reload is destination-first. `createMainProductionPipeline` is the one document-lifetime writer for simulation/movement, shared `ProductionWorldRuntime` sync, mode presentation, and render/camera order. Campaign and one-minute owners are bound to their exact GameState, with retained root views and bounded sync/rebind/dispose diagnostics; the committed campaign result application requires the document navigation port and no longer exposes the obsolete one-minute host-preparation/advance bridge or placeholder visual-owner route.

Current evidence: focused connected coverage is `13 files / 293 tests PASS`; `npx tsc --noEmit`, elevated `npm run build`, `npm run check:privacy`, elevated `npm run check:deploy`, and `git diff --check` pass. Full `npm run check -- --reporter=dot` is top-level exit `1` (`137` files, `1196/1199` tests), with only two inherited export-fixture tests and the independent P4-R RESET expectation failing. The isolated browser harness on `http://127.0.0.1:4174/browser-harness/` observed valid completion→two-card menu (one Settings node, inert canvas), menu→Tutorial with campaign diagnostics `roots=2/modules=1/lights=2` and W player Z `1.05→0.8700000000000001`, menu→one-minute with one GameState-bound runtime (`roots=2/modules=3/lights=3`), one-minute result/retry, result→menu→Tutorial, fresh Tutorial W, and Settings Cancel. BFCache browser events, responsive/human visual approval, and natural one-minute wheat→dock submission remain pending. The four independent bug queues remain open and are not closed by this boundary.

## FEATURE-MAIN-MENU-VISUAL-ENTRY-INTEGRATION — fourth delta status (2026-08-22)

The mechanics/presentation split is implemented: `advanceMechanics` performs selected movement/GameState advancement only, while `presentFrame` performs one retained world sync, mode projection, and render. The one-minute document RAF exercises zero, one, or bounded fifteen fixed steps and one presentation, and production-world root diagnostics now count retained roots at construction/adoption rather than using a fixed `129` value.

The requested single canonical production-world factory is not closed. Campaign still constructs its actual owner graph through the existing inline `main.ts` factories and binds it with `createProductionWorldRuntimeFromOwners`; one-minute still constructs through `createProductionWorldRuntime`. This remaining seam is recorded as blocked rather than hidden behind another wrapper or procedural copy. Fourth-delta focused evidence is `13 files / 294 tests PASS`; natural one-minute source-to-dock/output, native BFCache, and human visual approval remain pending. Independent RESET, Stage2 socket, E/intake, and scoreboard queues remain open.

Current B status: boot admission now selects menu, campaign, or one-minute before gameplay owners are constructed. Campaign and one-minute both instantiate the existing inline `main.ts` production graph once, with the one-minute composition's exact `GameState` selected before graph setup. The dead alternate `createProductionWorldRuntime` constructor was removed; the retained-owner adapter is not a second world factory. Focused connected evidence is `11 files / 268 tests PASS`; browser evidence covers valid menu, one-minute same-state Q40 roots, and real W/E input. Natural one-minute source-to-dock/output, native BFCache, responsive/human visual approval remain pending, and RESET, Stage2 socket, E/intake, and scoreboard queues remain open.

## FEATURE-MAIN-MENU-VISUAL-ENTRY-INTEGRATION — fifth delta one-minute startup boundary (2026-08-22)

`OneMinuteProductionStartupAdmission` is now the concrete startup owner for the one-minute document. It reads the exact composition/GameState identity, the current requested/ready stage2-v014 Q40 candidate and lifecycle, both grounded/visible production roots, both current exact-two socket-bank/binding authorities, the three current module roots/receipt identities, and the shared player/source/dock scene roots. No UI readiness boolean is supplied. The bundle remains in readiness while this owner is pending: composition start, countdown/HUD publication, mechanics advancement, and canvas input stay closed. A single successful admission starts the composition and pipeline; duplicate starts are idempotent.

The main-used Q40 stage2 commit now attaches the committed Double visual aggregate to the canonical scene before startup admission reads it. This closes the real `module-parent-double` production mismatch without weakening root-parent or socket validation. One-minute does not create the Stage0 tutorial raw owner; the static `#status-text` node is structurally hidden (`hidden`, `aria-hidden`, CSS `display:none !important`) throughout loading/countdown/active/result, so tutorial listeners/audio/panel projection do not participate.

Focused startup/pipeline evidence is `3 files / 13 tests PASS`; the proportional owner command is `13 files / 318 tests PASS`. TypeScript, elevated build, privacy, deployment readiness/check:deploy, and diff checks pass. Isolated browser evidence captured pending startup with inert canvas and 0×0 hidden status, then ready `stage2`/two-root/three-module admission with one active pipeline; active W moved the authoritative player z `1.05 → 0.1433333333333337`, and real E reduced the world token count while the same Q40/GameState path remained active. Natural one-minute source-to-dock completion, native BFCache, and human visual approval remain pending. RESET, Stage2 socket, E/intake, and scoreboard queues remain independent and open.

## 2026-08-22 — Sixth delta: startup owner and terminal load failure

- Added the concrete OneMinuteProductionStartupAdmission identity boundary and the cached OneMinuteProductionStartupOwner FSM. The production Q40 coordinator now reports exhausted-attempt terminal state; terminal startup latches once, stops admission/poll work, and presents one typed retry/main-menu failure surface.
- Added executable nominal-root/parent/visibility/generation/socket/module proof falsifiers, ready-cache/600-steady polling coverage, terminal callback exact-once coverage, and isolated terminal failure DOM disposal/action coverage.
- Verification is 8 files / 88 tests PASS for the focused startup/Q40/navigation suite; TypeScript, build, privacy, deployment readiness, and diff checks pass. Browser evidence covers fresh Stage0 W, valid menu, Tutorial reload, one-minute ready v014 roots/modules, W, E wheat transfer, result, and fresh retry. Natural wheat-to-dock, controllable loader-fault browser path, BFCache, and human visual checks remain pending. Independent RESET, Stage2 socket, E/intake, and scoreboard queues remain open.

## 2026-08-22 — B canonical module-owner startup receipts

- Removed the public/self-binding startup receipt surface. The startup module owner is read/validate-only; Fast canonical rebind, approved Double Stage2 installation, and Again canonical factory installation own opaque current receipts.
- Added an actual factory-connected copied/proxy falsifier. Focused verification is `11 files / 284 tests PASS`, with the current canonical-receipt/main wiring command at `3 files / 69 tests PASS`. TypeScript, build, privacy, deployment readiness, and diff checks pass.
- Full check is honestly top-level exit `1` (`136` passing files, `1204/1207` tests): two protected export-fixture cases and the independent P4-R RESET expectation. Live one-minute startup reaches active/ready with current receipts for Fast/Double/Again and same-state Q40 roots; natural public input reaches bread output, while bread-to-dock/output-combination completion and native BFCache remain pending. Independent RESET, Stage2 socket, E/intake, and scoreboard queues remain open.

## FEATURE-MAIN-MENU-VISUAL-ENTRY-INTEGRATION — B primary E bridge delta (2026-08-22)

The one-minute result application now resolves the currently installed runtime bundle for every one-minute keydown/keyup. The owning path remains physical window input → application → installed bundle → composition interaction → GameState; no UI-local E policy, direct state mutation, listener, radius, or parallel mechanics path was introduced. The bounded canvas trace proves the selected composition, runtime graph, and GameState are identical at the interaction boundary.

Current evidence is focused `3 files / 24 tests PASS` and connected `11 files / 285 tests PASS`. The in-range public browser trace recorded one physical non-repeat E at `active`: window/application/bundle/dispatch/composition `1/1/1/1/1`, identity matches all `true`, wheat held `0→1`, world `11→10`, result `picked-up-token(wheat-1)`. A pre-emission press returned `not-in-range` with world `0` and no target, so it is not counted as a bridge failure. The same browser run again reached natural wheat→mill intake→flour→heater intake→bread output; bread pickup→dock exact-one and the installed ordinary/Double/Again output matrix were not completed within the bounded browser runs. Native `pageshow.persisted=true` and human visual/play approval remain pending. Full check is top-level exit `1` (`136` passing files, `1205/1208` tests), with only the two protected export-fixture tests and the independent P4-R RESET expectation failing; the four independent bug queues remain open.

## BUG-GAMEOVER-RESET-BLOCKED-WHILE-HOLDING — seven-category production reset oracle (2026-08-22)

The reset attempt lifecycle now has a main-used production recurrence over empty hand, ingredient stack, output stack, production block, Fast, Double, and Again. Each category is prepared through public hold interaction, reaches a real failure, uses the physical RESET priority, follows the GameState-issued reset-request/stage-start lineage, rearms the current result/presentation owners, and admits both the next failure and next success once. The canonical policy preserves held production/module identity while clearing held material tokens; duplicate/repeat input and stale lineage remain closed. The connected focused oracle is `7 files / 128 tests PASS`; the honest full check is top-level exit `1` (`137/139` files, `1220/1223` tests), limited to two protected export fixtures and the independent P4-R expectation. Browser multi-cycle reset and human play remain pending; independent socket, E/intake, and scoreboard queues stay open.

## BUG-GAMEOVER-RESET-BLOCKED-WHILE-HOLDING — shared main reset composition (2026-08-22)

`createI9ResetAttemptProductionComposition` is now the named reset production boundary consumed by both `src/main.ts` and the connected parsed v014/Q40 primary. It reads current owner/root evidence, owns request/stage-start lineage and result rearm, and uses the GameState collision footprint while requiring the current visible approved roots. Stale/foreign lineage remains closed before physical cleanup. An accepted RESET clears the previous physical failure root, rearms the current result/lifecycle/camera-derived owners exactly once, and forwards one transaction identity to the existing suction and reset-camera owners; repeated cycles therefore cannot inherit a completed suction or camera state.

The connected evidence is still `7 files / 128 tests PASS`, now with explicit `begun → stage-started → complete` phases, distinct reset/suction/camera identities and root cleanup, seven public held-category paths, and an immediate failure→RESET→success control. Strict TypeScript, build, privacy, deployment readiness, and diff checks pass. Full check remains an honest exit `1` for the two protected export fixtures and independent P4-R expectation; browser multi-cycle RESET/suction/camera and human play remain pending. Independent socket, E/intake, scoreboard, B, Settings, and dead-code queues remain open.

## BUG-GAMEOVER-RESET-BLOCKED-WHILE-HOLDING — unbounded attempt rearm (2026-08-22)

The accepted reset correction is identity-driven and cyclic for every attempt until stage exit. `src/i9Presentation/attemptHandoff.ts` owns `active-attempt → result-presented(clear|game-over) → reset-in-flight → next-attempt-ready`; no finite attempt branch or accumulated attempt ledger exists. Main re-arms the stale scoreboard/result/camera/derived presentation state at the single world-reset boundary, then admits the actual matching GameState `stage1-started`, `stage2-started`, or `stage3-started` reset event through one typed stage-neutral API carrying the retained reset-request batch/sequence lineage. There is no synthetic Stage1 bridge, requested-stage replacement, or caller-supplied request relabeling path. Both a next failure and a next success are admitted after rearm; RESET itself remains gated by an authoritative game-over result. Focused evidence is `6 files / 82 tests PASS`, including 256 cycles, mixed result cycles, actual public GameState Stage1/2/3 reset batches, cross-attempt batch-lineage falsification, valid edge-order permutations, and stale/reordered/duplicate event falsifiers. Browser movement/E checks passed, while fresh natural failure/reset cycles and human play remain pending. Independent socket, E/intake, and scoreboard queues remain open.

## 2026-08-22 - Reset presentation runtime closeout evidence

- Added `src/i9Presentation/resetPresentationRuntime.ts` and its focused test. Main and the connected parsed Q40 reset primary use the same runtime factory; main adapts the existing suction ledger/roots and result-camera controller rather than creating a second animation system.
- The connected command is `9 files / 133 tests PASS`. It covers real cleanup-batch admission, seven public held categories, repeated fresh transaction identities, suction nonterminal/terminal/cleanup counts, camera return/follow-seed counts, pause/resume zero advancement, duplicate/late completion closure, and both next-failure and next-success result admission.
- Strict TypeScript, build, privacy, deployment readiness, and diff checks pass. The full check has real top-level exit `1` with `140` files and `1221/1224` tests; two protected export fixtures and the independent P4-R expectation remain open. Browser multi-cycle reset presentation and human play remain pending. No commit/stage/push/deploy was performed.
## Reset presentation owner boundary (2026-08-22)

The current reset work has a shared main/connected-primary factory with split suction and camera receipts. The focused connected command passes `9 files / 134 tests`; strict TypeScript, build, privacy, deploy-readiness, and diff checks pass. Browser multi-cycle suction/camera evidence and human visual approval remain pending. RESET, Stage2 socket, E/intake, scoreboard, B, Settings, and dead-code work remain independently open.

## Ordered campaign result handoff (2026-08-22)

Implemented the shared result-handoff phase owner and main stage-start deferral. Result identity is retained through the physical score/CLEAR/board/camera sequence; the actual next-stage event is replayed only after completion, and the active timer is armed at that boundary. Intermediate stages enter `next-stage-ready`; Stage3 enters `final-result-ready` before result admission. Stage3 application admission now exposes a typed physical diagnostic edge with raw owner values and first-false reason, without granting admission. Focused verification is `5 files / 94 tests PASS`; build, privacy, deploy-readiness/check:deploy, TypeScript, and diff checks pass. Browser evidence reached valid-completion menu → fresh Tutorial and menu → one-minute countdown/HUD; natural Stage3 timeline and human visual approval remain pending. The independent RESET, socket, E/intake, module, B, Settings, and dead-code queues remain open.

The main-consumer correction is now connected to that same owner gate: non-idle handoff phases keep mechanics, W/E/Space, active timer, and normal-follow writers inert, then reopen only after the retained stage-start transaction is consumed. Stage3 requires exact non-null `resultId` plus `final-result-ready`, and same-request payload changes are rejected without mutation. Final focused evidence is `6 files / 111 tests PASS`; full verification is `141 files / 1232 tests`, with the two protected export-fixture tests and independent P4-R expectation remaining separate failures.

The P0 deadlock correction adds `GameState.advanceStageSuccessTransition` through the shared runtime bundle and `MainProductionPipeline`. Main invokes this transition-only seam while the handoff gate is closed, allowing the existing 2.8-second success clock to emit the real stage-start batch without ordinary gameplay advancement; the same retained event is then replayed after presentation completion. Connected natural Stage0→1→2→3, large/split, missing-adapter, and pause recurrences are implemented; browser Stage3 remains pending.

## Reset owner-issued receipt correction (2026-08-22)

`createI9ResetPresentationConcreteProductionRuntime` now consumes `presentationOwners` from the main and parsed primary installation paths. Actual suction/camera owners issue the current receipts; the runtime validates exact owner identity and never mints or overlays a receipt. Post-side-effect stale snapshots recover without duplicate settle or camera begin. Focused evidence is `5 files / 58 tests PASS`; browser multi-cycle reset presentation remains pending and independent queues remain open.

## Canonical reset resource factory rework (2026-08-22)

The prior callback-bag wording is superseded. `createI9ResetPresentationConcreteProductionRuntime` now consumes `I9ResetPresentationProductionResources`, constructs the suction root/ledger owner and camera return/follow owner internally, and issues receipts only inside those private owner begin transactions. Main and the parsed v014 connected primary both pass `presentationResources` to the same factory; neither builds a sibling reset lifecycle owner. Focused evidence is `4 files / 54 tests PASS`; TypeScript, build, privacy, deploy-readiness/check:deploy, and diff checks exit `0`. Browser multi-cycle RESET/suction/camera remains pending, and independent queues remain open.

## BUG-SCOREBOARD-LATEST-PRESENTATION-PATH-REGRESSION — connected event retain/replay correction (2026-08-22)

The P0 transition-only GameState clock is retained. The main/primary boundary now uses `createI9ResultHandoffProductionComposition` so result admission occurs first, the real GameState `stageN-started` event is retained only on arrival, and the actual lifecycle presentation completion consumes/replays that exact object once before reopening the handoff gate. The connected primary no longer defers at result latch or supplies `complete: true`/direct handoff reset as its authority. Focused evidence is `6 files / 122 tests PASS`; TypeScript and the production result/lifecycle suites pass. Browser natural Stage3 result ordering remains pending; RESET, socket, E/intake, module, one-minute, B, Settings, tutorial, and dead-code queues remain open.

## 2026-08-22 - Result handoff fault-safe commit and nominal delivery

The main-used handoff now commits reset-session cleanup before clearing the retained stage event, and contains reset/replay callback faults in a closed phase with typed outcomes. The bundle-to-main delivery seam issues an opaque receipt tied to the exact current event array and bundle authority; copied/proxied/foreign receipts and scalar-cloned events are rejected while the genuine event remains usable. Focused verification is `6 files / 124 tests PASS`; full check remains exit `1` for the inherited export fixtures and independent P4-R expectation.

## 2026-08-22 - Shared failure-result RESET regression gate

The clear-handoff recovery boundary now leaves failure results on the existing physical RESET owner instead of treating them as clear-only stage transitions. Main/application gates keep mechanics, ordinary W/E/Space input, timer, and normal-follow closed during `game-over`, while advancing the real reset presentation and allowing only the canonical non-repeat E reset action. Connected automated coverage includes shared Stage1/2/3 failure gates; the browser run reached the natural Stage0 production chain but not the dock or a later-stage failure, so browser multi-cycle RESET remains pending. Focused verification is `6 files / 131 tests PASS`; the independent full-suite export-fixture and P4-R failures remain open.

## 2026-08-22 - Clear recovery retry and shared main RESET lane

### Verification update

- Completed the deliberate precommit recovery retry state machine and the shared main failure RESET lane. Focused connected verification is 7 files / 114 tests PASS; npm run check:deploy and git diff --check exit 0, with no index or package-lock changes.
- Honest full npm run check is top-level exit 1 with 142 files / 1250 tests (1247 passing): two inherited export-fixture failures and the independent P4-R reset-priority expectation remain open. Browser failure→RESET cycles and human visual approval remain pending; no independent queue is closed.

Implemented the bounded precommit recovery retry state machine and a single main-used failure RESET orchestration seam. The route owner can deliberately retry unavailable/write/readback/throw failures; successful commit remains inert and exact-once. Natural GameState Stage1/2/3 failure recurrences now drive the same gate → physical prompt/root → application → installed bundle → reset composition order, with repeat E and closed W/Space controls covered. Focused result/reset/lifecycle/Q40 evidence is `6 files / 95 tests PASS`; browser failure→RESET cycles and human visual approval remain pending. Independent queues and the inherited full-check failures remain open.

## 2026-08-22 - Module insertion presentation parity

The campaign and one-minute Fast/Double/Again paths now share the main pre-capture → authoritative interaction → presentation-application seam. One-minute attached Fast/Again no longer use a y=0/hidden mode writer, and Double uses the existing insertion timeline. Again’s retained nonrotating quaternion is paired with a transformed pivot endpoint so the semantic pivot reaches the v014 socket. Focused verification is `8 files / 150 tests PASS`; the full check remains top-level exit `1` only for two inherited export fixtures and independent P4-R expected-none versus actual-reset. Browser full dock/output combinations, native BFCache, and human visual approval remain pending.

## 2026-08-23 - Campaign-only migration Unit 1/4

- `FEATURE-CAMPAIGN-ONLY-DIRECT-BOOT-RESTART` Unit 1 is implemented in the working tree and awaits independent review. The actual production entry operations share `ProductionBootConstructionAuthority`: campaign construction/mount/start `1/1/1`, menu `0/0/0`, one-minute `0/0/0`, with the current Stage0 GameState/runtime/root/listener receipt and tutorial enabled. No hardcoded alternate-family zero is used as evidence.
- The terminal campaign result action is now exactly `campaign-result-restart` / `다시하기`, routed through one same-URL `CampaignRestartNavigationOwner`. Precommit failure retains the result/action/focus; verified commit makes the old source inert and prevents duplicate restart or BFCache resume.
- Main-menu and one-minute implementation files remain for Unit 3 forward retirement but are unreachable from production boot and campaign result. Focused production/restart/lifecycle/registry evidence is `10 files / 125 tests PASS`; strict typecheck, build, privacy, and deployment readiness pass. Unit 2 still owns the reopened result/RESET/completed-world bugs; this unit does not claim them closed. Unit 4 owns final documentation/browser closeout, natural Stage3 restart and human visual approval remain pending.

## 2026-08-23 - Campaign Unit 2 stabilization status

- The result-to-active-timer transition now keeps one central scoreboard root and enters timer mode only after the existing handoff gameplay gate opens. It no longer arms a main-local timer timestamp or replays the legacy `POP_OUT`, so the result board lowers once and the next timer does not perform a second rise. The accepted physical board/camera/follow order and the measured nonzero camera return remain unchanged.
- Completed-world validation remains fail closed for result admission, but a null/fault frame no longer writes `visible=false` into the already presented terminal Fast/Double/Again roots. Terminal module authority proofs now bind attached modules to the exact socket bank of their actual block rather than the unrelated last-active bank. The parsed Stage3 recurrence attaches Again and Double across different v014 banks, observes a transient invalid capability frame with root parent/pose/visibility unchanged, then recovers the genuine capability and result route.
- Focused production-connected evidence is `8 files / 150 tests PASS`; strict typecheck, build, privacy, deployment readiness, and diff checks pass. The full check is honestly top-level exit `1`: `145` files and `1281/1284` tests pass; only the two inherited export fixtures and the independent P4-R RESET-priority expectation fail. P4-B is green.
- Prior natural production evidence remains: Stage1 `GAME OVER` had approved/visible Q40 roots `2/2`, visible/parented Fast, physical RESET ready/visible, one public E reset, and resumed Stage1 gameplay. A fresh natural Stage2/Stage3 browser replay and Stage3 `다시하기`→fresh Stage0 were not run in this delta, so browser/human closeout remains pending and Unit 2 still awaits review.

## Final submission presentation correction — implementation complete, review pending (2026-08-23)

- `BUG-GAMEOVER-RESET-BLOCKED-WHILE-HOLDING` and the cleanup portion of `BUG-SCOREBOARD-LATEST-PRESENTATION-PATH-REGRESSION` now share one exact pre-cleanup transition delivery for ordinary and result-handoff transition-only GameState clocks. RESET pending snapshots merge once at the matching cleanup event; CLEAR/RESET suction uses actual token identities and existing Three roots.
- RESET camera completion retires its own exact return-controller receipt after applying the reset follow seed, so the following active frame reaches the existing normal player-follow writer instead of being intercepted by result-camera classification.
- `STAGE3-AGAIN-MODULE-OWNERSHIP-VISUAL` now includes the natural `again-admitted` reveal fall on the exact installed root, with pause/resume and a single terminal handoff to the accepted world/insertion owner. Straight/nonrotating insertion remains unchanged.
- Focused production-connected evidence is `6 files / 99 tests PASS`; proportional adjacent reset/camera/result evidence is `10 files / 92 tests PASS`. Typecheck, build, privacy, deployment readiness, and diff checks pass. Full check is `146 files / 1289 tests`, `1286` passing; only two inherited export fixtures and the independent P4-R expectation remain. Browser/human clear suction, RESET suction/follow, and Again reveal remain pending.
- Final ownership/performance rework removes steady-frame pre-cleanup capture (`600` steady frames: capture/allocation delta `0`; each real cleanup: capture `1`) and moves CLEAR/RESET root projection into one main-used suction owner. The main-connected recurrence now also follows RESET completion into normal player camera follow and routes natural Stage3 `again-admitted` through the same pipeline/frame owner before the world writer. Focused adjacent evidence is `10 files / 140 tests PASS`; full check is `146 files / 1291 tests`, `1288` passing, with only the same two inherited export fixtures and independent P4-R expectation failing. Browser/human presentation remains pending.
- Architecture closeout moves campaign `world.sync` behind the same frame owner's handoff gate and moves RESET presentation advancement into the exact orchestration instance shared by input and frame projection. The connected primary observes closed-gate player/world write delta `0`, open world writes `1/frame`, CLEAR suction before the gate, RESET root/camera/follow continuation, and natural Again reveal through the same order. A `600`-frame steady recurrence creates no frame input/context/snapshot; its only diagnostic snapshot is the explicit post-loop read. Focused adjacent evidence is `10 files / 141 tests PASS`; browser/human presentation remains pending.
- Final full verification remains honestly red only outside this closeout: `146 files / 1292 tests`, `1289` passing, with two inherited export-fixture failures and the independent P4-R reset-priority expectation. Typecheck, build, privacy, deploy readiness, focused connected tests, and diff/package/index checks pass.

## Submission presentation parity implementation — review pending (2026-08-23)

- The working tree now binds Fast presentation to the exact authoritative socket member, projects only the authoritative player root during failure movement, extends cleanup suction to retained current token/terminal-transfer roots, and routes natural Double admission through the shared module reveal motion owner.
- Focused production/adjacent verification is `10 files / 303 tests PASS`; strict typecheck and deployment readiness pass. The full suite remains independently red only on the two export fixtures and the P4-R expected-`none` versus actual-`reset` oracle (`147 files`, `1292/1295` passing).
- Browser/human confirmation of the occupied-slot, GAME OVER player, wheat/bread suction, and Double reveal visuals remains pending. These queues remain active until independent review and visible evidence; no commit, push, or deploy was performed.
- Final owner delta splits global new-attach coherence from module-local accepted reads and adds a parsed natural Double event through the same campaign-frame reveal owner used by main. Focused evidence is now `10 files / 304 tests PASS`; full verification is `147 files`, `1293/1296` passing with only the same two export fixtures and independent P4-R oracle failing.
- Socket/Double closeout makes acceptance provenance mandatory for every local read, moves it to a runtime-private GameState registry, splits Fast held-attach from attached-detach, and installs Double reveal as a bundle transition consumer. The focused production set remains `10 files / 304 tests PASS`; strict deployment checks pass and the honest full result remains `1293/1296` with only the inherited failures above.
- Final provenance closeout removes the remaining Stage1 one-member early read and scalar-only Fast/Double effect paths. The production-connected socket/module/main matrix is `10 files / 306 tests PASS`; strict typecheck and `check:deploy` pass. The honest full check is `147 files / 1298 tests`, `1295` passing, with only the two inherited export fixtures and independent P4-R reset-priority expectation failing. Browser/human module-effect validation remains pending.

## Q40/placement/RESET authority closeout — implementation complete, review pending (2026-08-23)

- Main and the parsed connected primary now consume the same named exact-two composition and the same concrete module-placement owner. Immediate Fast migration, Double admission/event publication, parsed-root reservations, and rollback are one production-owned order.
- RESET collision retries now consume an exact retained collision-authority receipt/version. The connected recurrence keeps 600 unchanged frames at read/search/retry delta `0`, then retries exactly once after a same-root transform/visibility/geometry/parent edge.
- Focused production/adjacent evidence is `10 files / 300 tests PASS`; strict TypeScript, build, privacy, and deployment checks pass. Natural browser/human Stage1/2/3 GAME OVER remains pending, and the independent full-suite fixture/oracle failures remain classified rather than masked.
- Follow-up ownership correction moves canonical-parent and final-receipt validation before the exact-two irreversible marker. Post-publish parent divergence and receipt rejection now restore the old Q40/GameState/event tuple. The exact-two plan also owns required Fast placement installation through the same reversible/final receipt edge; main no longer repairs that owner after success. Module placement replacement keeps hidden/locked prior bounds authoritative until commit, restores them on higher-level rollback, and suppresses collision-version churn for an identical effective reservation. Latest focused connected evidence is `7 files / 238 tests PASS`; browser/human remains pending.

## CAMPAIGN-V4-ARCHITECTURE-REPLACEMENT — direct implementation complete, closeout pending (2026-08-23)

The production source has been replaced by the v4 campaign-only graph. Fresh load creates no menu or one-minute route: all required GLBs, authored sockets, player animation, keycap, font, and current audio are validated before `CampaignGame` exists. `CampaignGame` owns Stage0→3, score and attempt baselines; Player, WheatSource, SubmissionDock, MaterialWorld, ProductionBlock/Socket, and Module each retain one state/root boundary. Balance remains Stage1 `10/35`, Stage2 `15/40`, Stage3 `25/45`, capacity5, held stack5, wheat30, Fast `1.8×/8s/6s`, Double `10s/4s/output2`, and active same-block Again combinations `3.24×` or output4.

Automated closeout is green (`34/34`, build, privacy, readiness, residue, diff). A production-preview run naturally completed Stage0→Stage1 and a Stage1 GAME OVER→R retry without state injection. Full Stage0→3 and all human visual/game-feel checks remain user-owned pending evidence, so the parent item is not marked shipped or deployed.

### First-audit correction — rework implemented, re-review pending (2026-08-23)

The previous “complete/green” statement is superseded by the first independent technical audit. Its six production findings have been reworked: canonical 12-step Stage0 effects, concrete scoreboard/suction/camera/block/module transitions, root-retaining retry presentation, exact code/action input contracts, resumed delta0, and retained audio settings/event routing. Current evidence is `9 files / 40 tests`, readiness with 16 assets, privacy findings0, and a fresh physical-input Stage0→1 plus Stage1 GAME OVER→R browser recurrence. The queue remains active until independent re-review and the pending Stage1→3/final-reload/human gates complete.

The second audit's presentation-owner race and hidden-load ordering findings are also reworked. Actual `CampaignGame` recurrences now cover same-frame Fast motion→GAME OVER→rapid retry and Fast motion→CLEAR without skipping either campaign transaction. Main synchronizes hidden/focus state at listener installation. Current automated evidence is `10 files / 44 tests` plus deploy/privacy/readiness PASS; independent re-review remains the technical gate.

The third audit's remaining pre-terminal placement read is closed by lazy plan construction after ordinary terminalization. The connected CLEAR recurrence now proves Fast terminal floor pose precedes Double placement and their final roots retain at least 1.15m separation. Main's exact lifecycle installation owner has a mutation-sensitive install→initial-sync→removal recurrence. Current evidence is `10 files / 46 tests`; re-review remains pending.

Independent re-review returned `TECHNICAL PASS` with no actionable findings. The implementation is technically ready in the working tree; the parent U8 item remains open only for the explicitly separate natural Stage1→3, repeated Stage2/3 retry, arbitrary module-order, final reload/second Stage0 and human visual/play gates. No commit or deployment has occurred.

### Expanded U8 connected evidence and placement correction (2026-08-23)

The production-connected U8 matrix now covers Stage1→final, repeated retry at Stage1/2/3, two arbitrary Fast/Double/Again attach orders, module-bearing block movement plus immediate E, pointer exact-one reload, and construction of a second fresh Stage0 graph. This expansion found and corrected the prior three-candidate reveal fallback: the shared reveal owner now keeps the authored front/left/right preference and then uses a deterministic bounded grid with pairwise spacing greater than twice the named configured minimum. For the supported player + two-block + two-prior-module graph this guarantees a hard-safe terminal; no overlap fallback remains.

The added actual-root recurrence blocks every authored candidate with a live production block and proves the revealed module remains inside the configured bounds and at least the configured `1.15m` from player, both blocks and prior modules. Current evidence is focused `2 files / 9 tests PASS`, full `10 files / 49 tests PASS`, plus build, privacy findings0, readiness16 and diff-check PASS. U8 remains open because this connected automation is not the specification's uninjected natural browser traversal or human visual/game-feel approval. No stage, commit, push, or deploy has occurred.

## CAMPAIGN-V4.1-EXPRESSION-RESTORATION — implementation active, human gate pending (2026-08-23)

The latest user specification reopens presentation closeout without reverting the v4 campaign architecture. The working tree now owns the approved M1 B+ map through `CampaignMap`, dedicated authored-asset preparation, V006 dock goal board, model-face block/module labels, restored `i9-physical-scoreboard-template-v001` central/auxiliary roots and world E keycap. The temporary top HUD, `cloneSized`, floating labels, one-off scoreboard and gameplay object fallbacks are removed. Required GLBs are admitted by exact byte/SHA-256, parsed bounds/inventory/anchor and prepared scale/axis/pivot/bounds checks; all seven shipped sidecars have exact byte/SHA-256 and schema/asset checks. Automated connected verification and a fresh production preview reach Stage0 with no top HUD; full natural Stage0→3 and user visual/play approval remain pending, so this item is not complete or deployed.

## CAMPAIGN-V5.1-STRUCTURE-EXPRESSION-RESTORATION — implementation verification active (2026-08-23)

The v5.1 final integrated authority is implemented in the coherent uncommitted v4/v4.1 replacement tree and awaits deployment preflight, fresh production-browser evidence, independent re-review, and the user-owned natural/human gate. The production graph remains `main.ts` → `CampaignBoot` → `CampaignGame`. Current connected coverage consumes real CampaignGame objects and shipped player/block/module roots for the three-wall room, aspect-safe camera, swept player/equipment collision, authored animation selection, exact keycap target ownership, one-to-five held stacks, pipe and block output anchors, deterministic non-overlapping material/module terminals, X-only block manipulation, stable socket migration, module expression/effects, physical result sequencing, all timed retries, final pointer restart, and a fresh Stage0 graph.

Current automated evidence is `npm run check` exit `0` with `13 files / 65 tests`; `npm run check:deploy` also exits `0` with TypeScript/build, Vite `44` modules, privacy `485` candidates / `202` files / findings `0`, and readiness `23`. A fresh production document at `1280×720` completed strict loading into `playing:stage0`, matched CSS and renderer backing sizes, and observed one real canvas KeyW at `inputCount=1`; an earlier same-build physical sequence advanced walk→run→pipe reveal, spawned real wheat and completed E pickup plus five-item stack/drop. Natural uninjected Stage0→3, Stage1/2/3 GAME OVER play, final reload into a second real document, and human visual/game-feel approval remain open and are not claimed. No stage, commit, push, or deploy is authorized or reported.

### 2026-08-24 reviewer P1 rework

The first v5.1 audit found four remaining production divergences. The transparent button-only GAME OVER action, typed held-module floor-drop selection, and required-step presentation fault/cancel/disposal paths are implemented. Retry follows suction → reversible baseline projection → same-player camera → receipt-bearing dock/scoreboard preparation → receipt-validated scalar reset publication. Connected coverage samples camera 25/50/75%, injects draw/terminal faults, removes resetProjection and invalidates each receipt independently; all require mutation-call0 before receipt validation, snapshot equality, playing0, button reopen and a clean second R. Ordinary active-scoreboard frames use retained scalar values rather than retry receipts, so 600 unchanged frames generate/draw0 and only a displayed-value edge redraws once. Focused `2 files / 25 tests` and full `13 files / 75 tests` pass; `check:deploy` passes with Vite44, privacy485 candidates/202 files/findings0 and readiness23, and `git diff --check` exits0. Sixth same-context review returned TECHNICAL PASS with no actionable finding. Natural/human gates remain pending.

### 2026-08-24 screen/expression restoration delta

The latest user screen-expression correction is implemented without changing campaign rules. Boot retains and applies the latest viewport before first render and LoadingScreen owns a contained thumbnail. The first review invalidated the earlier surface oracles; rework now centers block surfaces from shipped semantic frames plus body-only bounds, interprets the V006 goal board toward the playable interior, and gives Fast/Double their approved body materials and an actually visible rear gauge plane outside the cube. Actual shipped roots exercise world/held/nonterminal/terminal module states and attached-block movement. The user's immediate correction explicitly forbids the obsolete Stage0 physical tutorial scoreboard: the approved tutorial surface remains, central active Stage0 content stays hidden, and the dock compact board owns the goal. Same-context re-review returned TECHNICAL PASS with no finding; full automated verification is `13 files / 77 tests PASS`. Human block/dock/Fast/result-camera comparison and natural Stage0→3 remain pending.

### 2026-08-24 human-play reopen implementation candidate

Latest user evidence partially reopens both v5.1 queues and supersedes only Space input semantics and retry pose choice. The shared invariant remains one current authoritative action/root/effect scalar and one approved physical-surface asset/lifecycle. The working-tree candidate now uses transparent atlas-only world keycaps, sharper block labels, toggle Space capture, exact failure-pose retry, ready-on-admission/retry and idle-recovering Fast, authoritative module landing commits, no socket rings, the approved dock bread pictogram, sequential earned-score components, and shared exact `Galmuri11` weight-900 scoreboard typography.

Automated candidate evidence is `13 files / 83 tests PASS`; deployment validation reports Vite `47`, privacy `488` candidates / `205` files / findings `0`, and readiness `24`. Fresh browser smoke reached `playing:stage0`, loaded the exact bold face, showed transparent tutorial keycaps, and logged no browser errors. Same-context technical re-review and the user-owned natural Stage0→3, module/retry/CLEAR and visual gates remain pending, so earlier technical-PASS status does not close these reopened boundaries and no commit/push/deploy is authorized.

The final pre-review reconciliation also restores renderer-capability maximum anisotropy on the oblique block glyph surface and the approved Double clock rule: charge/active time continues after admission in world, held and socket states, while the output effect is socket-attached-only. The connected Boot path proves the renderer capability reaches the actual label texture, and mechanics coverage proves detach stops effect without stopping time and reattach uses only the remaining active interval.

Same-context re-review is now `TECHNICAL PASS` with no actionable finding. The reviewer independently confirmed focused `2 files / 32 tests`, full `13 files / 83 tests`, Vite47/privacy488/205/findings0/readiness24 and diff/index/package-lock integrity. Natural Stage0→3, human retries/module sequences/CLEAR/visual approval and deployment remain pending; no stage/commit/push/deploy is authorized.

### CAMPAIGN-V5.1-BALANCE-STAGE0-TUTORIAL-CORRECTION

This latest-user supersession is a partial overlap with the existing v5.1 CampaignConfig/tutorial owners. The implementation candidate changes the shared wheat interval to `1.5s`, timed stages to `5/30`, `10/30`, `30/60`, and replaces the old 11-card/12-step onboarding with ten ordered cards. The initially proposed direct-insert branch was removed after the reviewer correction: public E still drops the same root to the floor, and exact-ID automatic intake is the only block admission path. Mill is independent of Space; the heater-only gate opens after capture + actual X move + release. Approved atlas keycaps remain the tutorial input surface.

Production-connected recurrence and exact asset tests are green; full/deploy/diff evidence and same-context reviewer verification are the remaining technical closeout steps. Natural human Stage0→3 remains pending. No stage/commit/push/deploy is authorized.

Same-context read-only re-review returned `TECHNICAL PASS` with no actionable finding. Independent evidence matched focused `4 files / 48 tests`, full `13 files / 85 tests`, Vite47/privacy488/205/findings0/readiness24 and diff/index/package-lock integrity. Natural human Stage0→3 remains the open gate; no stage/commit/push/deploy occurred.

### CAMPAIGN-V5.1-BASELINE-BEHAVIOR-RECONCILIATION

This exact-duplicate delivery is implemented in the existing v5.1 owners. Automated candidate evidence covers config-owned speed/tap/cycles, dual Shift and cleanup, surface-based inclusive intake, category-neutral E selection, more than 120 retained materials, retry spawn preservation, earned-only CLEAR rows, approved-only audio and legacy/current settings migration. Main and the connected primary consume the same named DOM keyboard owner; real installed events carry code/repeat/timeStamp into a loaded `CampaignBoot`, verifying 119ms player/root movement plus 120ms, repeat, pause-cleanup and blocked-wall movement0. Focused evidence is `2 files / 39 tests`; full evidence is `14 files / 94 tests`; deploy readiness remains `24` required assets. Natural human Stage0→3, movement feel, audio feel and visual approval remain pending. No stage/commit/push/deploy is authorized.

### JMB-RC-STAGE0-PLAYTEST-CORRECTIONS

The latest natural-play partial reopen is implemented at the existing font-readiness, block-contact and wheat-source owners. The candidate requires a nonempty explicitly loaded Galmuri11 Bold face before the first dock draw, restores ordinary player/root movement on the release frame and next input after Space-toggle block motion, and gives Stage0 one successful wheat issuance per attempt while leaving Stage1-3 unbounded at the existing cadence. Production-connected focused evidence is `3 files / 47 tests`; full evidence is `15 files / 109 tests`; deploy readiness remains `24`. A fresh production smoke reached `playing:stage0` with the exact face loaded and browser warnings/errors0. Natural Stage0 completion and human font/input feel remain pending, with no stage/commit/push/deploy authorized.

### JMB-RC-INPUT-MOVEMENT-PRESENTATION-CLOSEOUT

The first-audit rework now publishes one typed frame action for Space/E prompt and execution, preserves primary canvas pointer input while retaining explicit secondary/settings cancellation, and proves ten repeated public Space capture/move/release cycles return to legal player/root movement. Material pickup and floor-drop use separate approved profiles and one terminalization owner before automatic intake, CLEAR/GAME OVER suction, retirement or disposal; pickup duration is supplied only by `CampaignConfig.materialPresentation.heldTransferSeconds`, with a non-default `0.30s` production-owner recurrence. The current final-score owner now ports the committed Korean campaign-result visible contract while retaining the current score snapshot and pointer-only reload. Focused evidence is `6 files / 65 tests`; full evidence is `16 files / 119 tests`; deploy readiness remains `24`. Natural Stage0→3 and human input/visual feel remain pending, with no stage/commit/push/deploy authorized.

### JMB-RC-LABEL-STACK-STAGE0-GATE-CORRECTION

The latest partial reopen is implemented at the existing Module/ProductionBlock label owners, CampaignConfig material-size authority, held layout and Stage0 controller/game gates. Shipped module/block roots validate fitted label planes, shared high-resolution typography textures and renderer anisotropy. Flour/Bread use config scales `1.632/1.904` plus matching strict prepared bounds/footprints; held Wheat forward is `.420m`. Stage0 exposes no block Space action before `move-heater`, only heater during it, and ordinary capture afterward; heater intake/storage/capacity are immediate while processing/progress/output remain gated. Focused evidence is `6 files / 63 tests`; full evidence is `16 files / 120 tests`; deploy validation exits0 with Vite `50`, privacy `211` candidates / `202` files / findings0 and readiness `24`. Natural Stage0→3 and human label/size/keycap/capacity feel remain pending. No stage/commit/push/deploy is authorized.

### JMB-RC-FINAL-TUNING-MODULE-CAMERA-MATERIAL

The final tuning candidate uses the existing Module, CampaignConfig, HeldMaterialLayout, CampaignMechanics, CampaignSelectedAction and ProductionBlock presentation owners. Again now reaches the same authored socket terminal as Fast/Double; visible module copy is `빨리!` / `두 배!` / `또!` with a measured module-only `2.5×` outline. Wheat held forward is `.320m`; Flour/Bread are `2.1216/2.856` with transformed-root footprints and footprint-derived stack separation. Double is `9/4.5`, and the follow offset is the exact 90% vector while overview fit remains unchanged. Capacity cells counter-rotate during block turn/swap and rebind at terminal/cancel. Stage0's existing capability and Stage1-3 executable Space keycap remain one selected-action path. Focused evidence is `6 files / 69 tests`; full evidence is `16 files / 125 tests`; deploy exits0 with Vite50, privacy211/202/findings0 and readiness24. Fresh production smoke reaches `playing:stage0`, exact font ready, visible canvas, loading0 and console warning/error0. Same-context review follows; natural Stage0→3 and human visual/feel remain pending. No stage/commit/push/deploy is authorized.

The latest photo-based material correction narrowly supersedes only the held/material calibration above: Wheat held forward is `.270m` with Wheat-only `.068/.136/.089m` spacing, Flour/Bread are `1.69728/2.2848`, and held Bread uses local yaw `+90°` so its long axis follows player-local forward. Actual prepared bounds/footprints and held tier spacing consume the new config values. The gameplay follow camera remains the existing exact `.90` vector, not a cumulative `.81` zoom. Focused evidence is `6 files / 69 tests`; full evidence is `16 files / 125 tests`; deploy exits0 with Vite50, privacy211/202/findings0 and readiness24. Same-context review follows; natural human appearance remains pending.

The user's real-play held-Bread screenshot reopens the upper-tier support criterion: nonintersection alone is not sufficient. The shared Flour/Bread layout now separates horizontal footprint spacing from vertical support, using actual prepared height minus a `0.01m` contact overlap (Flour rise `0.2649593599486397m`, Bread rise `0.21431988449096682m`). Actual shipped roots at counts3–5 show support contact with bounded penetration and no player intersection. Focused evidence is `6 files / 69 tests`; full is `16 files / 125 tests`; deploy exits0 with Vite50, privacy211/202/findings0 and readiness24. Fresh human Bread/Flour stack confirmation remains required before closing the visual gate.

A second real-play screenshot keeps the visual gate open: Bread is supported vertically but still too spread out, and count4's `3+1` topology is awkward. The shared owner now derives held lateral step from prepared held-orientation width minus `0.01m` (Flour `0.20021702955877616m`, Bread `0.3623830823898316m`) and uses compact `1/2/2+1/2+2/3+2` topology. Actual shipped roots at every count assert exact coordinates and same-row `0.01m` overlap. Focused evidence is `6 files / 69 tests`; full is `16 files / 125 tests`; deploy exits0 with Vite50, privacy211/202/findings0 and readiness24. Fresh Bread2–5 and Flour3–5 human views remain required.

The user subsequently approved the compact Bread stack in natural play, closing that Bread-specific screenshot gate without changing its values. The same queue now extends the single Module label texture to all exposed readable faces: Fast/Double front/left/right/top with rear gauge, and Again front/rear/left/right/top with no gauge. Socket alignment and insertion remain unchanged; human module-label visibility remains pending.

`JMB-RC-BLOCK-MANIPULATION-SAFE-CONTACT-RETRY` reopens the shared Space/retry boundary after natural-play clipping and invisible-prompt evidence. The latest-user correction admits collision-safe playable-front/left/right contacts, preserves each exact contact through one shared player/block X sweep, locks full block-facing orientation, and exposes one approved-atlas Space plane above the authored block top from the same selected action. Front uses the shipped front-move clip; side contacts retain push/pull. Retry remains current-safe → last-safe → validated-spawn without rejecting an invalid failure pose. Public Stage0/Stage1-3 connected recurrences cover actual prompt-plane visibility, all contacts, reversal, blocked travel, release recovery and camera-fault rollback. Human front/side/narrow-gap/retry feel and prompt visibility remain pending.

The same queue's latest natural-play correction makes block ownership A/D-only. W/S held or tap input releases the grip/contact tuple exactly once and reaches ordinary player Z movement in the same update; simultaneous A/D moves the block zero. The map and combined-sweep paths share an escape-aware epsilon rule, allowing outward movement from exact contact or tiny drift while continuing to reject inward penetration. Focused production recurrences cover inner-gap side contacts, front contact, repeated release/recapture and actual block-boundary ±epsilon. Human front/side/inner-gap feel remains pending.

### JMB-DOUBLE-ACTIVE-FEEDBACK-EXPERIMENT

The experimental candidate reads the existing Double active scalar through the Module owner and adds continuous emissive intensity `.85` plus a bounded `.14s`/`5°` yaw shake at each `.5s` active boundary. The presentation child groups body, labels and gauge without changing the authoritative root, socket seat, collision, interaction or output gating. Retry now captures an opaque owner/epoch-bound Module presentation snapshot and, after all gameplay scalars, restores exact Again intermediate RGB plus Double wrapper/material/gauge state on a late terminal fault; a clean second retry remains available. The tracked approved thumbnail bytes were already current, and `JMB-RC-THUMBNAIL-READINESS-CONSISTENCY` corrects only their stale exact readiness tuple. Natural glow/shake feel remains a separate human gate. No stage/commit/push/deploy is authorized.

The user has since approved the continuous Double glow and shake in natural play. The current polish candidate adds only `.2s` in/out easing and a Module-local cyan PointLight (`1.0`, `2m`) driven by the same retained envelope; human fade/light feel remains pending. The latest tuning keeps the shared `5m` ProductionBlock drop but uses `.70s`, moves the tutorial panel to `48px`, and changes Stage2 to `10 / 40s`. The dock goal is now a dock-owned `0.75` physical-template wall board, while camera clear/retry returns terminate on the ordinary retained follow projection with same-update zero-step handoff. Natural camera/dock/reveal confirmation remains pending.

### 2026-08-30 입력·정보 UI 분리 대기열

- `JMB-INPUT-ARROW-HOLD-PICKUP-Q-DROP` — IMPLEMENTED / RE-REVIEW PENDING. WASD의 전체 생산 입력을 방향키로 교체하고, 빈손부터 유지한 E가 나중에 범위에 들어온 첫 재료를 즉시 집은 뒤 `0.18s` 간격으로 동일 종류를 최대 5개까지 결정론적으로 처리한다. 모듈 E는 fresh edge만 소비한다. 들고 있는 재료 묶음과 모듈의 안전한 바닥 놓기는 Q가 단독 소유하며, 보존된 모듈 낙하지점은 현재 생산 geometry에 실행 직전 재검증된다. 승인 Q 키캡은 Stage0 정식 카드에 유지하되 소지 중 동적 월드 키캡에서는 Q를 중복 표시하지 않는다. 자동 재검증 후보는 기존 코드 리뷰의 읽기 전용 감사를 기다리며, 자연 방향키/E 홀드/Q 체감은 별도 pending이다.
- `JMB-UI-TOP-RIGHT-INFO-PANEL` / `JMB-SETTINGS-MODAL-PAUSE` / `JMB-SETTINGS-SPEAKER-MUTE-TOGGLE` — TECHNICAL PASS / HUMAN FEEL PENDING. 상시 control은 inline-SVG dark gear를 담은 compact white keycap 하나이며 centered settings modal과 dim backdrop을 연다. modal은 기존 volume slider와 canonical muted scalar를 투영하는 one speaker button만 소유한다: unmuted dark speaker, muted dim speaker + one red X, aria-pressed parity, checkbox/visible mute text0. Unicode/emoji gear/speaker와 Tip trigger는0이다. Settings는 authoritative simulation pause reason 하나를 소유하고 lifecycle pause와 합성되며, close/resume catch-up·stale gameplay key0이다. 새 stage/event 게시만 하나의 opaque-white rounded card 안에 Galmuri11/900 `Tip.` + body + compact `28×28px` red-X를 exact order로 담아 gear 왼쪽 같은 row에 표시한다. 제목 별도 box/gap0이고 X dismiss 뒤 같은 ID 수동 재열기0이며 전체 card가 함께 숨는다. 툴바는 tip/settings 중 exact-one surface를 조정하고 retained content/settings를 보존한다. Tip은 desktop content-fit, viewport-safe max-width, 좁은 화면 Korean keep-all wrapping을 사용한다. 자연 speaker/mute 표시 체감은 pending이다.
- `JMB-SETTINGS-MODULE-DETAILS` — PENDING. 설정의 `상세 정보`에서 Fast/Double/Again 효과와 동작 원리를 현재 authoritative mechanics에서 설명하는 작업이다. 정보란과 설정의 콘텐츠 소유권을 먼저 대조한 뒤 별도 티켓으로 dispatch한다.

### 2026-08-30 모듈 게이지 초기화 전환

- `JMB-MODULE-GAUGE-RESET-TRANSITION` — TECHNICAL PASS / HUMAN FEEL PENDING. 스테이지 전환과 재시도에 하나의 config-owned `0.45s` 병렬 Module reset step을 추가했다. Fast/Double의 scalar, gauge, body와 Double feedback은 같은 Module-owned transition에서 수렴하며 cancel/fault는 exact 시작 상태를 복구한다. Again과 not-introduced admission은 보존된다. 자동 검증 이후에도 자연 게이지 초기화 체감은 사람 확인 pending이다.
- `JMB-BLOCK-WORLD-MODULE-SWEEP-COLLISION` — TECHNICAL PASS / HUMAN FEEL PENDING. Shared invariant: 합법적으로 바닥에 놓인 Module과 이동 ProductionBlock은 배치 순서와 무관하게 같은 floor footprint에서 겹치지 않는다. Consumed boundary: config-owned `.34m` floor half-extent → CampaignInteraction/reveal landing → CampaignGame combined block sweep. Downstream: front/left/right 조작, public Module pickup/drop/socket, effects/gauges, retry와 escape-aware collision. Actual Boot/shipped Fast·Double·Again public E/Q/Space recurrence, focused/full/deploy/diff evidence가 완료됐으며 자연 조작 체감은 pending이다.
### 2026-08-30 — JMB-STAGE0-SUBMISSION-DOCK-GOAL-REVEAL candidate

- Stage0의 실제 bread output이 SubmissionDock 소유 공개 step을 exact1 시작한다. V006 시각 wrapper는 `.62→1`을 `.50s` cubic ease-out으로 진행하고 기존 physical goal board는 `.65m` 상승한다. dock gameplay root/anchors/count는 고정되며 intake는 terminal 이후에만 열린다. Stage1–3은 즉시 terminal 상태다.
- 실제 shipped Boot→CampaignGame 경로와 공개 입력 회귀가 진행률, pause, terminal 제출, 취소와 동일 root/anchor를 검사한다. 자연 Stage0 체감과 보드 상승 가독성은 pending이다.

### 2026-08-30 — JMB-MAP-WALL-CORNER-SEAM candidate

- CampaignMap constructor의 벽 표시 경계를 하나의 named derivation으로 교정했다. north wall이 `.34m` 두 모서리 square를 소유하고 west/east는 playable north face부터 시작하여 overlap/gap0 butt joint를 만든다.
- 실제 Boot 벽 Box3와 공개 이동·앵커·바닥·카메라 불변 자동 검증은 완료 후보이며, 자연 조명에서의 북서/북동 모서리 시각 승인은 pending이다. 후속 pipe/timer queue는 untouched다.

### 2026-08-30 — JMB-STAGE0-PIPE-SCALE-REVEAL candidate

- `WheatSource`가 실제 V014 시각 묶음의 Stage0 공개를 소유한다. config의 `.42s/.92`와 역사적 cubic ease-out을 소비하며 root·세 anchor·collision은 고정하고, 공개 시작 프레임부터 기존 1.5초 생성 timer와 시도당 예산1을 그대로 진행한다. Stage1–3은 즉시 terminal이다.
- Actual CampaignBoot/public 방향키+Shift 경로가 start/25/50/75/terminal, pause, direct/split, 첫 밀과 예산, 취소·dispose 및 root/anchor 불변을 검사한다. 자연 파이프 등장 체감은 pending이며 별도 `JMB-STAGE-TIMER-ENTRANCE-GATE`는 untouched다.

### 2026-08-30 — JMB-STAGE-TIMER-ENTRANCE-GATE candidate

- `CampaignScoreboard`의 기존 중앙 physical root가 config-owned `.28s` timed entrance를 소유한다. Stage1/2/3 configure 및 retry reset은 full timer를 준비하되 non-playing을 유지하고, hidden→raised terminal 뒤 같은 transaction의 0초 admission만 playing을 게시한다. ordinary digit redraw와 Stage0는 별도 입장 연출을 만들지 않는다.
- Actual CampaignBoot/public Stage0→1→2→3 및 GAME OVER→R 회귀가 `00:50/01:00/01:30`, 25/50/75/terminal, pause, direct/split, gameplay scalar0, 다음 update exact1, cancel rollback과 terminal publication fault 후 clean retry를 검사한다. 자연 전광판 상승·시작 체감은 pending이며 SubmissionDock 사람 증거 reopen은 후속 별도 queue다.
