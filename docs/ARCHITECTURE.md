# Architecture

## 데이터 흐름

```text
C:\Dev\ClaudeDev (*.cs and domain docs, external read-only input)
  -> WSL Python syntax-first analyzer
  -> type/method/relation/diagnostic model
  -> data/architecture-data.js
  -> _index.html + assets/app.js
```

## 책임 분리

- `tools/analyze.py`: C# 구문 추출, 관계 해석, 휴리스틱 진단
- `analysis-config.json`: 범위와 임계값
- `architecture-data.js`: 분석기와 UI 사이의 버전 계약
- `_index.html`: 화면 골격과 접근성
- `app.js`: 탐색 상태, 그래프, 호출 트리 렌더링
- `styles.css`: 시각 체계
- `refresh.ps1`: 빌드, 분석, 검증 오케스트레이션

기본 분석 입력은 제품 코드와 QA 실행 도구이며, `testMarkers`에 해당하는 TDD 단위·통합 테스트 파일은 집계 전에 제외합니다. 이 정책은 `analysis-config.json`의 `includeTests`로 관리합니다.

## 저장소 경계

이 프로젝트는 분석 대상 저장소와 별도의 Git 저장소입니다. 소스 프로젝트의 agent 설정이나 작업 상태를 가져오지 않으며, 모든 임시 파일과 생성 결과는 이 프로젝트 안에서만 관리합니다. 자세한 규칙은 `SOURCE_BOUNDARY.md`를 따릅니다.

## 분석 정확도

주석과 문자열을 마스킹한 뒤 중괄호 범위를 추적하는 syntax-first 방식입니다. Unity와 전체 프로젝트를 컴파일하지 않으므로 선언과 명시적 관계는 안정적으로 찾지만, 오버로드·동적 디스패치·reflection·delegate·DI 런타임 바인딩은 추정치입니다. UI는 이 차이를 명시합니다.
