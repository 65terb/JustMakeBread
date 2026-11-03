# 플레이테스트 로그

## 2026-08-22 — current integration hands-on input and intake regressions

- User-observed surface: current local game while the menu/one-minute integration remains uncommitted and under review. This is authoritative hands-on evidence, not an automated PASS claim.
- Module interaction: E can fail to establish a stable held state while the module position continues to update. Repeated E presses may move the module incrementally until it attaches to a socket; after detaching, dropping can fail again. Occurrence is intermittent.
- Production-block intake: a nearby ingredient/output group that previously transferred together can leave one item outside the block. Independent reviewer browser replay later reproduced a two-token floor drop near the mill storing one on the next boundary and leaving one outside until repositioned. This remains separate from the module-input cause pending fixed five-token full/partial-capacity tracing.
- Stage2 module interaction: the visible production block uses Stage2 exact-two visuals, but after entry both already-socketed Fast and Double offer no E interaction. Reviewer confirmed that the retained Stage1 `fast-pocket` key remains beside Stage2 `fast-pocket-left/right`, making a size3 anchor map fail the exact-two coherence gate before E. The old double-dispatch is not the cause of this prompt loss.
- Scoreboard presentation path: an earlier user run showed no auxiliary board at all, so the independent 2.8-second reset is not accepted as the sole cause. During the current in-progress rework the new board did appear, but the timer arrived first, CLEAR remained during next-stage camera shrink, camera/player-follow attached abruptly after CLEAR lowered, and the active gameplay timer board then disappeared. Because source was mid-edit this is provisional hands-on evidence, but the final stable graph must reproduce none of those ordering/visibility failures.
- Stage0 Space note: the user did not experience a Space failure in hands-on play. The separate `BUG-STAGE0-SPACE-REVEAL-AUTHORITY-DRIFT` evidence came from the implementation session's actual-main candidate preparation/rollback path and is not recorded as a user-observed regression.
- E follow-up: after the current in-progress correction, the user's immediate hands-on impression is that ordinary E interaction now appears fixed. This is preliminary human evidence only; module/stack matrices and reviewer verification remain open.
- Game-over RESET: when game-over starts while an object is held, the visible RESET button cannot be activated. Held-object type and exact reset/input rejection owner are not yet determined.
- Status: open blockers under `BUG-E-INTERACTION-REPEAT-MODULE-AND-BATCH-INTAKE`, `BUG-STAGE2-DOUBLE-SOCKET-AUTHORITY-MISMATCH`, `BUG-GAMEOVER-RESET-BLOCKED-WHILE-HOLDING` and `BUG-SCOREBOARD-LATEST-PRESENTATION-PATH-REGRESSION`. Independent read-only review must identify each first divergence before implementation. Browser replay, correction and hands-on recheck remain pending; no completion, push or deploy claim.

| 날짜 | 플레이어 | 첫 이동 | 첫 생산 블록 집기 | 첫 자동 흡수 확인 | 첫 빵 | 첫 클리어 | 병목 이해 여부 | 카메라 불편 | 재도전 여부 | 관찰 메모 |
|---|---|---:|---:|---:|---:|---:|---|---|---|---|
| — | 초기 기록 기준 아직 실시하지 않음 | — | — | — | — | — | — | — | — | 이후 사용자 플레이 기록이 추가되기 전의 기준선 |
| 2026-08-07 | 사용자 (수정 전 플레이) | 성공 (시간 미제공) | 성공 (시간 미제공) | 미기록 | 성공 (시간 미제공) | 성공 (시간 미제공) | 미기록 | WASD 이동 고착, 생산 출구·토큰 가독성 문제 | 미기록 | 밀 생성부터 분쇄·가열·빵 3개 제출까지 전체 흐름은 성공했다. 시간은 제공되지 않았다. 이번 delta 수정 후 재검증 전까지 M2A 최종 승인으로 표시하지 않는다. |

시간 열은 게임 시작부터 해당 행동을 실제로 성공한 시점까지 측정한다. 자동 테스트·자동 브라우저 확인은 사람 플레이 행으로 추가하지 않는다. 사람 플레이를 실시하면 무입력 상태, 블록 배치 또는 직접 운반, 자동 흡수·출력, 빵 3개 제출과 카메라 불편을 한 행에 기록한다.

## 2026-08-08 — 사용자 최종 시각·플레이 피드백

- 기술 브라우저 gate와 별개로 사용자 최종 시각 승인은 실패했다.
- 빵 held stack이 torso를 관통했고, 월드 출력물은 널브러진 적체가 아니라 같은 위치에 겹쳐 보였다.
- 밀·밀가루·빵 전체 모델을 기각했으며, wall·floor·submission dock 표현도 기각했다.
- 캐릭터는 로봇 또는 무료 연습 에셋 같은 인상으로 기각했다. 다만 carry-walk motion 자체는 이전 사용자 판정상 해결된 상태다.
- 선호 환경은 checker/grid/pillars 없이 단순한 white wall과 미세하게 분리된 floor다.
- 외부 후보는 카테고리별 5개 이상을 최종 조사하고, 적합한 후보가 없으면 사용자가 직접 Blender modeling을 진행한다.
- 이번 피드백에서는 기능 흐름 시간과 클리어 시간을 측정하지 않았다.

## 2026-08-24 — v5.1 최신 자연 플레이 재오픈

- 사용자는 흰 배경이 보이는 E 키캡, 흐리고 작은 생산 블록 라벨, hold 방식 Space 조작, dock 근처 재시도 위치, idle Fast 회복 부재, 월드 출신 모듈의 원위치 snap-back, socket 삽입 ring 잔존, 다른 dock bread pictogram, 동시 BREAD/TIME 보조 전광판을 확인했다.
- 추가로 fresh/retry Fast가 부착 전까지 red/empty로 보이는 상태와 승인 전광판 글꼴이 Galmuri11 Bold가 아닌 회귀를 확인했다. 이 사용자 증거는 해당 자동/리뷰 PASS를 철회한다.
- working-tree 수정 후보와 자동·fresh Stage0 browser smoke는 마련되었지만, 이는 사람 재승인이 아니다. 사용자의 natural Stage0→3, 각 모듈 재배치, Stage1/2/3 retry, Fast 소비·회복, CLEAR 순차 표시와 자연 카메라 거리의 글꼴/라벨 확인이 pending이다.

## 2026-08-24 — Bread compact held-stack 사람 승인

- 사용자가 최신 compact Bread held-stack의 방향, 접촉 간격과 `1/2/2+1/2+2/3+2` 배치를 실제 플레이에서 승인했다. 앞선 floating/spread-out 실패 스크린샷으로 열린 Bread stack 시각 gate는 이 승인으로 닫는다.
- 승인된 Bread layout 값과 topology는 더 변경하지 않는다. Flour sibling과 새 다면 Module label의 자연 카메라 시각 확인, 전체 Stage0→3 플레이는 별도 pending이다.

## 2026-08-25 — Double 기본 active feedback 사람 승인

- 사용자는 현재 Double의 active 구간 지속 발광과 `.5s` 간격 짧은 흔들림을 실제 플레이에서 승인했다. 이 두 기본 연출의 사람 체감 gate는 닫는다.
- 후속 `.2s` fade-in/out과 주변 표면을 비추는 intensity `1.0` / distance `2m` PointLight는 새 polish 후보이므로 별도 사람 재확인이 pending이다.
- Stage0 mill/heater `.88s` 낙하 복원과 tutorial panel `40px` bottom inset도 자동 검증과 별개로 자연 플레이 확인이 pending이다.

## 2026-08-24 — 블록 조작 끼임 및 retry 복구 재오픈

- 사용자는 Space 블록 조작 중 플레이어가 블록과 장애물 사이에 끼는 현상을 확인했다. 최초 정정의 측면 전용 해석은 다시 철회되었고, 최신 결정은 플레이 공간 쪽 정면과 좌/우 접촉 모두에서 X축 조작을 허용하며 조작 중 플레이어가 매 프레임 블록 중심을 바라보도록 고정하는 것이다.
- 사용자는 내부 `SPACE` label 값과 달리 실제 키캡 plane이 화면에 보이지 않았다고 확인했다. 최신 후보는 키캡을 블록의 저작 상단 앵커 위에 두고 승인 atlas plane의 실제 가시성과 카메라 투영을 검증하지만, 사람 화면 승인은 아직 pending이다.
- GAME OVER의 `다시 시도`는 현재 실패 위치가 잘못되었어도 항상 수락되어야 한다. 정상 실패 위치는 유지하고, 충돌/비정상 위치만 마지막 정상 위치, 최종적으로 검증된 spawn 순으로 복구한다.
- 자동 회귀 후보는 마련되었지만 사람 block push/pull, 좁은 간격, release 이동 복구와 invalid-pose retry 체감은 pending이다.
- 후속 자연 플레이에서 A/D 조작 중 두 블록 사이에 접근하면 W/S가 버려져 빠져나오지 못하는 현상이 확인됐다. 최신 후보는 W/S를 remote grip 이동으로 쓰지 않고 같은 프레임에 조작을 종료한 뒤 플레이어만 Z축으로 이탈시키며, 경계의 작은 수치 오차에서도 바깥 방향을 허용한다. 이 자동 후보 이후의 사람 front/side/inner-gap 체감은 아직 pending이다.

## 2026-08-25 - Camera/dock goal/balance polish candidate

- Latest candidate uses a `.70s` Stage0 block drop, `48px` tutorial bottom inset and Stage2 `10 / 40s`. Camera clear/retry return now shares the ordinary retained follow terminal, and the compact dock shell is replaced by a dock-owned `0.75` approved physical-template wall board.
- Automated checks are not human approval. Natural Stage0→3 camera handoff, dock readability/placement, reveal timing and panel feel remain pending.
- Latest result-presentation candidate keeps the auxiliary earned surface visible through its descent and keeps the dock shell/icon visible while blanking only submitted/target digits. Automated lifecycle checks are green; human descent/readability confirmation remains pending.
- The new top-right TipPanel, red X hover/press feel, white tutorial panel and red GAME OVER retry button are automated candidates only. Their natural position/readability/click feel has not yet received human approval.

## 2026-08-30 - Stage0 submission dock reveal candidate

- Stage0 bread output now starts one dock-owned `.50s` reveal candidate: the visible dock scales `.62→1` and the existing goal board rises `.65m`, while gameplay anchors remain fixed and bread intake stays closed until terminal.
- Actual shipped-asset/public-input automation covers start, 25/50/75%, pause, terminal intake, Stage1 immediate state and cancellation. Natural gameplay timing, apparent scale and board-rise readability remain human pending.
