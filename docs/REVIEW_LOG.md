# 리뷰 로그

이 문서는 코드 리뷰 작업에서 이후 작업에도 가치가 있다고 판단한 새로운 결정·증거·위험을 즉시 누적하는 로그다. 반복 검증이나 동일 결과처럼 새 가치가 없는 내용은 기록하지 않는다. 로그 누적만을 위한 별도 커밋을 만들거나 구현 작업 단위 커밋에 이 파일을 섞지 않으며, 누적된 항목은 사용자가 요청할 때 한꺼번에 정리한다. 리뷰의 채택·기각과 최종 설계 결정은 개발자와 `DECISIONS.md`에 남기며, 리뷰어를 최종 결정 주체로 표현하지 않는다.

## 기록 템플릿

- 날짜:
- 검토한 커밋/출처:
- 기록할 가치가 있는 이유:
- 발견 사항 또는 검증 증거:
- 영향 범위:
- 채택·기각 근거:
- 검증 방법:
- 관련 결정 문서:

## 현재 상태

2026-08-06 기준으로 아래 결과를 누적한다. 이후 가치 있는 결과가 확인되면 검토한 커밋과 근거를 즉시 추가한다.

## 2026-08-06 — 카메라 후보 유지와 기본 생산 루프 우선

- 날짜: 2026-08-06
- 검토한 커밋/출처: 현재 코드 리뷰 작업에서 개발자가 제시한 카메라 후보와 다음 구현 우선순위
- 기록할 가치가 있는 이유: 최종 카메라 결정을 미루는 기준과 다음 구현 작업의 범위를 함께 정해 이후 카메라·생산 시스템 작업의 선후 관계에 직접 영향을 준다.
- 발견 사항 또는 검증 증거: 후보는 고도 고정·좌우 회전 뷰, Human: Fall Flat과 같은 자유 3인칭 뷰, Minecraft와 같은 자유 1인칭 뷰의 세 가지다. 현재는 비교에 필요한 완결된 플레이 루프가 없어 우열을 판단할 근거가 부족하다.
- 영향 범위: 카메라 후보 비교는 밀 생성 → 분쇄 → 밀가루 → 가열 → 빵 → 제출대의 최소 생산 루프가 완성된 뒤로 미룬다. 다음 구현은 카메라 조작 확장이 아니라 기본 생산 사슬에 집중한다.
- 채택·기각 근거: 생산 병목 판독, 블록 운반, 배치 정확도와 멀미·가림 문제를 같은 플레이 조건에서 비교해야 하므로 현재 시점의 조기 확정을 기각하고 세 후보를 유지한다.
- 검증 방법: 최소 생산 루프 완성 후 같은 맵과 목표를 사용해 세 카메라 후보의 병목 가독성, 이동·운반·배치 정확도, 시야 가림과 조작 부담을 플레이테스트한다.
- 관련 결정 문서: 다음 기본 생산 루프 구현 작업에서 `docs/DECISIONS.md`에 후보 유지와 재검토 조건을 반영한다.

## 2026-08-06 — 기본 생산 루프의 무입력 자동 클리어

- 날짜: 2026-08-06
- 검토한 커밋/출처: `7860bd7` — `feat: implement Track 1 minimum production loop`
- 기록할 가치가 있는 이유: 최소 생산 루프의 핵심 플레이어 행동과 단계 2 완료 판단에 직접 영향을 주는 재현 가능한 결함이다.
- 발견 사항 또는 검증 증거: 기본 배치의 밀 생성원 `(-4, -2)`, 분쇄 블록 `(-2, -2)`, 가열 블록 `(0, -2)`, 제출대 `(2, -2)`가 모두 반경 2.25 안에서 연결된다. 브라우저를 새로 열고 입력 없이 7초 기다리자 HUD가 `제출 3/3`과 `생산 목표 완료`로 바뀌었다.
- 영향 범위: 플레이어가 생산 블록을 집고 옮겨 사슬을 연결해야 한다는 구현 목표가 사라지고, 현재 단계가 자동 시뮬레이션 관찰로 끝난다. `EXECUTION_PLAN.md`의 단계 2 완료 표기도 재검토가 필요하다.
- 채택·기각 근거: 자동 상태 전환 자체는 정상이나 플레이어 개입 없이 클리어되는 초기 배치는 핵심 플레이 구조 요구와 맞지 않아 수정이 필요하다.
- 검증 방법: 기본 상태를 충분히 진행해도 완료되지 않는 테스트와, 가열 블록을 유효 연결 위치로 옮긴 뒤 전체 생산·제출이 완료되는 테스트를 추가한다. 브라우저에서도 무입력 상태와 이동·집기·배치 후 완료를 각각 확인한다.
- 관련 결정 문서: `docs/EXECUTION_PLAN.md`의 단계 2 완료 상태와 `docs/GAME_DESIGN_TRACK1.md`의 플레이어 블록 이동 설명

## 2026-08-06 — 같은 스텝 흡수로 월드 토큰이 보이지 않음

- 날짜: 2026-08-06
- 검토한 커밋/출처: `7860bd7` — `feat: implement Track 1 minimum production loop`
- 기록할 가치가 있는 이유: 월드 토큰의 위치와 적체로 병목을 읽는 핵심 게임 신호가 실제 브라우저에서 관찰되지 않는 결함이다.
- 발견 사항 또는 검증 증거: 기본 배치에서 밀 생성원이 토큰을 만든 직후 같은 고정 스텝의 `absorbCompatibleTokens()`가 밀을 분쇄 블록 내부로 이동시킨다. 저장 상태 토큰은 렌더링에서 숨겨진다. 새로고침 후 1.2초에 HUD는 `분쇄 1/10`이었지만 월드 밀은 0이었고 화면에도 밀 토큰이 보이지 않았다. 밀가루와 빵도 연결된 다음 설비와 제출대에 같은 스텝에 흡수되어 출력 모습을 관찰하기 어렵다.
- 영향 범위: 실제 토큰, 적체 위치, 흡수·출력 피드백을 통해 생산 병목을 읽어야 한다는 단계 2 목표를 충족하지 못한다.
- 채택·기각 근거: 내부 상태에 토큰 객체가 잠시 존재하는 것만으로는 플레이어가 읽을 수 있는 월드 신호가 되지 않으므로 수정이 필요하다.
- 검증 방법: 초기 생산 블록을 연결 반경 밖에 두어 밀과 중간재가 월드에 누적되는 상태를 자동 테스트와 브라우저에서 확인한다. 플레이어가 블록을 옮겨 연결한 뒤에만 흡수·처리·출력·제출이 진행되는지도 검증한다.
- 관련 결정 문서: `docs/GAME_DESIGN_TRACK1.md`의 월드 토큰·병목 신호와 `docs/EXECUTION_PLAN.md` 단계 2 남은 컷오프

## 2026-08-06 — 사용자 플레이에서 직접 재료 투입이 불가능하고 카메라가 흔들림

- 날짜: 2026-08-06
- 검토한 커밋/출처: `a60687e` — `fix: require player placement for production loop`, 사용자 직접 플레이 피드백
- 기록할 가치가 있는 이유: 자동 테스트가 통과해도 실제 사용자가 기본 생산 행동을 수행하지 못했고, 카메라 동작이 어지러움을 유발했다. 최소 생산 루프의 상호작용 모델과 단계 2 완료 판단을 다시 바꾸는 근거다.
- 발견 사항 또는 검증 증거: 현재 E/Space 상호작용 대상은 재료 토큰이 아니라 `ProductionBlockState`뿐이며(`src/game/gameState.ts`의 `getInteractionTarget()`, `tryPickUp()`, `tryDrop()`), 밀·밀가루·빵을 직접 집어 설비와 제출대에 넣는 행동이 없다. 생산과 제출은 설비를 가까이 놓은 뒤 반경 자동 흡수로 진행된다. 사용자는 실제 플레이에서 “밀 넣기”가 아무것도 동작하지 않는다고 확인했다. 또한 카메라는 플레이어와 현재 블록을 함께 프레이밍하며 대상 거리에 따라 중심과 배율을 바꿔 이동 중 시점 기준이 흔들린다. 분쇄는 작은 박스, 가열은 원통형이고 월드 명칭이 없어 설비 역할도 즉시 식별하기 어렵다.
- 영향 범위: 첫 플레이의 조작성, 최소 생산 사슬 이해, 카메라 멀미·방향 감각, 설비 가독성, 단계 2 완료 표기
- 채택·기각 근거: 안내 문구만 추가해도 존재하지 않는 재료 투입 행동은 해결되지 않는다. 설비는 큰 큐브형 고정 오브젝트로 명확히 표시하고 재료 직접 운반·투입을 구현해야 한다. 최종 카메라 후보는 유지하되 현재 임시 카메라는 플레이어 중심과 배율을 고정해야 한다.
- 검증 방법: 브라우저에서 `밀 집기 → 분쇄에 투입 → 밀가루 집기 → 가열에 투입 → 빵 집기 → 제출`을 E/Space로 완료한다. 이동 중 주변 대상 변화가 카메라 중심·배율을 바꾸지 않는지 확인한다. 확장된 맵의 경계 벽, 큰 큐브형 `분쇄`·`가열` 명칭을 화면에서 확인하고 게임 로직 테스트와 `npm run build`를 통과시킨다.
- 관련 결정 문서: `docs/GAME_DESIGN_TRACK1.md`, `docs/EXECUTION_PLAN.md`, `docs/DECISIONS.md`

## 2026-08-07 — M2A 입력 해제·설비 가시성 delta working-tree 검증

- 날짜: 2026-08-07
- 검증한 커밋/출처: baseline 및 reviewed HEAD `286ff524e21a00c680759bbcc70d3029fc83f505`, 해당 HEAD 이후 working tree
- 기록할 가치가 있는 이유: 사용자 플레이에서 발견된 입력 고착과 생산 설비·출구 가시성 문제에 대한 재발 방지 계층과 실제 브라우저 동작을 함께 검증한 최초 증거다.
- 발견 사항 또는 검증 증거: `MovementInputState`의 취소·늦은 keyup·repeat 차단 테스트를 포함해 `npm.cmd run check` 47개가 통과했고 `npm.cmd run build`와 `git diff --check`가 통과했다. 브라우저에서 벽 고정형 밀 배출구의 밀을 직접 집어 분쇄 블록에 투입했으며, 처리 후 밀가루가 블록 우측 사각 출구 아래에 나타나는 것과 큐브 정면의 큰 이름 표시를 확인했다. 브라우저 경고·오류는 없었다.
- 영향 범위: M2A 입력 수명주기, 밀 공급원 표현, 분쇄·가열 블록 외형, 생산물 출구·적재 표현
- 채택·기각 근거: 실행 가능한 결함은 발견되지 않았다. 다만 자동 브라우저 제어로 물리적인 키를 누른 채 마우스를 클릭하는 조합을 그대로 재현하지 못했으므로 사용자 손 플레이 재검증과 공개 배포 확인 전에는 M2A를 완료로 올리지 않는다.
- 검증 방법: focused 입력·게임 상태 테스트, 전체 check/build, working-tree diff 및 문서 대조, 로컬 브라우저에서 밀 집기→분쇄 투입→밀가루 우측 출구 배출 확인
- 관련 결정 문서: `docs/DECISIONS.md`, `docs/GAME_DESIGN_TRACK1.md`, `docs/EXECUTION_PLAN.md`, `docs/PLAYTEST_LOG.md`
## 2026-08-07 — M2A 생산 속도 2배 감속 검증

- 날짜: 2026-08-07
- 검증한 커밋/출처: baseline `bec3451f5d8ebde0737e6168cfa3e3ff5da73f21` 이후 속도 조정 working tree와 closeout commit `d4db9d6`
- 기록할 가치가 있는 이유: 게임필 튜닝의 첫 생산 시간 기준과 자동·브라우저 검증 증거다.
- 발견 사항 또는 검증 증거: 밀 생성 간격은 `0.75초 → 1.5초`, 분쇄·가열 기본 처리 시간은 `0.8초 → 1.6초`로 정확히 두 배 늘어났다. 전체 50개 테스트와 빌드가 통과했다. 브라우저에서 밀은 1.5초 전 0개·직후 1개였고, 분쇄는 투입 후 1.6초 전까지 입력을 유지한 뒤 밀가루를 출력했다. 경고·오류는 없었다.
- 영향 범위: M2A 밀 생성 및 분쇄·가열 처리 cadence
- 채택·기각 근거: 자동 흡수 `0.12초`, 관찰 지연 `0.25초`, 용량·상한·출력 애니메이션·카메라는 유지되어 요청 범위가 분리됐다. 실행 가능한 결함은 발견되지 않았다.
- 검증 방법: 경계 시점·15초 상한·분쇄·가열 동일 처리 시간 테스트, 전체 check/build, staged diff 검사, 로컬 브라우저 HUD 시계열 확인
- 관련 결정 문서: `docs/DECISIONS.md`, `docs/GAME_DESIGN_TRACK1.md`, `docs/EXECUTION_PLAN.md`

## 2026-08-07 — M2A 최소 게임필 그래픽 패스 working-tree 검증

- 날짜: 2026-08-07
- 검증한 커밋/출처: baseline `d4db9d6ebfc4bbf53ba78689075cb1f66350366e` 이후 그래픽 패스 working tree
- 기록할 가치가 있는 이유: 최종 아트 전 게임필 판단에 쓰일 임시 표현이 실제 카메라에서 재료 운반·설비 처리·출력 적체를 구분할 수 있는지 확인한 최초 브라우저 증거다.
- 발견 사항 또는 검증 증거: 운반 중 밀 모델이 플레이어에 부착된 소지품보다 바닥 월드 토큰처럼 떨어져 보여 HUD 없이는 운반 상태를 구분하기 어렵다. 분쇄기 처리 중 화면은 유휴 화면과 거의 같아 작은 상태등 외에 진행 여부가 즉시 읽히지 않았다. 우측 출구 아래 밀가루 포대는 한 개일 때 작은 흰 조각으로 보였고, 세 개만 쌓여도 서로 합쳐진 덩어리처럼 보여 개수와 개별 실루엣을 읽기 어려웠다. 시작 화면에서는 밀 생성원이 상단 밖으로 거의 잘려 첫 안내 목표와 위치 연결도 약했다.
- 영향 범위: M2A 운반 피드백, 설비 처리 상태 가독성, 출력 위치·재료 종류·적체량 판독, 첫 진입 동선 안내
- 채택·기각 근거: `docs/DECISIONS.md`가 출력 적체 중첩과 처리 상태 식별 실패를 이 그래픽 패스의 재검토 조건으로 직접 명시하므로 수정 요청이 필요하다. 게임 상태·생산 수치·임시 카메라는 유지하고 표현 계층만 재작업한다.
- 검증 방법: 로컬 브라우저에서 초기 화면, 밀 운반 중, 분쇄 처리 중, 밀가루 1개 출력과 3개 적체를 캡처해 비교했다. `git diff --check`는 통과했다. `npm.cmd run check`와 `npm.cmd run build`는 코드 실패가 아니라 현재 도구 사용 한도 때문에 승인 단계에서 실행되지 않아 재검증이 필요하다.
- 관련 결정 문서: `docs/DECISIONS.md`의 `M2A 최소 게임필 그래픽 패스`, `docs/GAME_DESIGN_TRACK1.md`의 `현재 임시 게임필 표현`

## 2026-08-08 — Stage 1 재료 runtime 후보·물리 적층 감사와 동일 context 해소

- 날짜: 2026-08-08
- 검증한 커밋/출처: material 작업 기준선 `db1bf4042d4a0f932920d4a0a7c068a20d05172b`, governance closeout 뒤 현재 HEAD `1f1bce4c72146f566c1fd4d60f422154ba7de6c2`, 동일 working tree의 material delta
- 기록할 가치가 있는 이유: 외부 재료 후보의 원자적 fallback, 실제 모델 bounds 기반 1~5개 적층 접촉, canonical 상태·검증 증거가 서로 어긋날 수 있는 재발 경로를 stable finding과 독립 oracle로 고정했다.
- `MATERIAL-RUNTIME-GATE-001` 직접 원인: exact `Wheat`·`Flour`·`Bread` 세 노드를 요구하는 resolver와 달리 초기 validator는 active external 타입인 `Wheat`·`Bread`만 순회해 meshless·empty·nonfinite·clone 실패 `Flour`가 포함된 combined 후보도 ready로 승격했다. 시스템 원인은 exact combined-asset scene 계약과 runtime active-render 계약이 서로 다른 타입 집합을 권위로 사용한 것이다. escape point는 기존 테스트가 meshless `Wheat`, clone 실패 `Bread`, missing node만 다루고 세 노드 각각의 실패 행렬과 late-load 기존 visual 보존을 독립 검증하지 않은 점이다. 재발 방지는 `MATERIAL_RUNTIME_REQUIRED_TYPES`를 resolver와 validator의 단일 exact gate로 공유하고, 세 노드 각각에 meshless·empty geometry·nonfinite bounds·clone throw·partial node 표 기반 테스트를 적용하며, 모든 대체 visual을 준비한 뒤에만 scene/map을 교체하는 atomic gate와 one-shot warning oracle를 유지하는 것이다.
- `MATERIAL-STACK-CONTACT-001` 직접 원인: 초기 1~5개 운반 tier 간격이 실제 external Bread 또는 procedural Flour의 bounds와 held scale이 아니라 고정 추정치에 의존해 모델 교체 시 관통이나 공중 간격이 생길 수 있었다. 시스템 원인은 authoritative stack layout과 표현 모델의 실제 기하 치수가 분리돼 있으면서도 접촉 계산에 측정 경계가 연결되지 않은 점이다. escape point는 offset 순서만 확인하고 실제 runtime bounds×scale의 상·하단 접촉 및 1~5개 지지 구조를 검증하지 않은 점이다. 재발 방지는 실제 visual root bounds×held scale과 `0.001` contact epsilon으로 tier rise를 계산하고, Bread·Flour의 1~5 lower/upper 배치·폭·접촉을 순수 helper 테스트와 두 viewport 브라우저 장면으로 확인하는 것이다.
- `MATERIAL-DOC-001` / `DOC-001` 직접 원인: material 후보 상태와 전체 자동 검증 결과가 바뀌었지만 `ROADMAP.md`의 current authoritative evidence가 과거 `76/76`, `537.41 kB`에 머물렀다. 시스템 원인은 구현·검증 closeout과 canonical 현재 상태 갱신이 하나의 완료 gate로 묶이지 않은 점이다. escape point는 코드·테스트·브라우저 감사에서 문서의 상태 문장만 대조하고 수치 증거와 사람 승인 상태를 마지막 contradiction pass에서 다시 비교하지 않은 점이다. 재발 방지는 모든 작업 단위에서 문서화 가치를 판단하고 `ROADMAP.md`의 exact check/build 수치, sandbox와 제한 밖 실행 증거, `ASSET_LICENSES.md`의 활성·비활성 provenance, 사람 승인 pending을 실제 상태와 함께 검증하는 governance gate다.
- 동일 context 최종 해소: exact 세 노드 gate와 세 노드별 실패 행렬이 적용됐고 external active 타입은 `Wheat`·`Bread`만, `Flour`는 procedural fallback으로 유지됐다. 실제 bounds 기반 Bread·Flour 접촉 clearance는 각각 허용 epsilon `+0.001`이었으며, `ROADMAP.md`는 타입 검사·`125/125`, main `618.57 kB`, lazy GLTFLoader `44.80 kB`, 기존 500 kB 경고와 sandbox/exact 실행 구분으로 동기화됐다. focused `65/65`, 전체 타입 검사·`125/125`, build, `git diff --check`, Stage 2 검색, asset hash가 통과했고 1280×720에서 Wheat·Flour·Bread 1~5, bulk 생산, `bread5 → dock 3/3 + held2`, 충돌·출력 접근과 console clean을 확인했다. 800×600에서는 초기 pipe와 external Wheat를 재확인했다.
- 최종 판정: 기술 감사 pass. 다만 재료·캐릭터의 최종 시각 적합성, 5-stack 체감과 공개 배포는 사람 승인 전이므로 pending이다. material/KayKit/gameplay/docs/assets 작업 단위는 커밋하지 않았고 push도 수행하지 않았다. 별도 governance commit `1f1bce4`는 이 material 단위에 포함하지 않는다.
- 관련 결정 문서: `docs/DECISIONS.md`, `docs/GAME_DESIGN_TRACK1.md`, `docs/ROADMAP.md`, `docs/ASSET_LICENSES.md`, `AGENTS.md`

## 2026-08-10 — D-7 M3-V0 이동 기회비용 계산 finding

- 검토 범위: 현재 `master` / `HEAD 1f1bce4c72146f566c1fd4d60f422154ba7de6c2`의 M3-V0 좌표와 상호작용·이동 상수를 읽기 전용으로 대조했다. 좌표·반경·카메라·코드는 수정하지 않았다.
- 발견 사항 또는 검증 증거: `src/m3v0View.ts`의 source `(-6.85, 0.8)`, mill `(-3, -0.35)`, heater `(1.2, -0.35)`, dock `(6, -0.65)`와 `PICKUP_RADIUS=1.75`, `PRODUCTION_RADIUS=2.1`, 이동속도 `3.4`를 확인했다. 거리 기반 기회비용 식은 `max(0, distance - interactingRadiusSum) / 3.4`이다. source→mill `distance=4.018084`, 반경 합 `1.75+2.1`에서 약 `0.0494초`; mill→heater `distance=4.2`, 반경 합 `2.1+2.1`에서 `0초`; heater→dock `distance=4.809365`, 반경 합 `2.1+2.1`에서 약 `0.1792초`였다.
- 영향 범위: 현재 배치는 설비 간 상호작용 반경이 이동 비용을 거의 지워 D-1~D-6의 Fast/Double 타이밍 선택을 체감시키기 어렵다. 이동 비용은 잠정 `1초` 내외 스핀업의 대체가 아니며, 카메라와 무관하게 향후 설비 간 거리가 반경 합보다 커야 한다.
- 채택·기각 근거: 이번에는 좌표·반경 수정 요청을 기각하고, B+ 최종 시점 확정 뒤 별도 layout 재설계 finding으로 남긴다. D-1~D-8 시간·배율은 코드나 acceptance로 승격하지 않는다.
- 검증 방법: 위 계산은 현재 코드 수치의 문서 감사 증거이며 gameplay·사람 플레이·공개 배포 검증이 아니다. 향후 layout에서 blocked·재배치·스핀업·large/split delta를 함께 검증한다.
- 관련 결정 문서: `docs/DECISIONS.md`의 `수식 블록 D-1~D-8 잠정 설계 방향`, `docs/GAME_DESIGN_TRACK1.md`, `docs/ROADMAP.md`, `docs/EXECUTION_PLAN.md`

## 2026-08-10 — MODIFIER-D7-INTERACTION-COST-001 정정 및 superseding finding

- 상태: 기존 D-7 기록의 block-center 및 target radius 계산은 보존하지만 superseded로 정정한다. 구현·좌표·반경·카메라·테스트는 변경하지 않았다.
- 직접 원인: mill→heater와 heater→dock을 block center에 연결하고 양쪽을 `PRODUCTION_RADIUS`로 계산해 실제 pickup 가능한 authoritative token slot과 dock의 `SUBMISSION_RADIUS`를 반영하지 않았다. 그 결과 heater→dock `0.1792253초`를 실제 이동 하한처럼 기록했다.
- 시스템 원인: source/output slot, target anchor, target-specific radius, collision-reachable player path를 하나의 이동비용 oracle로 묶지 않고 center-distance와 상호작용 판정을 혼합했다.
- 정정 증거: `PICKUP_RADIUS=1.75`, `PRODUCTION_RADIUS=2.1`, `SUBMISSION_RADIUS=2.1`, speed `3.4`를 재확인했다. source center/첫 wheat reference→mill은 약 `0.0494365초`; `TOKEN_SPAWN_OFFSETS` 5개 전체 mill lower-bound는 `0~0.1484104초`; mill `TOKEN_OUTPUT_OFFSETS` 10개→heater는 모두 `0초`; heater `TOKEN_OUTPUT_OFFSETS` 10개→dock은 모두 `0초`다. 공식은 `max(0, distance(actual token position,target anchor)-PICKUP_RADIUS-targetSpecificRadius)/speed`이며 collision을 무시한 geometric lower bound다.
- 영향: “현재 이동 기회비용이 사실상 없다”는 정성 결론은 유지하되, 실제 slot lower-bound가 대부분 0이라는 정확한 근거로 바꾼다. 잠정 스핀업 `1초` 내외와 이동 비용은 대체 관계가 아니다.
- recurrence oracle: 미래 layout 감사는 모든 authoritative spawn/output slot에 대해 `distance(tokenSlot,target) > PICKUP_RADIUS + targetSpecificRadius + speed*minimumTravelSeconds`를 확인하고, collision-reachable player path, blocked/large-split, browser movement, human movement-cost evidence를 별도로 요구한다. block-center 단일 거리와 공통 radius만으로 acceptance를 만들지 않는다.
- 관련 finding: `MODIFIER-D7-INTERACTION-COST-001`; 기존 기록의 삭제·정리는 수행하지 않았다.

## 2026-08-10 — MODIFIER-D5-SUPERSEDE-001 active wording correction

- active M3-V2의 “분쇄·굽기 부착 위치에 따른 중간재·완제품 가치 차이” 문구를 선형 사슬의 원리적 위치 동등성으로 정정했다. 위치 차이는 하류 capacity·waste·bottleneck으로 증폭분이 폐기되는 예외에서만 검증한다.
- 과거 결정과 로그는 superseded 표기와 함께 보존하며, D-1~D-4/D-6/D-8의 잠정·미구현·미검증 상태와 사람 gate는 유지한다.


## 2026-08-22 — campaign E 단일 입력의 이중 authoritative interaction

- 사용자 실제 플레이에서 모듈이 안정적으로 집히지 않고 반복 E로 위치만 바뀌거나 소켓에 들어가며, 분리 뒤 놓기도 실패하는 간헐 증상이 보고됐다. 같은 세션에서 생산 블록 근처 묶음 투입 후 하나가 남는 별도 증상도 보고됐으며 두 현상은 원인 확인 전 병합하지 않았다.
- 읽기 전용 reviewer browser trace에서 physical non-repeat E 한 번이 window/router/runtime bundle에는 한 번만 들어가지만, 현재 dirty `main.ts` campaign bundle 포트가 direct `interact()` 뒤 `dispatchPrimaryEFromFrame()`을 호출하고 후자가 같은 `interact()`를 다시 호출함을 확인했다. 실제 fresh Stage0에서 E 1회가 wheat 두 개를 집었고, held 4 상태의 E 1회는 다섯 번째 pickup과 다섯 개 floor drop을 같은 입력에서 연속 수행했다. 최초 bad surface는 runtime-bundle migration hunk이며 committed HEAD의 last-good 경로는 reset/ordinary priority owner만 한 번 호출했다.
- 재발 방지: campaign E는 하나의 physical press identity와 하나의 authoritative action owner만 가져야 한다. main-used production recurrence는 router/bundle/GameState action count를 1/1/1로 검증하고 Fast·Double·Again의 pickup/drop/attach/detach, ordinary stack pickup/drop, 5-token full/partial-capacity next-boundary intake를 실제 owner graph로 실행해야 한다. 구현자가 만든 single-call fixture와 source guard는 보조 증거만 허용한다.
- batch one-remainder는 별도 2-token 재현에서 나타나지 않았으므로 double interaction과 동일 원인으로 확정하지 않았다. 고정 token identity/position/observation/capacity의 5-token production-connected recurrence에서 재현 여부와 distinct owner를 판별한다. Debounce, delay, 추가 listener 또는 직접 state mutation으로 증상을 숨기지 않는다.

## 2026-08-22 — game-over RESET이 held ownership 뒤에서 제거되는 priority finding

- 사용자 실제 플레이에서 오브젝트를 든 채 game-over가 되면 화면의 RESET을 사용할 수 없다는 결과가 보고됐다. reviewer read-only trace에서 physical reset owner가 ready/in-range여도 `i9PrimaryInteractionPrompt`가 held production object와 held material을 reset보다 먼저 평가함을 확인했다.
- failure hold는 ordinary interaction을 닫으므로 held material/production block이 있으면 최종 primary E authority가 `none`이 되고, reset composition의 `requestWorldReset` 경로는 호출되지 않는다. `GameState.requestWorldReset` 자체는 held ownership을 거부하지 않으며 기존 exact disposal/restoration transaction을 이미 소유한다. 최초 실패는 그 transaction 이전의 prompt/priority resolver다.
- 이 규칙은 현재 integration 이전 baseline에도 존재하고 기존 테스트가 held+reset을 `none`으로 기대해 잘못된 정책을 정답으로 고정했다. module 보유는 main의 production-block scalar와 동일하지 않아 같은 실패로 확정하지 않고 별도 matrix로 남긴다.
- 재발 방지: game-over/failure에서 실제 ready/in-range RESET만 held drop/place보다 우선하고, active phase의 ordinary held priority는 유지한다. 실제 main-used frame에서 empty hand, material/output stack, production block과 Fast/Double/Again controls를 분리해 E 1회→reset event 1→기존 GameState reset transaction 1을 검증한다. 직접 held 삭제, UI-local reset 또는 추가 listener는 허용하지 않는다.

## 2026-08-22 — Stage2 Double 장착 실패와 v014 exact-two authority 구분

- 사용자 실제 플레이에서 Stage2 GLB가 보이는 상태로 `두 배로!`가 소켓에 남지 않는 결과가 보고됐다. reviewer는 actual parsed v014가 mill/heater 각각 두 named member를 가진 exact-two bank를 설치하고, main이 현재 generation의 모든 binding을 같은 GameState에 등록함을 확인했다. Stage1 single-socket authority가 남았다는 증거는 없었다.
- 보고 당시의 직접 원인은 campaign E double interaction과 일치한다. held Double을 첫 interaction이 current v014 socket에 attach한 뒤, 같은 physical press의 두 번째 interaction이 새 attached 상태를 다시 target해 즉시 detach한다. 최종 상태가 held라서 장착되지 않은 것처럼 보인다.
- 현재 dirty main에는 단일 E owner 교정이 들어갔고 사용자의 즉시 체감은 정상으로 바뀌었지만, natural post-correction Stage0→Stage2 browser 경로에서 same-frame root/parent, generation/request, exact bank/member/binding, runtime GameState identity와 persistent attached status를 확인하기 전에는 PASS하지 않는다.
- 재발 방지: both blocks/seats, Fast-before-Double/Double-before-Fast, detach/reinsert, blur/hidden/reset과 menu/runtime swap을 actual main factory/order에서 검증한다. fake socket, direct attach, radius enlargement 또는 visual-only repair는 금지한다.

### 최신 플레이 정정 — double-dispatch 단독 원인 주장 무효

- single-E correction 이후 Fast는 소켓에 들어가지만 Double은 계속 들어가지 않는다는 사용자 실제 플레이 결과가 추가됐다. 두 모듈이 같은 physical E 중복을 공유했다면 그 제거만으로 둘 다 회복해야 하므로, double-dispatch는 수정 전 attach→detach 가능성을 설명할 수 있어도 현재 Double-only 실패의 충분한 원인이 아니다.
- 따라서 v014 exact-two 구조 증거는 유지하되 `Double 장착 실패 원인 해소` 판정은 철회한다. natural post-correction Stage2 browser에서 Double-specific receipt/admission/status, interaction target rejection, current generation bank/member/binding, runtime GameState/root identity를 같은 프레임으로 확인할 때까지 finding은 open이다.

### 추가 플레이 정정 — Stage2 attached-module interaction 전체와 scoreboard 순서 회귀

- 최신 실제 플레이에서는 Stage2 진입 뒤 이미 소켓에 꽂힌 Fast와 Double 모두 E 안내가 사라지고 분리·상호작용이 불가능했다. 이는 Double 전용 삽입 실패보다 넓은 증상이며, E를 누른 뒤의 double-dispatch로 설명할 수 없다. 첫 divergence는 key dispatch 이전의 attached-module candidate/prompt admission 또는 Stage2 공통 interaction/lifecycle gate에 있다.
- 기존 `BUG-STAGE2-DOUBLE-SOCKET-AUTHORITY-MISMATCH` stable ID는 보존하되 acceptance를 Stage1 마지막 detach 가능 프레임과 Stage2 첫 불가 프레임의 actual production comparison으로 넓힌다. Fast/Double 상태, current-generation bank/member/binding, candidate rejection, prompt scalars, runtime identity를 같은 프레임으로 대조하고 floor module interaction control로 attached-only/global shutdown을 구분한다.
- 별도 사용자 증거는 단순한 clear 순서 문제가 아니라 최신 scoreboard presentation path 전체의 회귀다. 승인된 최신 연출의 보조 전광판/패널과 기존 전광판 우측 하단 `+score` 표시가 사라지고, 빠른 count-up과 최종 점수 표시 전 clear를 사용하던 옛 경로가 다시 보인다. 최신 owner/root/event/frame route가 생성·mount·retained·advance 중 어디서 빠지고 legacy path가 선택되는지 마지막 known-good와 비교해야 하며, 순서 문제는 그 하위 증상으로만 취급한다. 임의 지연이나 속도 조정은 원인 수정으로 인정하지 않는다.

### 독립 root-cause 정정 — natural Stage2 socket map과 scoreboard handoff

- natural Stage2의 최초 불일치는 menu runtime swap이 아니라 socket-bank adoption이다. Stage1 `fast-pocket` anchor가 no-op clear 뒤 남고 v014 `fast-pocket-left/right`가 추가되어 map size3가 된다. exact-two bank의 `anchors.size === members.length` 검증이 전체 bank를 닫아 Fast/Double 모두 E 후보에서 사라진다. 새 bank의 exact member set 밖 key만 퇴역시키고 current record를 재사용해야 하며 strict coherence를 약화하지 않는다.
- scoreboard 최신 코드와 root는 삭제되지 않았다. GameState의 독립 2.8초 stage transition이 더 긴 auxiliary row/count/final hold/CLEAR presentation보다 먼저 `stage*-started`를 발행하고, main이 그 즉시 rows와 session을 reset해 연출을 중도 폐기한다. 다음 stage handoff는 최신 presentation owner의 실제 완료 신호를 소비해야 하며 속도·지연 상수 조정으로 가리지 않는다.
- menu→Tutorial partial GameState swap은 여전히 별도 integration ownership 위험이지만 위 두 natural campaign 증상의 최초 원인으로 단독 귀속하지 않는다. complete run aggregate acceptance는 유지하되 causal claims를 분리한다.

### 최신 사용자 모순 — scoreboard auxiliary complete absence

- 사용자는 auxiliary scoreboard가 나타났다가 잘린 것이 아니라 처음부터 한 번도 보이지 않았다고 정정했다. 2.8초 stage-start reset은 final hold/CLEAR 중단을 설명하는 확인된 결함이지만, auxiliary first-visible 시점이 cutoff 이후임을 실제 계획과 브라우저로 증명하지 못하면 complete absence의 충분한 원인이 아니다.
- result row/plan admission, auxiliary root 생성·parent·visible·frame update, lower-right `+score` owner를 last-known-good와 비교해 더 이른 divergence를 다시 찾아야 한다. 구현 closeout은 handoff correction뿐 아니라 auxiliary 실제 표시를 production/browser에서 확인할 때까지 동결한다.

### 실제 main 진행 차단 — Stage0 reveal/Space authority drift

- 현재 rework의 자연 Stage0에서 E 운반·floor drop·auto-intake 뒤 mill-operation tutorial까지 도달했지만 grounded visible starter block의 `spaceTarget`은 null이었다. presentation animation은 `simulation:15190:0`, admitted/settled를 retained했지만 authoritative Stage0 reveal diagnostics는 eventId null/phase idle이었다.
- shared prompt의 fail-closed 자체는 옳고 presentation만으로 gameplay admission을 만들 수 없다. event delivery/consumption/reset, run/session migration, duplicate authority 또는 stale presentation 중 어디서 reveal record가 갈라지는지 독립 review가 필요하며, 이 결함이 자연 completion과 scoreboard 안정 재현을 먼저 막는다.
- reviewer가 확인한 직접 원인은 per-run migration 밖에 남은 application-global Stage0 reveal singleton이다. fresh candidate 준비가 commit 전에 이를 reset하고, 실패 rollback은 state/runtime/roots만 복원해 reveal record를 되살리지 못한다. state port도 exact run이 아니라 mutable global state를 참조한다. reveal authority/composition을 CampaignRun graph에 포함하고 candidate-only mutation→atomic graph install→old graph dispose 순서를 강제해야 한다.
