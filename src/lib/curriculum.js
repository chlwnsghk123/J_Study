/**
 * 19일 커리큘럼 — priority 기반 + 단어:통문장 비율 그라데이션
 *
 * 핵심 규칙:
 *   A. priority 순서 반영: P1→앞쪽 Day, P2→중간, P3→뒤쪽
 *   B. Day별 단어:통문장 비율 그라데이션 (80:20 → 30:70)
 *   C. 하루 약 20장 (380 ÷ 19 = 20)
 *   D. 패턴(pattern)은 커리큘럼에서 제외 (BrowseScreen 전용)
 *   E. 같은 priority 안에서는 seeded shuffle로 변주
 */

import { wordData } from '../data';

export const TOTAL_DAYS = 19;

// ─── 결정적 셔플 (시드 기반, 모듈 로드마다 동일한 결과) ──────────
function seededShuffle(arr, seed = 42) {
  const a = [...arr];
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── 비율 기반 비례 분배 ──────────────────────────────────────────
function distribute(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const fracs = raw.map((r, i) => ({ i, frac: r - floors[i] }));
  fracs.sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) floors[fracs[k].i]++;
  return floors;
}

// ─── Day별 단어(word) 비율 가중치 ──────────────────────────────────
// Day 1~3: 80%, Day 4~7: 70%, Day 8~11: 50%, Day 12~15: 35%, Day 16~19: 30%
const WORD_WEIGHTS = [
  0.80, 0.80, 0.80,           // Day 1-3
  0.70, 0.70, 0.70, 0.70,     // Day 4-7
  0.50, 0.50, 0.50, 0.50,     // Day 8-11
  0.35, 0.35, 0.35, 0.35,     // Day 12-15
  0.30, 0.30, 0.30, 0.30,     // Day 16-19
];

// Day별 통문장(sentence) 비율 가중치
const SENT_WEIGHTS = [
  0.20, 0.20, 0.20,           // Day 1-3
  0.30, 0.30, 0.30, 0.30,     // Day 4-7
  0.50, 0.50, 0.50, 0.50,     // Day 8-11
  0.65, 0.65, 0.65, 0.65,     // Day 12-15
  0.70, 0.70, 0.70, 0.70,     // Day 16-19
];

/**
 * 패턴 제외, priority 기반 배치 + 비율 그라데이션.
 * 모듈 로드 시 1회 계산 후 불변.
 */
export const SETS = (() => {
  // 1. 단어(word)와 통문장(sentence) 분리 (패턴 제외)
  const allWords = wordData.filter((w) => w.type === 'word');
  const allSentences = wordData.filter((w) => w.type === 'sentence');

  // 2. priority별 그룹화 후 seeded shuffle (같은 priority 안에서 변주)
  const groupByPriority = (items, seedBase) => {
    const p1 = seededShuffle(items.filter((w) => w.priority === 1), seedBase);
    const p2 = seededShuffle(items.filter((w) => w.priority === 2), seedBase + 1);
    const p3 = seededShuffle(items.filter((w) => w.priority === 3), seedBase + 2);
    return [...p1, ...p2, ...p3]; // P1 앞쪽 → P2 중간 → P3 뒤쪽
  };

  const orderedWords = groupByPriority(allWords, 42);
  const orderedSentences = groupByPriority(allSentences, 99);

  // 3. Day별 단어/통문장 수 비례 배분
  const wordCounts = distribute(allWords.length, WORD_WEIGHTS);
  const sentCounts = distribute(allSentences.length, SENT_WEIGHTS);

  // 4. 순서대로 슬라이스하여 Day별 세트 구성
  const sets = [];
  let wOffset = 0;
  let sOffset = 0;

  for (let i = 0; i < TOTAL_DAYS; i++) {
    const dayWords = orderedWords.slice(wOffset, wOffset + wordCounts[i]);
    const daySents = orderedSentences.slice(sOffset, sOffset + sentCounts[i]);
    sets.push([...dayWords, ...daySents]);
    wOffset += wordCounts[i];
    sOffset += sentCounts[i];
  }

  return sets;
})();

/**
 * Day별 기본 풀 반환 — 순수 함수, UI 미리보기용
 * @param {number} day - 1 ~ TOTAL_DAYS
 * @returns {object[]} wordData 항목 배열
 */
export function getDayBasePool(day) {
  const d = Math.max(1, Math.min(TOTAL_DAYS, day));
  return [...SETS[d - 1]];
}
