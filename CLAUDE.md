# CLAUDE.md — 일본어 발음 카드

## AI 에이전트 작업 프로토콜

사용자의 코드 및 데이터 수정 요청을 처리할 때, 데이터 무결성 검증(ID 확인 등)과 후행 보고, Git 워크플로우가 누락되는 것을 방지하기 위해 다음 2가지 규칙을 준수한다.

1. 기본적으로 매 답변마다 문서 최하단에 정의된 **[표준 작업 체크리스트]**를 복사하여, 각 단계를 수행한 후 `[x]` 표시와 함께 출력해야 한다.
2. **빠른 작업 모드(/fast)**: 사용자가 프롬프트에 `/fast` 키워드를 포함한 경우, 체크리스트 출력 및 복잡한 후행 검증, Git 워크플로우를 모두 생략하고 즉각적인 코드/데이터 수정에만 집중한다.

### 업데이트 내역 관리 (필수)

- 대상 파일: `updates.md` (루트 디렉토리)
- 모든 코드 변경 시 반드시 새 버전 항목을 `updates.md` 최상단에 추가한다.
- 버전 형식: `v1.XX` (0.01씩 증가)
- 항목 형식: `## v1.XX (YYYY-MM-DD)` + `- 변경 내용`
- 최근 10개 버전만 유지하고, 초과하는 과거 내역은 삭제한다.

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
  tags:         string[], // tags[0]은 반드시 '#동사'|'#형용사'|'#명사' 등 종류 표시
  politeness:   string,   // '반말' | '정중체' | '해당없음'
  pron:         string,   // 한국어 발음 — 카드 앞면 핵심
  meaning:      string,   // 한국어 뜻
  hiragana:     string,   // 일본어 표기 (TTS 소스, 〜/[] 포함 가능)
  example:      string,   // 예문/상황 (한국어 발음 표기)
  description:  string,   // 학습 포인트/주의사항
  antonymId?:   number,   // 반의어 ID (word 타입 전용)
  structure?:   string,   // 문법 구조 (pattern 타입 전용)
}
```

### 데이터 파일 현황

| 파일 | export | type | ID 범위 | 수량 |
|---|---|---|---|---|
| `src/data/verbs.js` | `verbs` | word | 1~100 | 동사 100개 |
| `src/data/adjectives.js` | `adjectives` | word | 101~155 | 형용사 55개 |
| `src/data/nouns.js` | `nouns` | word | 156~230 | 명사 75개 |
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
| `src/lib/gemini.js` | Gemini API 클라이언트, `askAI(currentCard, userQuestion, history)` — 카드 문맥 + 대화 히스토리 주입형 |
| `src/lib/curriculum.js` | `TOTAL_DAYS`, `SETS`, `getDayBasePool(day)` — 19일 커리큘럼 (priority 기반 배치 + 단어:통문장 비율 그라데이션) |
| `src/hooks/useTTS.js` | `useTTS(text, enabled)` 자동재생 훅, `speakText(text, {rate})` |
| `src/App.jsx` | SRS, 큐 빌드, 하드코어/블라인드/리버스 모드, D-Day, 토스트, 세션 상태 자동 저장, 전체 초기화, 3회 오답 패스, 패스/되돌리기 (반의어·의존성 주입 로직 제거됨) |
| `src/components/WordCard.jsx` | 3D 플립 카드, 드래그 스와이프(useDrag 훅: 좌=패스/우=되돌리기), 모드별 렌더링, TTS·AI·액션 버튼, 마스터리 토글(2단계), 카드 전환 시 플립 애니메이션 제거 |
| `src/components/HomeScreen.jsx` | 홈 화면 — Day 선택, 설정 패널(토글 3종), 관리 설정 메뉴(전체 초기화), 탐색 모드 |
| `src/components/DayPreviewScreen.jsx` | Day 미리보기 — 단어 체크박스 선택, 퀴즈 시작 |
| `src/components/AiChatModal.jsx` | AI 질문 바텀시트 — 채팅 UI, 마크다운 렌더러, 카드별 대화 컨텍스트 유지, 추천 질문 3종, 드래그 핸들로 닫기, 오버레이 클릭 닫기 |
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
- **masteryCount ≥ 2** = '완전히 아는 단어' (DayPreviewScreen 필터 기준)
- 제한 시간 내 정답(Know) → `masteryCount += 1`
- 오답(Unknown) → `masteryCount -= 1` (최소 0)
- 타임아웃(시간 초과) → `masteryCount` 변경 없음, 큐 맨 끝으로 이동
- 마스터 확정 시 → `nextReview` = 오늘 + [1, 3, 7]일 (`masteryCount` 기반)
- `srsData` = localStorage `jflash_srs_v2`
- 진행도 시각화: 카드 우상단에 2개의 점(●○)으로 현재 masteryCount 표시
- 수동 토글: 마스터리 점(●●) 터치 → 확인 다이얼로그 → masteryCount 2→0 (모르는 단어로만 전환 가능, 역방향 없음)

### 큐 빌드 순서
1. 사용자가 선택한 단어 풀(`selectedWordIds`)을 그대로 사용 — 추가 필터링 없음
   - Day 학습: DayPreviewScreen에서 "아는 단어 제외" 필터 + 체크박스로 사전 선별
   - 탐색 학습: BrowseScreen에서 직접 선택
2. priority 1 → 2 → 3 순으로 그룹화, 각 그룹 내 Fisher-Yates 셔플

### 3회 오답 패스
- 동일 카드를 세션 내에서 3회 이상 '모름' → 큐에 재삽입하지 않고 자동 pass
- 토스트 메시지: "3회 오답 — 다음 카드로 넘어갑니다"
- `failCount[cardId]`로 세션 내 실패 횟수 추적, 게임 종료 시 초기화

### 패스 (스와이프 제외)
- 왼쪽 드래그 스와이프 → 현재 카드를 이번 세션 큐에서 **완전 제거** (SRS 변경 없음)
- 학습 효과 없이 건너뛸 때 사용 — masteryCount, nextReview 모두 변경 없음
- **되돌리기 가능**: 패스 시에도 `historyStack`에 기록 → 왼쪽 스와이프로 패스한 카드 복원 가능 (연속 패스도 역순 복원)

### 하드코어 타이머 + 타임아웃 페널티
- **하드코어 타이머** (하드코어 모드 전용):
  - `word` 타입: **3초**, `pattern`/`sentence` 타입: **7초** 카운트다운
  - 0초 → `handleActionRef.current('dontKnow')` 호출 (stale closure 방지용 ref)
  - **재플립 방지**: `answerSeenRef`로 뒷면 열람 추적 → 뒤→앞 재플립 시 타이머 재시작 차단 (악용 방지)
- **타임아웃 페널티** (일반 학습, 하드코어와 독립):
  - 페널티 기준: `word` **8초**, `pattern` **13초**, `sentence` **17초**
  - 기준 초과 + **'안다' 선택 시에만** → 큐 맨 끝 이동, SRS 미갱신 (masteryCount 변경 없음)
  - 기준 초과 + '모름' 선택 시 → 타임아웃 무시, 정상 오답 처리
  - 기준 내 '알아요' → 정상 마스터 처리
  - 기준 내 '모름' → `masteryCount -= 1` (최소 0)

### 디바이스별 카드 상호작용 (UX)
- **탭/클릭 = 카드 뒤집기(Flip)만**: 정답/오답 처리 없음, 앞↔뒤 토글
- **3D 플립 애니메이션**: CSS `rotateY(180deg)` + `backface-visibility: hidden` (0.5초)
  - 양면 동시 DOM 존재, `backface-visibility: hidden`으로 뒷면 숨김
  - **탭 플립(앞↔뒤)**: 항상 0.5초 애니메이션 — `enableFlipTransition` 초기값 `true`
  - **카드 전환(다음 카드)**: 항상 애니메이션 없이 즉시 표시
    - 렌더 중 `isCardTransition` 동기 감지 (`prevWordIdRef !== word.id`)로 해당 렌더에서 `flip-transition` CSS 클래스 차단
    - 2프레임 `requestAnimationFrame` 후 트랜지션 재활성화 (다음 탭 플립용)
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
- **카드 전환**: 애니메이션 없음 — 다음 카드 즉시 표시 (`prevWordIdRef`로 word.id 변경 즉시 감지, 플립 트랜지션 해제)
- **명시적 액션 버튼 (뒷면 하단)**:
  - `❌ 모름` (bg-rose-500) / `⭕ 앎` (bg-emerald-500) 양쪽 나란히 배치
  - PC·모바일 공통 사용
- **마스터리 수동 토글**: 마스터리 점(●●) (카드 우상단 + DayPreviewScreen)
  - 마스터된 카드(masteryCount ≥ 2)에서만 터치 가능 → 확인 다이얼로그 → masteryCount 2→0 전환
  - 모르는→아는 수동 전환은 없음 (학습을 통해서만 마스터 가능)
- **PC 키보드 단축키**:
  - `↑ (ArrowUp)` / `↓ (ArrowDown)`: 카드 뒤집기 (앞↔뒤)
  - `← (ArrowLeft)`: 모르는 단어 (뒷면에서만)
  - `→ (ArrowRight)`: 아는 단어 (뒷면에서만)

### 19일 커리큘럼 (priority 기반 + 비율 그라데이션)
- 패턴 제외 380장(단어 230 + 통문장 150)을 19일에 배분
- **priority 기반 배치**: P1→앞쪽 Day 집중, P2→중간, P3→뒤쪽 Day
  - 같은 priority 안에서는 seeded shuffle로 변주 (결정적, 동사/형용사/명사 혼합)
- **Day별 단어:통문장 비율 그라데이션**:
  - Day 1~3: 80:20 (기초 어휘 먼저)
  - Day 4~7: 70:30
  - Day 8~11: 50:50
  - Day 12~15: 35:65
  - Day 16~19: 30:70 (실전 문장 위주)
- 비례 배분(`distribute()`)으로 단어 230개, 통문장 150개를 비율 가중치에 따라 각 Day에 분배
- 하루 약 18~22장, 겹침 없음
- **패턴(pattern) 커리큘럼 완전 제외**: BrowseScreen에서만 접근
- `getDayBasePool(day)` = `SETS[day-1]` — 순수 함수
- `currentDay` 변경 → `DayPreviewScreen` 경유 → `selectedWordIds` 동기화

### Day 미리보기 플로우
1. `startGameByDay(day)` → `dayPreviewPool` + `selectedWordIds` 세팅 → `appScreen = 'day-preview'`
   - **디폴트: 아는 단어(masteryCount ≥ 2) 제외** — 초기 선택에서 마스터 단어 자동 필터링
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
2. `askAI(currentCard, userQuestion, history)` — 카드 객체 + 대화 히스토리를 시스템 프롬프트에 주입
   - **카드별 대화 컨텍스트 유지**: 같은 카드 내에서 이전 질문/답변이 프롬프트에 포함됨
   - **프롬프트 설정**: 일본어 발음 한국어 표기 필수, 정갈한 형식 요청
3. Gemini 응답 → `MarkdownText` 컴포넌트로 렌더링 (`**굵게**`, `*기울임*`, `` `코드` ``, 불릿, 줄바꿈)
4. `currentCard.id` 변경 시 채팅 기록 초기화
5. **추천 질문 3종**: 메시지 없을 때 `문장 분석` / `비슷한 예시` / `단어 뜻` 버튼 표시 (각각 "-일본어 발음을 같이 표기해줘" 프롬프트 포함)
6. **입력**: Enter 전송 없음 (버튼으로만 전송)
7. **닫기 방식**: 드래그 핸들 아래로 80px 스와이프 / 오버레이(빈 공간) 클릭 / X 버튼
8. **제목 표시**: `pron`에서 `**` 마크다운 제거 후 표시 (`stripBold`)
9. AI 모달 열린 상태에서 카드 드래그 스와이프 비활성

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
| `jflash_curriculum_v1` | { currentDay: number } — 현재 학습 Day (1~19) |
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

1. 사용자의 요청에 `/fast` 키워드가 있는지 확인한다.
2. `/fast`가 있다면 부연 설명 없이 즉각적인 답변과 코드/데이터 수정 내용만 간결하게 제공하고 종료한다.
3. `/fast`가 없다면, 즉시 하단의 **[표준 작업 체크리스트]** 포맷을 출력하고, 1~4단계를 순차적으로 실행하며 빈틈없이 무결성 검증과 작업을 완수한다. (작업 전 불필요한 계획 브리핑 생략)

### 1. 데이터 파일 수정 전 ID 검증 (필수)

데이터를 추가·수정하기 전에 반드시 아래 절차를 실행한다.

```
① 5개 파일 전체 ID 스캔
   verbs.js(1~100) / adjectives.js(101~155) / nouns.js(156~230) / patterns.js(231~280) / sentences.js(281~430)

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
| `antonymId` | word 타입(1~230) 내 실존 ID만 허용 |
| `tags[0]` | `#동사` `#형용사` `#명사` `#패턴` `#통문장` 중 하나여야 함 |
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

## Git 워크플로우 (자동 main 반영)

코드 및 데이터 수정 완료 후 반드시 아래 순서를 따른다:

1. 변경 파일 `git add` → `git commit`
2. 머지 충돌 방지: push 전에 반드시 `git fetch origin main && git rebase origin/main` 실행
3. `git push` (현재 브랜치)
4. **main 브랜치에 머지** — 작업 브랜치에서 main으로 즉시 병합

요약: 모든 코드 변경은 사용자의 별도 지시가 없어도 최종적으로 **main 브랜치에 자동 반영**되어야 한다.

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

---

## 표준 작업 체크리스트 (답변 시 필수 출력)

사용자 요청 처리 시 (`/fast` 모드가 아닐 경우) 답변 내용에 반드시 아래 체크리스트를 포함하여 무결성 검증 및 작업 누락을 방지한다.

### 1. 작업 대상 및 사전 파악
- [ ] 타겟 파일: [수정할 파일명 기재]
- [ ] 데이터 ID 확인: [데이터 추가/수정 시 현재 최대 ID 및 중복 여부 대조 확인, 해당 없으면 '해당 없음']

### 2. 코드 및 데이터 수정
- [ ] [파일명] 수정 완료 (UI 수정 시 'UI/UX 디자인 원칙' 준수 확인)

### 3. 무결성 검증 (누락 주의)
- [ ] 참조 무결성(antonymId, tags 등) 및 데이터 스키마 검증 완료
- [ ] Tailwind 동적 클래스 미사용 확인 완료
- [ ] updates.md 갱신 완료: [새 버전(v1.XX) 추가 확인]

### 4. 작업 보고 및 Git 자동화
- [ ] 변경 파일, ID 범위, 발견된 이슈 간략 보고 작성 완료
- [ ] `git add` & `commit` 완료
- [ ] `main` 브랜치로 자동 병합(merge) 및 리모트 `push` 완료
