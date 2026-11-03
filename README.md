# Just Make BREAD!

밀을 거두어 빻고 구워 빵을 만들어 내는 3D 웹 게임. OpenAI Game Builders(2026년 8월) 제출작입니다.

- 플레이: https://just-make-bread.vercel.app/
- 조작: W/A/S/D 이동, E 집기·놓기, Space 설비 조작. 안내대로 해야 다음으로 넘어가는 튜토리얼이 있습니다.

## 실행

```
npm ci
npm run dev
```

`npm run check`로 타입 검사와 테스트를 돌립니다. `scripts/export-chatgpt-sources.test.js`는 Windows PowerShell 전용이라 다른 OS에서는 실패합니다.

## 문서

- `AGENTS.md` — 이 프로젝트에서 AI 세션이 지키는 규칙 (구현자가 만든 테스트는 독립 검증으로 치지 않는다 등)
- `docs/DECISIONS.md` — 날짜와 이유가 붙은 결정 기록
- `docs/REVIEW_LOG.md`, `docs/PLAYTEST_LOG.md` — 검토 세션과 사람 플레이에서 나온 발견
- `docs/CODEX_COLLAB_LOG.md`, `docs/EXECUTION_PLAN.md`, `docs/ROADMAP.md` — 작업 기록

이 저장소는 작업 저장소의 현재 상태를 공개용으로 옮긴 것이라 커밋 이력이 없습니다. 2026년 8월 24일 메인 파일을 14,677줄에서 68줄로 다시 정리한 과정은 `docs/CODEX_COLLAB_LOG.md`와 `docs/DECISIONS.md`의 8월 21~24일 항목에 있습니다.
