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
| 하드코어 | 3초 안에 답 확인 안 하면 자동 오답 처리 |

- **마스터 조건**: 세션 내 2회 연속 정답 → SRS 주기 할당 (1일 → 3일 → 7일)
- **오답 재삽입**: 현재 위치에서 +3~+5번째
- **반의어 쌍**: 한쪽 모르면 함께 재복습
- **의존성 주입**: 통문장/패턴 3회 실패 시 구성 단어·패턴을 큐에 자동 삽입

---

## 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. .env 파일에 Google TTS 키 확인
# VITE_GOOGLE_TTS_API_KEY=...

# 3. 개발 서버 시작
npm run dev

# 4. 빌드 (Vercel 배포용)
npm run build
```

---

## 프로젝트 구조

```
단어외우기/
├── .env                        # Google TTS API 키 (git 제외)
├── src/
│   ├── App.jsx                 # 핵심 엔진: SRS, 큐, 모드 제어
│   ├── main.jsx
│   ├── index.css
│   ├── lib/
│   │   └── googleTTS.js        # Google Cloud TTS 클라이언트 + 캐싱
│   ├── hooks/
│   │   └── useTTS.js           # 자동재생 훅 + speakText()
│   ├── components/
│   │   ├── WordCard.jsx        # 플래시카드 (앞/뒤, 리버스, 블라인드)
│   │   ├── WordSelector.jsx    # 단어 선택 + 설정 + D-Day
│   │   ├── ProgressBar.jsx
│   │   └── CompletionScreen.jsx
│   └── data/
│       ├── index.js            # 통합 export + CATEGORY_META
│       ├── verbs.js            # 동사 30개 (id 1~30)
│       ├── adjectives.js       # 형용사 30개 (id 31~60)
│       ├── patterns.js         # 필수 패턴 50개 (id 61~110)
│       └── sentences.js        # 실전 통문장 50개 (id 111~160)
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## 데이터 스키마

```js
{
  id:           number,    // 전체 고유 (현재 1~160)
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

## 새 단어 팩 추가 방법

```js
// 1. src/data/expressions.js 생성 (id는 161부터)
export const expressions = [
  {
    id: 161, type: 'word', priority: 2,
    tags: ['#표현', '#인사'], politeness: '정중체',
    pron: '요로시쿠 오네가이시마스', meaning: '잘 부탁드립니다',
    hiragana: 'よろしくお願いします',
    example: '처음 만나는 자리에서 사용',
    description: '비즈니스 필수 표현.',
  },
];

// 2. src/data/index.js에 추가
import { expressions } from './expressions';
export const wordData = [...verbs, ...adjectives, ...patterns, ...sentences, ...expressions];

// 3. CATEGORY_META에 필요시 새 타입 추가
```

---

## 주요 기능

- **Google Cloud TTS** (ja-JP-Neural2-B) — 1.0x 자동 재생 / 0.7x 천천히 듣기
- **오디오 프리패치** — 다음 5개 카드 백그라운드 캐싱으로 지연 없음
- **SRS (Spaced Repetition)** — 세션 내 2회 정답 후 1/3/7일 주기 복습
- **OR 태그 필터** — 원하는 태그만 선택해 맞춤 세션 구성
- **D-Day 할당량** — 목표일 설정 시 남은 카드를 균등 재분배하여 일일 목표 표시
- **localStorage 영속성** — 설정·SRS 데이터 세션 간 보존
