# 여유로 — 카카오맵 연동 지도 페이지 구현 계획서

| 항목 | 내용 |
|------|------|
| 문서 버전 | v1.0 |
| 작성일 | 2026-07-15 |
| 상태 | 계획 중 |
| 작성자 | Antigravity |

---

## 1. 개요
브라우저 주소창에 `#map` 입력 시 이동할 수 있는 독립된 카카오맵 연동 페이지(`MapScreen.jsx`)를 구현하고, 프론트엔드 라우터 설정에 통합한다.

---

## 2. 세부 설계 및 수정 범위

### 2.1 환경변수 설정 (`.env`)
- `.env`에 카카오 자바스크립트 API 키로 활용할 환경 변수 정의:
  ```env
  VITE_KAKAO_MAP_API_KEY=78739552f1c6811de7a60af79289a2dd
  ```
  *(기존 KAKAO_REST_API_KEY 값을 활용하여 기본값을 세팅하고, 필요시 사용자가 교체 가능하도록 설계)*

### 2.2 라우터 수정 (`src/App.jsx`)
- `VIEWS` 배열에 `"map"`을 추가:
  ```javascript
  const VIEWS = ["home", "results", "detail", "macro", "map"];
  ```
- 뷰 조건부 렌더링 영역에 `MapScreen` 추가:
  ```jsx
  {view === "map" && (
    <MapScreen onBack={() => navigateTo("home")} />
  )}
  ```

### 2.3 새 컴포넌트 추가 (`src/components/MapScreen.jsx`)
- **기능**:
  - 컴포넌트 마운트 시 `document.createElement('script')`를 이용해 카카오맵 JS API 스크립트(`//dapi.kakao.com/v2/maps/sdk.js?appkey={key}&autoload=false`)를 동적으로 로드.
  - 로드 완료 후 `window.kakao.maps.load` 내에서 지도 컨테이너 DOM 레퍼런스(`useRef`)를 연결하여 지도 객체(`kakao.maps.Map`)를 생성.
  - 언마운트 시 추가했던 스크립트 노드를 제거하여 메모리 누수 방지.
- **디자인 (Aesthetics)**:
  - 여유로 서비스의 모바일 테마와 조화로운 UI.
  - 상단 헤더: 뒤로가기 버튼(`lucide-react`의 `ArrowLeft` 등 활용), '실시간 지도 정보' 타이틀.
  - 지도 컨테이너: 라운드 코너(`rounded-2xl`), 세련된 테두리(`border border-slate-100`), 하단 그림자(`shadow-md`).
  - 너비: 부모 컨테이너(`max-w-lg`) 내에서 가득 차는 `w-full`, 높이: 모바일에 최적화된 `h-[450px]` 또는 반응형 높이.
  - 지도 위에 플로팅되는 정보 배너: 현재 중심지(예: 카카오 판교오피스)를 알기 쉽게 보여주는 정보 오버레이(카드).

---

## 3. 검증 계획

### 3.1 수동 검증 (주소창 해시 변경)
1. 로컬 개발 서버 구동 (`npm run dev`)
2. 주소창에서 `http://localhost:5173/#map` 으로 해시 변경 후 직접 엔터 입력.
3. `MapScreen`이 올바르게 로드되고 카카오 지도 영역이 렌더링되는지 확인.
4. 뒤로가기 버튼 클릭 시 홈 화면(`/#home`)으로 자연스럽게 돌아가는지 확인.
5. 지도의 드래그, 확대/축소 등 카카오맵 인터랙션 정상 작동 여부 검증.

### 3.2 빌드 검증
- `npm run build`를 실행하여 정적 자산 빌드 중 발생하는 문법 에러나 Vite 빌드 경고가 없는지 최종 확인.
