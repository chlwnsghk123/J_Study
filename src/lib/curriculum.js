/**
 * 19일 커리큘럼 — 비겹침 세트 분할 (단어·통문장 비율 분배)
 *
 * SETS 구성 방식:
 *   패턴(pattern) 제외한 380장(단어 230 + 통문장 150)을
 *   단어/통문장 각각 19등분 후 교차 배치 → 각 Day에 단어·통문장 골고루 포함
 *
 * 각 Day = 고유 20장, 겹침 없음
 */

import { wordData } from '../data';

export const TOTAL_DAYS = 19;

const CARDS_PER_DAY = 20;

/**
 * 배열을 n개 그룹으로 최대한 균등 분할
 */
function splitIntoGroups(arr, n) {
  const groups = [];
  const base = Math.floor(arr.length / n);
  let remainder = arr.length % n;
  let offset = 0;
  for (let i = 0; i < n; i++) {
    const size = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    groups.push(arr.slice(offset, offset + size));
    offset += size;
  }
  return groups;
}

/**
 * 패턴 제외, 단어·통문장을 각각 id순 정렬 후 19등분하여 교차 배치.
 * 모듈 로드 시 1회 계산 후 불변.
 */
export const SETS = (() => {
  const words = wordData
    .filter((w) => w.type === 'word')
    .sort((a, b) => a.id - b.id);

  const sentences = wordData
    .filter((w) => w.type === 'sentence')
    .sort((a, b) => a.id - b.id);

  const wordGroups = splitIntoGroups(words, TOTAL_DAYS);
  const sentenceGroups = splitIntoGroups(sentences, TOTAL_DAYS);

  const sets = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    // 단어와 통문장을 합쳐서 하나의 Day 세트 구성
    sets.push([...(wordGroups[i] || []), ...(sentenceGroups[i] || [])]);
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
