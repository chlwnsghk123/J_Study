/**
 * 19일 커리큘럼 — 비겹침 세트 분할
 *
 * SETS 구성 방식:
 *   패턴(pattern) 제외한 380장(단어 230 + 통문장 150)을 id순 정렬
 *   → 20장씩 19그룹으로 순차 분할 (겹침 없음)
 *
 * 각 Day = 고유 20장, 슬라이딩 윈도우 없음
 */

import { wordData } from '../data';

export const TOTAL_DAYS = 19;

const CARDS_PER_DAY = 20;

/**
 * 패턴 제외, id순 정렬 후 20장씩 19세트로 분할.
 * 모듈 로드 시 1회 계산 후 불변.
 */
export const SETS = (() => {
  const pool = wordData
    .filter((w) => w.type !== 'pattern')
    .sort((a, b) => a.id - b.id);

  const sets = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    sets.push(pool.slice(i * CARDS_PER_DAY, (i + 1) * CARDS_PER_DAY));
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
