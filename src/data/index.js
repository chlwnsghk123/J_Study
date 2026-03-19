/**
 * 단어 데이터 통합 진입점
 *
 * ── 새 카테고리 추가 방법 ──────────────────────────────────────
 * 1. src/data/에 새 파일 생성 (예: expressions.js)
 * 2. export const expressions = [...] 로 데이터 작성
 * 3. 아래 import + wordData spread에 추가
 * 4. CATEGORY_META에 카테고리 메타 추가
 *
 * ── 데이터 구조 ───────────────────────────────────────────────
 * id           : number    — 전체에서 고유 (현재 1~430 사용, 새 항목은 431~)
 * type         : string    — 'word' | 'pattern' | 'sentence'
 * priority     : 1|2|3    — 큐 우선순위 (1=높음, 먼저 출제)
 * tags         : string[] — 첫 번째 태그: 종류 표시용 (#동사/#형용사 등)
 * politeness   : string   — '반말' | '정중체' | '해당없음'
 * pron         : string   — 한국어 발음 (카드 앞면 핵심)
 * meaning      : string   — 한국어 뜻/번역
 * hiragana     : string   — 일본어 표기 (TTS 소스)
 * example      : string   — 예문 또는 상황 설명
 * description  : string   — 학습 포인트/주의사항
 * structure    : string?  — 문법 구조 (패턴 전용, 선택)
 * antonymId    : number?  — 반의어 ID (단어 전용, 선택)
 */

export { verbs }      from './verbs';
export { adjectives } from './adjectives';
export { patterns }   from './patterns';
export { sentences }  from './sentences';

import { verbs }      from './verbs';
import { adjectives } from './adjectives';
import { patterns }   from './patterns';
import { sentences }  from './sentences';

export const wordData = [...verbs, ...adjectives, ...patterns, ...sentences];

// ─── 카테고리 메타데이터 (type 기반) ─────────────────────────────
export const CATEGORY_META = {
  word: {
    label: '단어',
    desc: '기초 어휘',
    idle:   'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100',
    active: 'bg-sky-500 border-sky-500 text-white',
    badge:  'bg-sky-100 text-sky-700 border-sky-200',
  },
  pattern: {
    label: '패턴',
    desc: '문장 패턴',
    idle:   'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100',
    active: 'bg-violet-500 border-violet-500 text-white',
    badge:  'bg-violet-100 text-violet-700 border-violet-200',
  },
  sentence: {
    label: '통문장',
    desc: '실전 문장',
    idle:   'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100',
    active: 'bg-emerald-500 border-emerald-500 text-white',
    badge:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
};

// ─── 타입 뱃지 색상 (type: 'word'|'pattern'|'sentence') ─────────
export const TYPE_META = {
  word:     'bg-sky-100 text-sky-700 border-sky-200',
  pattern:  'bg-violet-100 text-violet-700 border-violet-200',
  sentence: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};
