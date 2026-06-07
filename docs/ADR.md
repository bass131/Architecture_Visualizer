# Architecture Decision Records

## ADR-001: 정적 단일 페이지

- 선택: 외부 CDN 없는 HTML/CSS/JavaScript
- 이유: 설치와 서버 없이 `_index.html`을 바로 열기 위함
- 포기: 대형 그래프 라이브러리의 고급 자동 배치

## ADR-002: WSL syntax-first 분석

- 선택: WSL 기본 Python으로 주석·문자열 마스킹과 중괄호 범위를 추적
- 이유: WAC가 새 .NET 실행물을 차단하는 환경에서도 외부 설치 없이 재현 가능
- 포기: Roslyn semantic model 수준의 오버로드 및 동적 바인딩 해석

## ADR-003: SOLID는 냄새 신호

- 선택: 줄 수, 책임 영역 수, fan-in/out, 인터페이스 크기, 구체 결합 등을 근거로 경고
- 이유: SRP와 DIP는 문맥 없이는 기계적으로 확정할 수 없음
- 포기: 단순하지만 오해를 만드는 합격/불합격 점수

## ADR-004: 생성 데이터는 JavaScript

- 선택: `window.ARCHITECTURE_DATA = ...`
- 이유: 브라우저의 `file://` JSON fetch 제한을 피함
- 포기: 순수 JSON API 호환성

## ADR-005: 생성 데이터는 소스 스냅샷에 대해 결정적

- 선택: `generatedAtUtc`는 실행 시각이 아니라 분석 대상 파일의 가장 최근 수정 시각을 기록
- 이유: 동일한 소스를 반복 분석할 때 `architecture-data.js`가 불필요하게 변경되지 않도록 함
- 포기: atlas를 실제로 실행한 시각은 데이터 자체에서 알 수 없음
