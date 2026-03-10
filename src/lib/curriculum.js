/**
 * 43일 커리큘럼 — 세트 분할 & 슬라이딩 윈도우
 *
 * SETS 구성 방식: Round-robin 타입 인터리빙
 *   word(230개) + pattern(50개) + sentence(150개)를 43개 슬롯에 순환 배분
 *   → 각 Set: 단어 5~6 + 패턴 1~2 + 통문장 3~4 = 9~12장
 *   → Day 1부터 3가지 타입이 모두 혼합됨
 *
 * 슬라이딩 윈도우:
 *   Day 1      : Set 1           (9~12장)
 *   Day 2      : Set 1–2         (~20장)
 *   Day N ≥ 3  : Set(N-2)~Set(N) (~28~35장)
 */

import { wordData } from '../data';

export const TOTAL_DAYS = 43;

/**
 * 타입별 round-robin 배분으로 생성된 43개 세트.
 * 모듈 로드 시 1회 계산 후 불변.
 */
export const SETS = (() => {
  const words     = wordData.filter((w) => w.type === 'word')
                            .sort((a, b) => a.id - b.id);
  const patterns  = wordData.filter((w) => w.type === 'pattern')
                            .sort((a, b) => a.id - b.id);
  const sentences = wordData.filter((w) => w.type === 'sentence')
                            .sort((a, b) => a.id - b.id);

  const sets = Array.from({ length: TOTAL_DAYS }, () => []);

  // 각 타입을 43개 슬롯에 순환 배분 (i % 43)
  words.forEach((w, i)     => sets[i % TOTAL_DAYS].push(w));  // 230개 → 세트당 5~6개
  patterns.forEach((p, i)  => sets[i % TOTAL_DAYS].push(p));  // 50개  → 세트당 1~2개
  sentences.forEach((s, i) => sets[i % TOTAL_DAYS].push(s));  // 150개 → 세트당 3~4개

  return sets;
})();

/**
 * Day별 기본 풀 반환 (랜덤 패턴 미포함) — 순수 함수, UI 미리보기용
 * @param {number} day - 1 ~ TOTAL_DAYS
 * @returns {object[]} wordData 항목 배열
 */
export function getDayBasePool(day) {
  const d = Math.max(1, Math.min(TOTAL_DAYS, day));
  if (d === 1) return [...SETS[0]];
  if (d === 2) return [...SETS[0], ...SETS[1]];
  return [...SETS[d - 3], ...SETS[d - 2], ...SETS[d - 1]];
}
