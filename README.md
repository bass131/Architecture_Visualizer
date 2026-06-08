# DawnHolder Architecture Atlas

`C:\Dev\ClaudeDev`의 C# 구조를 읽기 전용으로 분석하고 `_index.html`에서 탐색하는 독립 프로젝트입니다. 소스 프로젝트와 Git 기록, 생성물, 에이전트 설정을 공유하지 않습니다.

기본 분석은 제품 코드와 QA 도구를 대상으로 하며 TDD 단위·통합 테스트 프로젝트는 집계에서 제외합니다.

[아키텍처 Atlas 바로 열기](https://bass131.github.io/Architecture_Visualizer/_index.html)

> GitHub Pages 배포가 완료되면 위 링크에서 최신 `main` 브랜치의 Atlas를 바로 탐색할 수 있습니다.

## 사용법

```powershell
cd C:\Dev\DawnHolder_Architecture
.\refresh.ps1
start .\_index.html
```

클론 후 저장소 검증 hook을 활성화합니다.

```powershell
git config core.hooksPath .githooks
```

WSL에서 직접 갱신할 수도 있습니다.

```bash
cd /mnt/c/Dev/DawnHolder_Architecture
./refresh.sh /mnt/c/Dev/ClaudeDev
```

## 화면 구성

- **전체 개요**: 레이어와 주요 통계
- **전체 흐름**: 이동, 전투, 맵 전환, 헤드리스 검증을 동적 시퀀스 다이어그램으로 탐색
- **클래스 맵**: 클라이언트, 서버, 공유 영역의 핵심 타입과 내부 관계를 선택 중심으로 탐색
- **구조 탐색**: 타입 관계, 멤버, 메서드, 진단
- **SOLID 진단**: SRP, ISP, DIP, 결합도, 순환 의존 신호
- **호출 탐색**: 메서드 호출과 역호출 트리

## 프로젝트 경계

- 이 저장소만 수정 및 버전 관리합니다.
- `C:\Dev\ClaudeDev`는 외부 읽기 전용 입력입니다.
- 소스 프로젝트의 agent hook, state, command, Git 설정은 실행하거나 상속하지 않습니다.
- 상세 경계는 `docs/SOURCE_BOUNDARY.md`에 정의합니다.

## Codex Harness

Codex CLI를 이 디렉터리에서 시작하면 다음 프로젝트 구성을 읽습니다.

- `AGENTS.md`: 불변 규칙, 작업 라우팅, 검증 기준
- `.agents/skills/`: 개발, 리뷰, 재생성, 진단 검토를 위한 프로젝트 workflow
- `.codex/agents/`: 읽기 전용 `reviewer`, `verifier` subagent
- `.codex/config.toml`: 모델, 경로, 컨텍스트, 5시간 및 주간 잔량 footer

Codex는 내장 footer 항목과 프로젝트 전용 읽기 모드 subagent를 사용합니다. 새 CLI 세션에서 적용되며 `/statusline`으로 대화형 변경도 가능합니다.

### 슬래시 명령과 프로젝트 스킬

Codex 입력창에서 `/`를 누르면 내장 슬래시 명령을 검색할 수 있습니다. 프로젝트 workflow는 `/skills`를 실행해 선택하거나 `$skill-name`으로 직접 호출합니다.

- `/skills` → `develop-atlas`: 일반 구현 작업
- `/skills` → `review-atlas`: 현재 저장소 변경 리뷰
- `/skills` → `refresh-architecture`: 분석 데이터 재생성
- `/skills` → `review-architecture`: 진단을 실제 소스와 대조

직접 호출 예시는 `$develop-atlas 이 검색 필터를 개선해줘`와 같습니다. `/plan`, `/diff`, `/review`, `/status`, `/compact`, `/permissions`, `/agent`, `/hooks` 같은 내장 명령은 세션 제어에 사용합니다.

## 해석 주의

분석 결과는 설계 검토를 돕는 신호입니다. 줄 수가 길다고 자동으로 분리하거나, 인터페이스가 크다고 무조건 나쁜 것은 아닙니다. 프로젝트의 변경 이유와 도메인 경계를 함께 판단해야 합니다.

호출 그래프는 정적 추정입니다. reflection, delegate, event, dependency injection 런타임 바인딩과 일부 체인 호출은 표시되지 않을 수 있습니다.

## 주요 파일

```text
_index.html                 단일 진입점
assets/app.js               탐색 및 호출 트리 UI
assets/styles.css           시각 체계
data/architecture-data.js   생성 결과
tools/analyze.py            WSL 정적 분석기
config/analysis-config.json 범위와 임계값
refresh.ps1 / refresh.sh    생성 루프
AGENTS.md / HARNESS.md      Codex Agent Harness 규칙
.agents/skills/             개발, 리뷰, 갱신 workflow
.codex/                     프로젝트 footer와 custom subagent
docs/                       제품, 구조, 결정, UI, 경계, Codex workflow
.githooks/                  커밋 전 결정적 검증
```
