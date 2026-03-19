# 일본어 발음 카드 — OPIc IM1 대비

**목표**: 일본어 발음(한국어 표기) → 한국어 뜻을 빠르게 매칭하는 반사 훈련

히라가나나 한자 암기보다 **소리(발음) ↔ 의미** 연결에 집중한다. OPIc IM1 합격에 필요한 핵심 단어·패턴·통문장을 효율적으로 습득하는 것이 목표.

---

## 학습 방식

| 모드 | 설명 |
|---|---|
| 기본 | 앞면: 발음 → 뒷면: 뜻 + 예문 + 학습 포인트 |
| 리버스 | 앞면: 뜻 → 뒷면: 발음 (+ TTS 자동 재생) |
| 블라인드 | 앞면: 오디오만 → 뒷면: 전체 정보 |
| 하드코어 | 단어 3초 / 패턴·통문장 7초 안에 답 확인 안 하면 자동 오답 처리 |

- **19일 커리큘럼**: 단어 230 + 통문장 150 = 380장을 19일로 균등 분배 (~20장/Day)
- **마스터 조건**: 세션 내 masteryCount 2회 누적 정답 → SRS 주기 할당 (1일 → 3일 → 7일)
- **오답 재삽입**: 현재 위치에서 +3~+5번째
- **의존성 주입**: 통문장 오답 시 구성 단어를 큐에 자동 삽입 (패턴 제외)
- **3회 오답 패스**: 동일 카드 3회 이상 오답 시 자동 스킵
- **타임아웃 페널티**: 기준 시간 초과 + '알아요' 선택 시 큐 맨 끝 이동

---

## 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. .env 파일에 API 키 설정
# VITE_GOOGLE_TTS_API_KEY=...   # Google Cloud TTS
# VITE_GEMINI_API_KEY=...       # Google Gemini AI

# 3. 개발 서버 시작
npm run dev

# 4. 빌드 (Vercel 배포용)
npm run build
```

---

## 프로젝트 구조

```
J_Study/
├── .env                           # API 키 (git 제외)
├── src/
│   ├── App.jsx                    # 핵심 엔진: SRS, 큐 빌드, 모드 제어, 의존성 주입
│   ├── main.jsx
│   ├── index.css                  # Tailwind + 3D 플립 + 드래그 CSS
│   ├── lib/
│   │   ├── googleTTS.js           # Google Cloud TTS + LRU 캐싱 (200개)
│   │   ├── gemini.js              # Gemini AI 클라이언트 (askAI)
│   │   └── curriculum.js          # 19일 커리큘럼 (비겹침 세트 분할)
│   ├── hooks/
│   │   └── useTTS.js              # 자동재생 훅 + speakText()
│   ├── components/
│   │   ├── WordCard.jsx           # 3D 플립 카드 + 드래그 스와이프
│   │   ├── HomeScreen.jsx         # 홈: Day 선택, 설정, 탐색 모드
│   │   ├── DayPreviewScreen.jsx   # Day 미리보기: 카드 선택 + 퀴즈 시작
│   │   ├── BrowseScreen.jsx       # 전체 단어 탐색
│   │   ├── AiChatModal.jsx        # AI 질문 바텀시트
│   │   ├── ProgressBar.jsx        # 진행 바
│   │   └── CompletionScreen.jsx   # 학습 완료 화면
│   └── data/
│       ├── index.js               # 통합 export + CATEGORY_META
│       ├── verbs.js               # 동사 150개 (id 1~150)
│       ├── adjectives.js          # 형용사 80개 (id 151~230)
│       ├── patterns.js            # 패턴 50개 (id 231~280)
│       └── sentences.js           # 통문장 150개 (id 281~430)
├── public/                        # PWA manifest, 아이콘, OG 이미지
├── index.html                     # PWA + OG 메타 태그
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## 데이터 스키마

```js
{
  id:           number,    // 전체 고유 (현재 1~430, 새 항목은 431~)
  type:         string,    // 'word' | 'pattern' | 'sentence'
  priority:     1|2|3,    // 큐 우선순위 (1=높음)
  tags:         string[], // ['#동사', '#이동'] — tags[0]은 종류 표시
  politeness:   string,   // '반말' | '정중체' | '해당없음'
  pron:         string,   // 한국어 발음 — 카드 앞면 핵심
  meaning:      string,   // 한국어 뜻
  hiragana:     string,   // 일본어 표기 — TTS 소스
  example:      string,   // 예문/상황
  description:  string,   // 학습 포인트
  antonymId?:   number,   // 반의어 ID (word 전용)
  structure?:   string,   // 문법 구조 (pattern 전용)
  componentIds?: number[], // 구성 요소 ID (sentence 전용, 의존성 주입용)
}
```

---

## 주요 기능

- **Google Cloud TTS** (ja-JP-Neural2-B) — 1.0x 자동 재생 / 0.7x 천천히 듣기
- **오디오 프리패치** — 다음 5개 카드 백그라운드 캐싱으로 지연 없음
- **SRS (Spaced Repetition)** — masteryCount 2회 누적 후 1/3/7일 주기 복습
- **19일 커리큘럼** — 단어·통문장을 각각 19등분 후 교차 배치 (패턴은 BrowseScreen 전용)
- **AI 질문** — Gemini API로 카드별 맥락 기반 Q&A (추천 질문 3종)
- **드래그 스와이프** — 좌: 패스 / 우: 되돌리기 (모바일+PC)
- **세션 자동 저장** — 새로고침 시 마지막 화면과 선택 상태 복원
- **PWA** — 모바일 홈 화면 추가 지원

---

## 스택

- React 18 + Vite 5 + Tailwind CSS v3 + lucide-react + framer-motion
- Google Cloud TTS API (`ja-JP-Neural2-B`)
- Google Gemini API (`models/gemini-3-flash-preview`)
- PWA (manifest.json + OG/Twitter Card 메타 태그)
- Vercel 배포
