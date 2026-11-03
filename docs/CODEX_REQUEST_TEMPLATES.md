# Codex 작업 요청 템플릿

이 문서는 현재 저장소의 canonical 문서 체계를 사용한다. 번호 기반 문서를 새로 만들지 않는다.

## 공통 작업 생명주기

모든 구현 작업은 다음 순서로 진행한다.

`구현 → working tree 검증 → 수정 또는 재검증 → PASS → 필요 시 커밋 → 다음 작업`

구현 단계에서는 stage·commit하지 않는다. 구현이 끝나면 최신 baseline·HEAD·working tree와 검증 결과를 리뷰어에게 전달한다. 리뷰어는 첫 검증을 읽기 전용으로 수행하고, 수정 요청이 없으며 독립적인 이력 가치가 있는 변경만 정확히 stage해 직접 커밋한다. push는 별도 사용자 승인이 필요하다. working tree가 검증 후 바뀌면 기존 검증은 무효이며 변경 범위를 재검증해야 한다. 리뷰어가 직접 커밋할 수 없거나 사용자가 별도 실행자를 지정한 경우에만 예외용 `커밋 요청문`을 사용한다.

리뷰어는 PASS와 동시에 `지금 커밋`, `커밋 불필요`, `총괄 결정 필요` 중 하나를 선택한다. 총괄 결정이 필요하면 총괄이 즉시 커밋 또는 보류를 결정하고, 커밋이 필요하다고 판단한 경우 리뷰어에게 정확한 범위로 실행을 지시한다. mixed dirty나 분리 비용만으로 무기한 보류하지 않는다. alternate index·임시 worktree 후보는 명확한 의존성 위험을 확인할 때 한 번만 사용하며, 반복 후보 제작 대신 총괄 결정으로 작업을 닫는다. 기술 PASS 뒤 사람 시각·플레이·배포 승인은 pending으로 남길 수 있으며 다음 기술 작업을 막지 않는다.

커밋 기준:

- 커밋: coherent 기능·수정·운영 규칙이 PASS했고 독립적인 이력 가치가 있으며 다음 큰 작업 전에 복구 지점이 필요한 경우
- 커밋하지 않음: finding이 남음, 미완성, 사소한 로그·상태 확인뿐임, 독립적인 이력 가치가 없음
- 총괄 결정: 리뷰어가 범위 또는 이력 가치를 한 번의 감사로 판단하지 못했거나 mixed dirty 분리 비용이 과도한 경우

## 구현 working tree 검증 요청 템플릿

```text
# 검증 요청: [마일스톤 / 작업명]

baseline commit과 현재 HEAD:
- baseline: [hash]
- HEAD: [hash 또는 현재 브랜치 상태]

검증 대상 working tree 파일·hunk:
- [파일과 검증할 hunk]

기존 dirty 변경과 보호 대상:
- [기존 변경 파일·hunk와 보존 이유]

구현 내용:
- [실제로 변경한 내용]

실행한 자동 검증:
- [명령과 결과]

브라우저·사람 플레이·배포 검증 구분:
- 자동 검증: [결과]
- 브라우저 검증: [결과 또는 미실시]
- 사람 플레이: [결과 또는 미실시]
- 공개 배포: [결과 또는 미실시]

재발 방지책:
- [실제로 추가한 테스트·가드·독립 oracle·문서 gate 등]

잔여 위험과 미검증 항목:
- [남은 위험과 아직 확인하지 않은 검증]

현재 `git status --short`:
- [출력]
```

## 예외용 커밋 요청문 템플릿

정상 흐름에서는 리뷰어가 검증 통과 후 직접 커밋하므로 이 템플릿을 사용하지 않는다. 리뷰어가 직접 커밋할 수 없거나 사용자가 별도 실행자를 지정한 경우에만 사용한다.

```text
# 커밋 요청문: [검증된 작업 범위]

커밋 요청 여부:
- 예 / 아니오

커밋이 필요한 이유:
- [독립적인 이력 가치와 검증 근거]

검증한 baseline, HEAD와 working tree 상태:
- baseline: [hash]
- HEAD: [hash]
- working tree: [clean 또는 dirty 파일·hunk]

커밋별 목적:
- 커밋 1: [목적]
- 커밋 2: [필요한 경우에만]

정확한 포함 파일·hunk:
- [파일·hunk]

제외 파일·hunk:
- [파일·hunk와 제외 이유]

여러 커밋이 필요한 경우 분리 근거와 실행 순서:
- [분리 이유와 1 → 2 순서]

각 커밋의 권장 메시지:
- [message]

커밋 전 검증 명령:
- [명령]

staged diff 확인 방법:
- `git diff --cached --check`
- `git diff --cached --name-only`와 지정 범위 비교

각 커밋의 완료 조건:
- [조건]

커밋 후 보고:
- 해시, 메시지, 포함 파일, 남은 dirty 파일

push:
- 별도 사용자 승인 전 금지
```

예외 요청을 발행하지 않는 경우에는 다음처럼 명시한다.

`커밋 요청 없음 — 수정 사항이 남아 있음 / 검증되지 않음 / 기록만을 위한 변경임 / 독립적인 커밋 가치가 없음`

## 1. 구현 작업 요청

```text
# 작업 티켓: [마일스톤 / 작업명]

baseline commit 또는 baseline working tree:
- [commit hash 또는 현재 dirty 상태 설명]

현재 마일스톤:
- [M0~M7 또는 별도 승인된 단계]

목표:
- [사용자가 확인할 수 있는 결과]

governing documents:
- [docs/DECISIONS.md]
- [docs/GAME_DESIGN_TRACK1.md]
- [docs/ROADMAP.md]
- [docs/EXECUTION_PLAN.md]

포함 범위:
- [파일·기능·테스트]

제외 범위:
- [이번 작업에서 변경하지 않을 것]

보존할 불변식:
- [게임 상태·입력·렌더링 분리]
- [결정론성, 운반 수량, 호환성, 버퍼 상한 등]

dirty worktree 보호 대상:
- [기존 변경 파일과 보존 이유]

focused checks:
- [관련 단위 테스트]
- [관련 타입 검사 또는 diff 검사]

전체 completion checks:
- [npm.cmd run check]
- [npm.cmd run build]
- [필요한 브라우저 흐름]

사람이 직접 확인할 acceptance gate:
- [브라우저에서 수행할 행동과 관찰 결과]

문서 동기화 대상:
- [필요한 canonical 문서와 로그]

완료 보고 형식:
- [수정 파일, 검증 결과, 잔여 위험, 미검증 항목]

커밋 마무리:
- 구현 단계에서는 stage·commit하지 않음
- 구현 완료 후 리뷰어 검증을 요청함
- 수정 요청이 없고 독립적인 이력 가치가 있으면 리뷰어가 검증 범위만 직접 stage·commit함
- 변경 후에는 재검증하며, 혼합 hunk를 안전하게 분리할 수 없으면 커밋하지 않고 재정리를 요청함
- push는 별도 사용자 승인을 받음
```

## 2. Commit Audit 요청

```text
# 감사 티켓: [commit 또는 range]

감사 대상 commit 또는 명확한 range:
- [hash 또는 A..B]

baseline commit:
- [parent hash]

현재 마일스톤:
- [M0~M7]

governing documents:
- [권위 문서 목록]

감사 목표:
- [완료 조건·회귀·근본 원인 확인]

감사 범위:
- [변경 파일, 사용자 흐름, 데이터 경로]

제외 범위:
- [감사하지 않을 시스템]

보존할 불변식:
- [상태·입력·토큰·생산·카메라·문서 불변식]

dirty worktree 보호 대상:
- 현재 working tree는 감사 commit의 증거로 사용하지 않음
- [기존 변경 파일은 읽기 전용 컨텍스트로만 기록]

focused checks:
- [관련 테스트와 Git object 확인]

전체 completion checks:
- [필요한 check/build/diff/browser 확인]

사람이 직접 확인할 acceptance gate:
- [사람 플레이 또는 배포 확인이 필요한지]

문서 동기화 대상:
- [REVIEW_LOG.md 또는 CODEX_COLLAB_LOG.md]

완료 보고 형식:
- 감사 범위 / 전체 판정 / 발견 사항 / 검증 공백
- `수정 요청문` / `커밋 판단` / 직접 커밋한 경우 `커밋 결과`

리뷰어 결과 형식:
- `수정 요청문`: [수정 요청 또는 `수정 요청 없음`]
- `커밋 판단`: [커밋 필요 여부, 분리 단위, 근거]
- `커밋 결과`: [직접 커밋한 경우 해시·메시지·포함 범위·남은 dirty 파일]
- `커밋 요청문`: [리뷰어가 직접 커밋할 수 없는 예외에만 작성]

커밋 게이트:
- 아니오. 감사 첫 단계는 읽기 전용이며 수정·stage·commit하지 않음
- 이미 커밋된 범위를 감사한 경우 신규 커밋을 요청하지 않음
```

## 3. 감사 후 delta 재작업 요청

```text
# 작업 티켓: [원래 감사 finding의 delta rework]

baseline commit 또는 baseline working tree:
- 원래 감사 대상: [hash]
- 수정 작업 기준: [parent hash 또는 명시된 working tree]

현재 마일스톤:
- [M0~M7]

목표:
- [Blocker/Major/Minor finding을 재현 가능한 변경으로 해소]

governing documents:
- [권위 문서 목록]

포함 범위:
- 원래 finding: [요약]
- 수정 파일: [파일 목록]
- 독립 회귀 테스트와 재발 방지층

제외 범위:
- [원래 finding과 무관한 리팩터링·기능]

보존할 불변식:
- [원래 정상 경로와 Track 1 불변식]

dirty worktree 보호 대상:
- [기존 변경 파일]

focused checks:
- 원래 falsification path 재실행
- [추가 테스트]

전체 completion checks:
- [npm.cmd run check]
- [npm.cmd run build]
- [필요한 브라우저 확인]

사람이 직접 확인할 acceptance gate:
- [자동 검증으로 대체할 수 없는 확인]

문서 동기화 대상:
- [CODEX_COLLAB_LOG.md, REVIEW_LOG.md, 필요 시 DECISIONS.md]

완료 보고 형식:
- 원래 finding / 수정 내용 / 재검증 증거 / 남은 위험

커밋 마무리:
- 구현 단계에서는 stage·commit하지 않음
- 최신 재검증에서 수정 요청이 없으면 리뷰어가 해당 delta 범위만 직접 커밋함
- push는 별도 사용자 승인을 받음
```

## 4. 버그 수정 요청

```text
# 작업 티켓: [재현 가능한 버그]

baseline commit 또는 baseline working tree:
- [hash 또는 dirty 상태]

현재 마일스톤:
- [M0~M7]

목표:
- [관찰된 오류와 기대 결과]

governing documents:
- [권위 문서 목록]

포함 범위:
- 재현 경로: [입력·시간·상태]
- 수정 대상: [파일·함수]
- 회귀 테스트: [테스트]

제외 범위:
- [관련 없는 개선]

보존할 불변식:
- [입력 1회 1전환, 운반 상호배제, 결정론성 등]

dirty worktree 보호 대상:
- [보존해야 하는 기존 파일]

focused checks:
- 실패 재현 테스트
- 수정 후 동일 재현 경로

전체 completion checks:
- [npm.cmd run check]
- [npm.cmd run build]

사람이 직접 확인할 acceptance gate:
- [브라우저에서 버그가 사라지는 확인]

문서 동기화 대상:
- [작업 로그, 설계 결정이 실제로 바뀐 경우에만 DECISIONS.md]

완료 보고 형식:
- 원인 / 수정 / 테스트 / 브라우저 확인 / 잔여 위험

커밋 마무리:
- 구현 단계에서는 stage·commit하지 않음
- 최신 검증에서 수정 요청이 없으면 리뷰어가 해당 버그 수정 범위만 직접 커밋함
- push는 별도 사용자 승인을 받음
```

## 5. UI·에셋 작업 요청

```text
# 작업 티켓: [UI 또는 에셋 작업]

baseline commit 또는 baseline working tree:
- [hash 또는 dirty 상태]

현재 마일스톤:
- [M0~M7]

목표:
- [가독성·표현 목표]

governing documents:
- [GAME_DESIGN_TRACK1.md, ROADMAP.md, ASSET_LICENSES.md 등]

포함 범위:
- [런타임 표현, UI 문구, 승인된 에셋 파생본]

제외 범위:
- 게임 규칙·상태·카메라 방식 변경, 승인되지 않은 canonical 자산 덮어쓰기

보존할 불변식:
- authoritative gameplay state와 표현 계층 분리
- 입력·생산 상태를 UI가 임의로 변경하지 않음

dirty worktree 보호 대상:
- [기존 에셋·문서·게임 코드]

focused checks:
- [타입 검사, 렌더링 스냅샷 또는 브라우저 확인]

전체 completion checks:
- [npm.cmd run check]
- [npm.cmd run build]
- [사람이 확인할 화면]

사람이 직접 확인할 acceptance gate:
- [실제 화면에서 라벨·상태·대상이 읽히는지]

문서 동기화 대상:
- `docs/ASSET_LICENSES.md`, 작업 로그, 필요 시 관련 설계 문서

완료 보고 형식:
- 변경 자산·출처 / 화면 확인 / 테스트 / 라이선스·잔여 위험

커밋 마무리:
- 구현 단계에서는 stage·commit하지 않음
- 최신 검증에서 수정 요청이 없으면 리뷰어가 해당 UI·에셋 범위만 직접 커밋함
- push는 별도 사용자 승인을 받음
```

## 6. 제출 준비 요청

```text
# 작업 티켓: [제출 후보 점검]

baseline commit 또는 baseline working tree:
- [제출 후보 commit 또는 working tree]

현재 마일스톤:
- M6 또는 M7

목표:
- [제출 후보 빌드·접근성·소개 자료 확인]

governing documents:
- [COMPETITION_RULES.md, ROADMAP.md, EXECUTION_PLAN.md, DECISIONS.md]

포함 범위:
- [빌드 산출물, 직접 URL, 새로고침, 제목·소개·썸네일·설명]

제외 범위:
- 신규 핵심 기능, 범위 확장, 미승인 외부 서비스·계정·비용

보존할 불변식:
- 검증된 게임 규칙과 완료 조건
- 자동 테스트·사람 플레이·공개 배포 증거의 구분

dirty worktree 보호 대상:
- [제출과 무관한 기존 변경]

focused checks:
- [npm.cmd run check]
- [npm.cmd run build]
- [직접 URL·새로고침·브라우저 확인]

전체 completion checks:
- [제출 후보 백업과 복구 확인]
- [필수 문서·라이선스·소개 자료]

사람이 직접 확인할 acceptance gate:
- [새 브라우저 세션에서 핵심 흐름 완료]

문서 동기화 대상:
- `docs/PLAYTEST_LOG.md`, `docs/CODEX_COLLAB_LOG.md`, 필요 시 `docs/ASSET_LICENSES.md`

완료 보고 형식:
- 제출 후보 / URL / 빌드·브라우저 증거 / 미검증·백업 위험

커밋 마무리:
- 구현 단계에서는 stage·commit하지 않음
- 최신 제출 준비 검증에서 수정 요청이 없으면 리뷰어가 해당 범위만 직접 커밋함
- push는 별도 사용자 승인을 받음
```
