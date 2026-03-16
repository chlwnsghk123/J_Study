# CLAUDE.md — 일본어 발음 카드

## 프로젝트 목적
일본어 **발음(한국어 표기) ↔ 한국어 뜻** 빠른 매칭 반사 훈련.
한자·히라가나 암기 아님 — **소리 반사 훈련**이 핵심. OPIc IM1 타겟.

## 스택
- React 18 + Vite 5 + Tailwind CSS v3 + lucide-react + framer-motion
- Google Cloud TTS API (`ja-JP-Neural2-B` 고정)
  - API 키: `import.meta.env.VITE_GOOGLE_TTS_API_KEY` (`.env` 파일)
- Google Gemini API (`@google/generative-ai`, 모델: `models/gemini-3-flash-preview`)
  - API 키: `import.meta.env.VITE_GEMINI_API_KEY` (`.env` 파일)
- PWA: `public/manifest.json` + OG/Twitter Card 메타 태그 (`index.html`)

---

## 데이터 스키마 (최신)

```js
{
  id:           number,    // 전체 고유 (현재 1~430, 새 항목은 431~)
  type:         string,    // 'word' | 'pattern' | 'sentence'
  priority:     1|2|3,    // 1=높음 — 큐 우선순위
  tags:         string[], // tags[0]은 반드시 '#동사'|'#형용사' 등 종류 표시
  politeness:   string,   // '반말' | '정중체' | '해당없음'
  pron:         string,   // 한국어 발음 — 카드 앞면 핵심
  meaning:      string,   // 한국어 뜻
  hiragana:     string,   // 일본어 표기 (TTS 소스, 〜/[] 포함 가능)
  example:      string,   // 예문/상황 (한국어 발음 표기)
  description:  string,   // 학습 포인트/주의사항
  antonymId?:   number,   // 반의어 ID (word 타입 전용)
  structure?:   string,   // 문법 구조 (pattern 타입 전용)
  componentIds?: number[], // 구성 요소 ID (sentence 타입 전용, 의존성 주입용)
}
```

### 데이터 파일 현황

| 파일 | export | type | ID 범위 | 수량 |
|---|---|---|---|---|
| `src/data/verbs.js` | `verbs` | word | 1~150 | 동사 150개 |
| `src/data/adjectives.js` | `adjectives` | word | 151~230 | 형용사 80개 |
| `src/data/patterns.js` | `patterns` | pattern | 231~280 | 패턴 50개 |
| `src/data/sentences.js` | `sentences` | sentence | 281~430 | 통문장 150개 |

### CATEGORY_META 키
```js
// src/data/index.js — 현재 키 (word/pattern/sentence)
CATEGORY_META = {
  word:     { label: '단어',   badge: 'bg-sky-100 ...'     },
  pattern:  { label: '패턴',   badge: 'bg-violet-100 ...'  },
  sentence: { label: '통문장', badge: 'bg-emerald-100 ...' },
}
```
> **주의**: 구버전은 '단어'/'패턴'/'통문장' 키였으나 현재는 `word`/`pattern`/`sentence`.

---

## 파일별 역할

| 파일 | 역할 |
|---|---|
| `src/lib/googleTTS.js` | TTS API 호출, 인메모리 LRU 캐싱 (최대 200개), prefetch |
| `src/lib/gemini.js` | Gemini API 클라이언트, `askAI(currentCard, userQuestion)` — 카드 문맥 주입형 |
| `src/lib/curriculum.js` | `TOTAL_DAYS`, `SETS`, `getDayBasePool(day)` — 43일 커리큘럼 순수 함수 |
| `src/hooks/useTTS.js` | `useTTS(text, enabled)` 자동재생 훅, `speakText(text, {rate})` |
| `src/App.jsx` | SRS, 큐 빌드, 하드코어/블라인드/리버스 모드, D-Day, 의존성 주입, 토스트, 세션 상태 자동 저장, 전체 초기화, 3회 오답 패스, 패스/되돌리기 |
| `src/components/WordCard.jsx` | 3D 플립 카드, 드래그 스와이프(useDrag 훅: 좌=되돌리기/우=패스), 모드별 렌더링, TTS·AI·액션 버튼, 마스터리 토글, 입장 애니메이션 |
| `src/components/HomeScreen.jsx` | 홈 화면 — Day 선택, 설정 패널(토글 3종), 관리 설정 메뉴(전체 초기화), 탐색 모드 |
| `src/components/DayPreviewScreen.jsx` | Day 미리보기 — 단어 체크박스 선택, 퀴즈 시작 |
| `src/components/AiChatModal.jsx` | AI 질문 바텀시트 — 채팅 UI, 마크다운 렌더러, 카드 변경 시 기록 초기화, 스와이프 다운 닫기 |
| `src/components/CompletionScreen.jsx` | 학습 완료 화면 — 완료 메시지, 첫 화면 복귀 버튼 |
| `src/components/ProgressBar.jsx` | 얇은 진행 바 (`h-1.5`), 마스터 수 / 전체 수 표시 |
| `src/components/BrowseScreen.jsx` | 전체 단어 탐색 화면 |
| `src/index.css` | Tailwind 임포트, 3D 플립 애니메이션, 드래그 스냅백 CSS |
| `src/data/index.js` | 전체 wordData 통합, CATEGORY_META, TYPE_META |
| `public/` | PWA manifest, 파비콘, 앱 아이콘, OG 이미지 |
| `index.html` | PWA 메타 태그, Open Graph, Twitter Card |

---

## 핵심 알고리즘

### SRS (Spaced Repetition) + 마스터리(Mastery) 누적 시스템
- **masteryCount ≥ 3** = '완전히 아는 단어' (DayPreviewScreen 필터 기준)
- 제한 시간 내 정답(Know) → `masteryCount += 1`
- 오답(Unknown) → `masteryCount -= 1` (최소 0)
- 타임아웃(시간 초과) → `masteryCount` 변경 없음, 큐 맨 끝으로 이동
- 마스터 확정 시 → `nextReview` = 오늘 + [1, 3, 7]일 (`masteryCount` 기반)
- `srsData` = localStorage `jflash_srs_v2`
- 진행도 시각화: 카드 우상단에 3개의 점(●●○)으로 현재 masteryCount 표시
- 수동 토글: 마스터리 점(●●●) 터치 → 확인 다이얼로그 → masteryCount 3→1 (모르는 단어로만 전환 가능, 역방향 없음)

### 큐 빌드 순서
1. 선택된 단어 필터링 → OR 태그 필터 → SRS 만기 필터 (maxCards 없음)
   - SRS 필터: `srsData` 5개 이상일 때 활성화, due 카드 3개 이상이면 due 우선
   - **최소 풀 보장**: due 카드가 3~4개일 때 non-due 카드를 보충하여 최소 5개 유지
2. priority 1 → 2 → 3 순으로 그룹화, 각 그룹 내 Fisher-Yates 셔플
3. `word` 타입 + `antonymId` → 반의어 쌍 묶어서 함께 배치

### 3회 오답 패스
- 동일 카드를 세션 내에서 3회 이상 '모름' → 큐에 재삽입하지 않고 자동 pass
- 토스트 메시지: "3회 오답 — 다음 카드로 넘어갑니다"
- `failCount[cardId]`로 세션 내 실패 횟수 추적, 게임 종료 시 초기화

### 패스 (스와이프 제외)
- 왼쪽 드래그 스와이프 → 현재 카드를 이번 세션 큐에서 **완전 제거** (SRS 변경 없음)
- 학습 효과 없이 건너뛸 때 사용 — masteryCount, nextReview 모두 변경 없음
- **되돌리기 가능**: 패스 시에도 `historyStack`에 기록 → 왼쪽 스와이프로 패스한 카드 복원 가능 (연속 패스도 역순 복원)

### 의존성 주입
- 오답 카드에 `componentIds`가 있으면 해당 단어/패턴을 큐 5~10번째에 삽입 (3회 pass 전까지)
  - **중복 방지**: 큐(`newQueue`)와 마스터 목록(`newMastered`) 모두 체크하여 이미 존재하는 컴포넌트는 재삽입하지 않음
- 슬롯 치환: `[VERB]`, `[ADJ]`, `[WORD]` → 마스터된 단어로 대체
  - **결정적 선택**: `word.id % arr.length`로 동일 카드는 항상 같은 슬롯 필러를 받음 (비결정적 `Math.random()` 제거)

### 반의어 쌍 학습
- 오답 카드에 `antonymId`가 있으면 반의어를 함께 재삽입
- 검색 순서: `newMastered` → `newQueue` → `wordData` (fallback)
  - **fallback**: 패스 등으로 세션에서 제거된 반의어도 `wordData`에서 직접 가져와 쌍 학습 보장

### 하드코어 타이머 + 타임아웃 페널티
- **하드코어 타이머** (하드코어 모드 전용):
  - `word` 타입: **3초**, `pattern`/`sentence` 타입: **7초** 카운트다운
  - 0초 → `handleActionRef.current('dontKnow')` 호출 (stale closure 방지용 ref)
  - **재플립 방지**: `answerSeenRef`로 뒷면 열람 추적 → 뒤→앞 재플립 시 타이머 재시작 차단 (악용 방지)
- **타임아웃 페널티** (일반 학습, 하드코어와 독립):
  - 페널티 기준: `word` **8초**, `pattern` **13초**, `sentence` **17초**
  - 기준 초과 → know/dontKnow 무관하게 큐 맨 끝 이동, SRS 미갱신 (masteryCount 변경 없음)
  - 기준 내 '알아요' → 정상 마스터 처리
  - 기준 내 '모름' → `masteryCount -= 1` (최소 0)

### 디바이스별 카드 상호작용 (UX)
- **탭/클릭 = 카드 뒤집기(Flip)만**: 정답/오답 처리 없음, 앞↔뒤 토글
- **3D 플립 애니메이션**: CSS `rotateY(180deg)` + `backface-visibility: hidden` (0.5초)
  - 양면 동시 DOM 존재, `backface-visibility: hidden`으로 뒷면 숨김
  - 카드 전환 시 `requestAnimationFrame` 2프레임으로 플립 트랜지션 일시 해제 (뒤→앞 역재생 방지)
- **드래그 스와이프 (앞면·뒷면 모두, 모바일+PC)**:
  - 카드를 손가락/마우스로 끌어서 이동
  - 왼쪽 드래그 → **패스** (이번 세션에서 제외, SRS 변경 없음)
  - 오른쪽 드래그 → **되돌리기** (이전 카드 복원, SRS 롤백, 히스토리 최대 50개)
  - AI 모달 열린 상태에서 드래그 비활성
  - **영역 기반 드래그 피드백**: 카드 뒤 배경을 좌우 반반 분할
    - 왼쪽 절반: 회색 배경 + `⏭️ 패스` — 드래그 거리에 비례해 opacity 증가
    - 오른쪽 절반: 회색 배경 + `↩️ 되돌리기` — 드래그 거리에 비례해 opacity 증가
    - `framer-motion`으로 부드러운 opacity 전환 (`duration: 0.1s`)
  - 임계값(80px) 미달 시 스냅백 애니메이션
  - `rotateY(180deg)` 상태에서 `translateX` 미러링 보정 (`-dragX`)
  - `touch-action: pan-y` + `e.preventDefault()` 로 브라우저 기본 스와이프(뒤로가기) 차단
  - 드래그/스크롤 시 클릭(플립) 방지 (`didMove` ref)
- **카드 전환**: 애니메이션 없음 — 다음 카드 즉시 표시 (눈 피로 방지)
- **명시적 액션 버튼 (뒷면 하단)**:
  - `❌ 모름` (bg-rose-500) / `⭕ 앎` (bg-emerald-500) 양쪽 나란히 배치
  - PC·모바일 공통 사용
- **마스터리 수동 토글**: 마스터리 점(●●●) (카드 우상단 + DayPreviewScreen)
  - 마스터된 카드(masteryCount ≥ 3)에서만 터치 가능 → 확인 다이얼로그 → masteryCount 3→1 전환
  - 모르는→아는 수동 전환은 없음 (학습을 통해서만 마스터 가능)
- **PC 키보드 단축키**:
  - `↑ (ArrowUp)` / `↓ (ArrowDown)`: 카드 뒤집기 (앞↔뒤)
  - `← (ArrowLeft)`: 모르는 단어 (뒷면에서만)
  - `→ (ArrowRight)`: 아는 단어 (뒷면에서만)

### 43일 커리큘럼 (슬라이딩 윈도우)
- 전체 430장을 id 오름차순으로 10개씩 → `SETS[0]~SETS[42]` (모듈 로드 시 1회 계산, 불변)
- Day별 풀: Day 1 = Set 1, Day 2 = Set 1-2, Day N≥3 = Set(N-2)~Set(N)
- **패턴(pattern) UI에서 제외**: Day 시작 시 `type !== 'pattern'` 필터 적용 (데이터 파일은 유지)
- `getDayBasePool(day)` — 순수 함수 (UI 미리보기용)
- `currentDay` 변경 → `DayPreviewScreen` 경유 → `selectedWordIds` 동기화

### Day 미리보기 플로우
1. `startGameByDay(day)` → `dayPreviewPool` + `selectedWordIds` 세팅 → `appScreen = 'day-preview'`
   - **디폴트: 아는 단어(masteryCount ≥ 3) 제외** — 초기 선택에서 마스터 단어 자동 필터링
2. `DayPreviewScreen` — 체크박스로 개별 카드 선택/해제, 전체 선택/해제
   - "아는 단어 포함" 필터칩: 기본 OFF, 토글로 포함/제외 전환
3. "퀴즈 시작" → `startGameByDayWithSelection()` → `_launchGame()`

### TTS 흐름
1. `useTTS(hiragana, reverseMode ? showAnswer : !showAnswer)` — 일본어(hiragana) 표시 면에서 자동 재생
   - 기본 모드: 앞면(발음 표시) 노출 시 재생
   - 리버스 모드: 뒷면(일본어 표시) 노출 시 재생
2. `TTSButtons` — 듣기(1.0x) / 천천히(0.7x) 버튼 쌍, 카드 앞면·뒷면 모두 상시 노출
3. **블라인드 모드 앞면**: 느리게 재생 버튼 없음, 일반 재생 버튼(`w-20 h-20`)을 화면 중앙에 크게 배치
4. 프리패치: `queue[0]?.id` 변경 시 다음 5개 카드 1.0x + 0.7x 백그라운드 캐싱
5. **캐시 관리**: 인메모리 Map 최대 200개 LRU — 초과 시 가장 오래된 항목 evict

### AI Q&A 흐름
1. 카드 뒷면 하단 우측 `AI 질문` 버튼 → `AiChatModal` 오픈
2. `askAI(currentCard, userQuestion)` — 카드 객체를 시스템 프롬프트에 주입
3. Gemini 응답 → `MarkdownText` 컴포넌트로 렌더링 (`**굵게**`, `*기울임*`, `` `코드` ``, 불릿, 줄바꿈)
4. `currentCard.id` 변경 시 채팅 기록 초기화
5. **스와이프 다운 닫기**: 메시지 영역 최상단(`scrollTop ≤ 2px`)에서 80px 이상 아래로 스와이프 시 모달 닫힘 (스냅백 포함)
6. AI 모달 열린 상태에서 카드 드래그 스와이프 비활성

### 세션 상태 자동 저장 (새로고침 유지)
- `jflash_session_v1`에 `appScreen`, `selectedWordIds`, `dayPreviewPoolIds` 저장
- `appScreen`, `selectedWordIds`, `dayPreviewPool` 변경 시 `useEffect`로 자동 저장
- 새로고침 후: 마지막 화면(home/browse/day-preview)과 선택 상태 복원
- 게임 진행 중(`gameStarted`)은 저장하지 않음 — 새로고침 시 홈으로 복귀

### 전체 초기화
- HomeScreen 헤더 우상단 톱니바퀴(⚙) → 드롭다운 메뉴 → "전체 초기화"
- 경고 다이얼로그: "모든 학습 기록이 영구적으로 삭제됩니다. 되돌릴 수 없습니다."
- 실행 시: `LS` 내 모든 키 삭제 + 모든 상태를 기본값으로 초기화

### localStorage 키 목록
| 키 | 내용 |
|---|---|
| `jflash_settings_v2` | reverseMode, blindMode, hardcoreMode |
| `jflash_srs_v2` | { [wordId]: { masteryCount, nextReview } } |
| `jflash_curriculum_v1` | { currentDay: number } — 현재 학습 Day (1~43) |
| `jflash_session_v1` | { appScreen, selectedWordIds, dayPreviewPoolIds } — 세션 상태 (새로고침 복원용) |

---

## 설계 원칙

1. **pron 최우선** — 카드 앞면은 항상 한국어 발음 표기가 중심
2. **hiragana는 TTS 소스** — `〜`, `[]` 등 패턴 기호는 googleTTS.js에서 제거
3. **스키마 일관성** — 모든 데이터 파일은 위 스키마를 반드시 준수
4. **id 중복 금지** — 현재 1~430 사용, 새 데이터는 431부터
5. **localStorage 키 버전 관리** — 스키마 변경 시 `_v2`, `_v3` 등으로 갱신
6. **Tailwind 클래스 완전 문자열** — 동적 interpolation 사용 시 purge에서 제거됨

---

## 개발 운영 프로토콜

> 사용자가 별도로 요청하지 않아도 아래 규칙을 **항상 자동 적용**한다.

### 1. 데이터 파일 수정 전 ID 검증 (필수)

데이터를 추가·수정하기 전에 반드시 아래 절차를 실행한다.

```
① 4개 파일 전체 ID 스캔
   verbs.js(1~150) / adjectives.js(151~230) / patterns.js(231~280) / sentences.js(281~430)

② 중복 ID 존재 여부 확인
   → 중복 발견 시: 작업 중단 후 사용자에게 보고, 해결 방안 제시

③ 다음 사용 가능 ID 확정
   → 전체 최댓값 + 1 을 신규 시작 ID로 사용
   → 현재 최댓값 430 → 신규는 431부터 (CLAUDE.md 업데이트 필요 시 함께 반영)
```

- 작업 완료 후: 추가된 ID 범위와 수량을 간략히 보고한다.
- ID를 임의로 추정하지 않는다. 반드시 파일을 열어 실제 값을 확인한다.

### 2. 참조 무결성 자동 검증

| 필드 | 검증 규칙 |
|---|---|
| `antonymId` | 동일 파일(word 타입) 내 실존 ID만 허용 |
| `componentIds[]` | verbs(1~150) · adjectives(151~230) · patterns(231~280) 범위만 허용 |
| `tags[0]` | `#동사` `#형용사` `#패턴` `#통문장` 중 하나여야 함 |
| `politeness` | `'반말'` `'정중체'` `'해당없음'` 세 값만 허용 |

위 규칙에 위배되는 항목을 발견하면 수정 전 사용자에게 명시적으로 알린다.

### 3. 코드 변경 시 자동 점검 항목

- **Tailwind 동적 클래스 금지**: `` `bg-${color}-100` `` 형태 절대 사용 안 함 → 완전한 문자열로 작성
- **localStorage 스키마 변경**: 키 이름에 버전 suffix(`_v3` 등) 올리고, 마이그레이션 로직 추가
- **새 type 추가**: `CATEGORY_META`와 `TYPE_META` 동시 업데이트 필수
- **`word.category` 참조 금지**: 항상 `word.type` 사용

### 4. 작업 완료 보고 형식

코드 수정 후 반드시 아래 항목을 간결하게 보고한다:
1. 변경한 파일 목록
2. 추가/수정된 ID 범위 (데이터 변경 시)
3. 발견된 이슈 및 처리 결과
4. 다음 사용 가능 ID (데이터 추가 시)

---

## UI/UX 디자인 원칙

> UI를 건드릴 때마다 아래 기준을 **기본값**으로 적용한다. 별도 지시가 없으면 이 원칙이 우선한다.

### 1. 여백 위계 (Spacing Hierarchy)

```
레이아웃 레벨  : px-4 py-6 ~ px-6 py-8   (페이지 전체 패딩)
카드 레벨      : p-5 ~ p-6               (카드·패널 내부)
섹션 구분      : mb-4 ~ mb-6             (카드 내 블록 간)
요소 레벨      : gap-2 ~ gap-3           (아이콘+텍스트, 버튼 그룹)
인라인 레벨    : px-3 py-1.5             (뱃지·태그)
```

- 인접한 두 요소의 여백이 같으면 위계가 사라진다 → **상위 컨테이너의 여백 ≥ 하위 요소의 여백**을 항상 유지한다.
- `mt-` 단독보다 부모의 `space-y-` 또는 `gap-`으로 묶어 관리한다.

### 2. 타이포그래피 위계 (Typography Hierarchy)

| 역할 | 클래스 | 비고 |
|---|---|---|
| 카드 앞면 핵심(pron) | `text-4xl font-bold tracking-tight` | 최우선 시각 요소 |
| 카드 뒷면 뜻(meaning) | `text-2xl font-semibold` | pron보다 한 단계 작게 |
| 예문·설명 | `text-base text-gray-600` | 보조 정보, 회색 처리 |
| 뱃지·레이블 | `text-xs font-medium` | 시각적 소음 최소화 |
| 버튼 텍스트 | `text-sm font-semibold` | 아이콘 병용 시 `gap-1.5` |

- 한 화면에 **font-bold는 1~2개** 이하로 제한한다. 전부 굵으면 위계가 없어진다.
- 색상으로만 위계를 표현하지 않는다 → 크기·굵기와 함께 사용한다.

### 3. 색상 사용 원칙

- **배경은 중립**(`bg-white` / `bg-gray-50`)으로 유지하고, 강조색은 포인트에만 쓴다.
- type별 뱃지 색상은 **CATEGORY_META에 정의된 값**만 사용, 임의로 변경하지 않는다.
- 액션 버튼 색상 고정:
  - 정답(알아요): `bg-emerald-500 hover:bg-emerald-600`
  - 오답(몰라요): `bg-rose-500 hover:bg-rose-600`
  - 보조 액션: `bg-gray-100 hover:bg-gray-200 text-gray-700`
  - AI 질문: `bg-violet-50 text-violet-500 border-violet-200`
- **텍스트 대비**: 배경 대비 WCAG AA 기준(4.5:1) 이상 유지. 회색 텍스트는 `gray-600` 이상.

### 4. 카드 레이아웃 원칙

- 카드는 **단일 집중 구조**: 한 번에 하나의 정보만 전면에 노출한다.
- 최대 너비: `max-w-md mx-auto` — 모바일·데스크톱 모두 중앙 정렬.
- 카드 높이: `h-[540px]` — 모바일에서 드래그 편의 + 텍스트 여유 공간 확보.
- 카드 그림자: `shadow-md rounded-2xl` — 배경과 카드를 명확히 분리.
- 앞면과 뒷면의 **카드 크기·위치가 동일**해야 전환 시 흔들림이 없다.
- 정보 밀도: 뒷면에 요소를 추가할 때 스크롤 없이 한 화면에 담길 수 있는지 확인한다.
- **블라인드 모드 뒷면**: `overflow-y-auto` 적용 — 긴 텍스트도 스크롤로 접근 가능.
- 카드 뒷면 하단 고정 레이아웃: **왼쪽 = TTS 버튼 쌍**, **오른쪽 = AI 질문 버튼**

### 5. 버튼·인터랙션 원칙

- 정답/오답 버튼은 항상 **하단 고정**, 좌(모름)·우(알아요) 배치를 유지한다.
- 버튼 최소 터치 영역: `py-3 px-6` 이상 (모바일 44px 기준).
- 로딩·비활성 상태: `opacity-50 cursor-not-allowed` 로 명확히 구분.
- 아이콘 단독 버튼은 반드시 `title` 또는 `aria-label` 속성을 추가한다.

### 6. 반응형 원칙

- **모바일 퍼스트**: 기본 클래스가 모바일 기준, `sm:` `md:` prefix로 확장.
- 패딩·폰트 크기는 모바일에서 데스크톱의 80% 수준으로 시작.
- 버튼 그룹: 모바일 `flex-col`, 데스크톱 `sm:flex-row`.
- 테스트 기준 해상도: 375px(모바일), 768px(태블릿), 1280px(데스크톱).

### 7. 조잡함 방지 체크리스트

새 UI 요소를 추가하거나 기존 요소를 수정할 때 반드시 확인:

- [ ] 같은 역할의 요소가 두 곳에 중복 배치되지 않았는가?
- [ ] 여백이 위계 표에서 벗어나지 않았는가?
- [ ] 색상 강조가 3가지 이하인가?
- [ ] 텍스트 크기 단계가 4단계 이하인가? (크기 종류가 너무 많으면 산만함)
- [ ] 카드 한 면에 표시되는 정보가 5개 이하인가?
- [ ] 버튼 위치가 이전 상태와 동일한가? (레이아웃 점프 방지)

---

## 새 데이터 추가 체크리스트

- [ ] `src/data/[name].js` 생성, id 431부터 순번
- [ ] `tags[0]`에 종류 표시 태그 설정 (`#동사`, `#형용사` 등)
- [ ] `src/data/index.js`에 import + `wordData` spread 추가
- [ ] `type`이 기존 3종(`word/pattern/sentence`) 외 신규라면 `CATEGORY_META`에도 추가

## 환경 변수 (.env)

```env
VITE_GOOGLE_TTS_API_KEY=...   # Google Cloud TTS
VITE_GEMINI_API_KEY=...       # Google Gemini AI
```

Vercel 배포 시 대시보드 Environment Variables에도 동일하게 추가.

## 실행

```bash
npm install
npm install @google/generative-ai   # Gemini SDK (최초 1회)
npm run dev    # 개발
npm run build  # 빌드 (dist/)
```
