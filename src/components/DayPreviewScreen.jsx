import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, CheckSquare, Square } from 'lucide-react';
import { CATEGORY_META } from '../data';

// ─── 소형 마스터리 점 (3개) ────────────────────────────────────────
function MiniMasteryDots({ masteryCount = 0 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            i < masteryCount ? 'bg-emerald-400' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

// ─── 단어 행 (간소화) ─────────────────────────────────────────────
function WordRow({ word, isSelected, onToggle, isMastered, masteryCount, onToggleMastery }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const catMeta = CATEGORY_META[word.type];

  // 타입별 색상 인디케이터
  const typeColor = word.type === 'word'
    ? 'bg-sky-400'
    : word.type === 'pattern'
      ? 'bg-violet-400'
      : 'bg-emerald-400';

  return (
    <div className={`relative flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
      isSelected
        ? 'border-sky-200 bg-sky-50/70'
        : 'border-slate-100 bg-white opacity-60 hover:opacity-80'
    }`}>
      {/* 체크박스 + pron + meaning */}
      <button
        onClick={() => onToggle(word.id)}
        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
      >
        <span className={`shrink-0 ${isSelected ? 'text-sky-500' : 'text-slate-300'}`}>
          {isSelected
            ? <CheckSquare className="w-4 h-4" />
            : <Square className="w-4 h-4" />
          }
        </span>
        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${typeColor}`} />
        <span className="font-bold text-slate-800 text-sm truncate min-w-0" style={{ flex: '0 1 auto', maxWidth: '45%' }}>
          {word.pron}
        </span>
        <span className="text-xs text-slate-400 truncate flex-1 min-w-0">
          {word.meaning}
        </span>
      </button>

      {/* 마스터리 점 (마스터된 것만 터치 가능) */}
      {isMastered ? (
        <button
          onClick={() => setShowConfirm(true)}
          title="모르는 단어로 변경"
          aria-label="모르는 단어로 변경"
          className="shrink-0 p-1 rounded-lg transition-colors hover:bg-emerald-50"
        >
          <MiniMasteryDots masteryCount={Math.min(masteryCount, 3)} />
        </button>
      ) : (
        <div className="shrink-0 p-1">
          <MiniMasteryDots masteryCount={Math.min(masteryCount, 3)} />
        </div>
      )}

      {/* 확인 다이얼로그 (마스터→모르는 전용) */}
      {showConfirm && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 rounded-xl">
          <span className="text-xs text-slate-600 font-medium mr-2">
            모르는 단어로?
          </span>
          <button
            onClick={() => setShowConfirm(false)}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold mr-1 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => { onToggleMastery?.(word.id); setShowConfirm(false); }}
            className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-colors"
          >
            확인
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 필터 칩 ────────────────────────────────────────────────────
function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
        active
          ? 'bg-sky-500 text-white border-sky-500'
          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );
}

// ─── 아코디언 섹션 ──────────────────────────────────────────────
function AccordionSection({ title, count, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors mb-2"
      >
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
        <span className="text-xs font-bold text-slate-600">{title}</span>
        <span className="text-xs text-slate-400 font-medium">{count}개</span>
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  );
}

// ─── 메인 Day 미리보기 화면 ──────────────────────────────────────
export default function DayPreviewScreen({
  currentDay,
  dayPool,
  selectedWordIds,
  srsData = {},
  onToggle,
  onSelectAll,
  onDeselectAll,
  onSetSelectedWordIds,
  onToggleMastery,
  onStart,
  onBack,
}) {
  // ── 필터 상태 ──────────────────────────────────────────────
  const [includeKnown, setIncludeKnown] = useState(true);
  const [filterWord, setFilterWord]       = useState(true);
  const [filterSentence, setFilterSentence] = useState(true);

  const selectedCount = dayPool.filter((w) => selectedWordIds.has(w.id)).length;
  const totalCount    = dayPool.length;

  // ── SRS 기반 아는/모르는 단어 분류 ────────────────────────
  const isKnown = (w) => (srsData[w.id]?.masteryCount ?? 0) >= 3;
  const getMasteryCount = (w) => srsData[w.id]?.masteryCount ?? 0;

  // ── 필터 적용 함수 ────────────────────────────────────────
  const applyFilters = (include, word, sentence) => {
    const poolIds = new Set();
    dayPool.forEach((w) => {
      if (w.type === 'word' && !word) return;
      if (w.type === 'pattern') return; // 패턴 제외
      if (w.type === 'sentence' && !sentence) return;
      if (!include && isKnown(w)) return;
      poolIds.add(w.id);
    });
    onSetSelectedWordIds(poolIds);
  };

  // ── 필터 토글 핸들러 ──────────────────────────────────────
  const handleToggleKnown = () => {
    const next = !includeKnown;
    setIncludeKnown(next);
    applyFilters(next, filterWord, filterSentence);
  };

  const handleToggleType = (type) => {
    let nextWord = filterWord, nextSentence = filterSentence;
    if (type === 'word') nextWord = !filterWord;
    if (type === 'sentence') nextSentence = !filterSentence;
    if (type === 'word') setFilterWord(nextWord);
    if (type === 'sentence') setFilterSentence(nextSentence);
    applyFilters(includeKnown, nextWord, nextSentence);
  };

  // ── 모르는/아는 분류 (타입 구분 없이 단일 리스트) ──────────
  const unknownItems = dayPool.filter((w) => !isKnown(w));
  const knownItems   = dayPool.filter((w) => isKnown(w));

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center py-8 px-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border-t-8 border-sky-400">

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <button
            onClick={onBack}
            aria-label="돌아가기"
            className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> 돌아가기
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-base font-extrabold text-slate-800">Day {currentDay}</h2>
          </div>
          <span className="text-sm font-bold text-sky-600 whitespace-nowrap">
            {selectedCount} / {totalCount}
          </span>
        </div>

        {/* 필터 + 전체선택/해제 통합 영역 */}
        <div className="px-5 pb-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChip
              label={`아는 단어 포함 (${knownItems.length})`}
              active={includeKnown}
              onClick={handleToggleKnown}
            />
            <FilterChip
              label="단어"
              active={filterWord}
              onClick={() => handleToggleType('word')}
            />
            <FilterChip
              label="통문장"
              active={filterSentence}
              onClick={() => handleToggleType('sentence')}
            />
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={onSelectAll}
                className="text-[11px] font-semibold text-slate-500 hover:text-sky-600 px-2 py-1 rounded transition-colors"
              >
                전체선택
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={onDeselectAll}
                className="text-[11px] font-semibold text-slate-500 hover:text-sky-600 px-2 py-1 rounded transition-colors"
              >
                전체해제
              </button>
            </div>
          </div>
        </div>

        {/* 단어 목록 스크롤 영역 */}
        <div className="overflow-y-auto max-h-[55vh] px-4 py-3 space-y-3 border-t border-slate-100">

          {/* ── 모르는 단어 (기본 펼침) ── */}
          {unknownItems.length > 0 && (
            <AccordionSection title="모르는 단어" count={unknownItems.length} defaultOpen={true}>
              {unknownItems.map((word) => (
                <WordRow
                  key={word.id}
                  word={word}
                  isSelected={selectedWordIds.has(word.id)}
                  onToggle={onToggle}
                  isMastered={false}
                  masteryCount={getMasteryCount(word)}
                  onToggleMastery={onToggleMastery}
                />
              ))}
            </AccordionSection>
          )}

          {/* ── 아는 단어 (기본 접힘) ── */}
          {knownItems.length > 0 && (
            <AccordionSection title="아는 단어" count={knownItems.length} defaultOpen={false}>
              {knownItems.map((word) => (
                <WordRow
                  key={word.id}
                  word={word}
                  isSelected={selectedWordIds.has(word.id)}
                  onToggle={onToggle}
                  isMastered={true}
                  masteryCount={getMasteryCount(word)}
                  onToggleMastery={onToggleMastery}
                />
              ))}
            </AccordionSection>
          )}
        </div>

        {/* 퀴즈 시작 버튼 */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-100">
          <button
            onClick={onStart}
            disabled={selectedCount === 0}
            className={`w-full font-bold py-4 rounded-2xl transition-all text-lg flex items-center justify-center gap-2 ${
              selectedCount > 0
                ? 'bg-sky-500 hover:bg-sky-600 active:scale-95 text-white shadow-lg shadow-sky-200'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {selectedCount > 0
              ? <><span>{selectedCount}장 선택</span><span className="opacity-60 text-base">·</span><span>퀴즈 시작</span><ChevronRight className="w-5 h-5" /></>
              : '단어를 선택해주세요'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
