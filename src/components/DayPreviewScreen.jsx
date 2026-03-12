import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, CheckSquare, Square, Star } from 'lucide-react';
import { CATEGORY_META } from '../data';

// ─── 타입별 섹션 헤더 ────────────────────────────────────────────
function SectionHeader({ label, count, badge }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-2 ${badge}`}>
      <span className="text-xs font-bold">{label}</span>
      <span className="text-xs font-medium opacity-70">{count}개</span>
    </div>
  );
}

// ─── 단어 행 (체크박스 포함) ─────────────────────────────────────
function WordRow({ word, isSelected, onToggle, isMastered, onToggleMastery }) {
  const catMeta   = CATEGORY_META[word.type];
  const badgeText = word.type === 'word' ? (word.tags?.[0] ?? '단어') : catMeta?.label;

  return (
    <div className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
      isSelected
        ? 'border-sky-300 bg-sky-50'
        : 'border-slate-100 bg-white opacity-50 hover:opacity-75'
    }`}>
      <button
        onClick={() => onToggle(word.id)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <span className={`shrink-0 ${isSelected ? 'text-sky-500' : 'text-slate-300'}`}>
          {isSelected
            ? <CheckSquare className="w-4 h-4" />
            : <Square className="w-4 h-4" />
          }
        </span>
        <span className="font-bold text-slate-800 text-sm truncate flex-1 min-w-0">
          {word.pron}
        </span>
        <span className="text-xs text-slate-500 truncate flex-1 min-w-0">
          {word.meaning}
        </span>
        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${catMeta?.badge ?? ''}`}>
          {badgeText}
        </span>
      </button>
      <button
        onClick={() => onToggleMastery?.(word.id)}
        title={isMastered ? '마스터 해제' : '마스터 등록'}
        aria-label={isMastered ? '마스터 해제' : '마스터 등록'}
        className="shrink-0 p-1 rounded-lg transition-colors hover:bg-amber-50"
      >
        <Star className={`w-3.5 h-3.5 ${isMastered ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
      </button>
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
      {open && <div className="space-y-1.5">{children}</div>}
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
  const [includeKnown, setIncludeKnown] = useState(false);
  const [filterWord, setFilterWord]       = useState(true);
  const [filterPattern, setFilterPattern] = useState(true);
  const [filterSentence, setFilterSentence] = useState(true);

  const selectedCount = dayPool.filter((w) => selectedWordIds.has(w.id)).length;
  const totalCount    = dayPool.length;

  // ── SRS 기반 아는/모르는 단어 분류 ────────────────────────
  const isKnown = (w) => (srsData[w.id]?.masteryCount ?? 0) >= 3;

  // ── 필터 적용 함수 ────────────────────────────────────────
  const applyFilters = (include, word, pattern, sentence) => {
    const poolIds = new Set();
    dayPool.forEach((w) => {
      // 타입 필터
      if (w.type === 'word' && !word) return;
      if (w.type === 'pattern' && !pattern) return;
      if (w.type === 'sentence' && !sentence) return;
      // 아는 단어 필터
      if (!include && isKnown(w)) return;
      poolIds.add(w.id);
    });
    onSetSelectedWordIds(poolIds);
  };

  // ── 필터 토글 핸들러 ──────────────────────────────────────
  const handleToggleKnown = () => {
    const next = !includeKnown;
    setIncludeKnown(next);
    applyFilters(next, filterWord, filterPattern, filterSentence);
  };

  const handleToggleType = (type) => {
    let nextWord = filterWord, nextPattern = filterPattern, nextSentence = filterSentence;
    if (type === 'word') nextWord = !filterWord;
    if (type === 'pattern') nextPattern = !filterPattern;
    if (type === 'sentence') nextSentence = !filterSentence;
    if (type === 'word') setFilterWord(nextWord);
    if (type === 'pattern') setFilterPattern(nextPattern);
    if (type === 'sentence') setFilterSentence(nextSentence);
    applyFilters(includeKnown, nextWord, nextPattern, nextSentence);
  };

  // ── 타입별 + 아는/모르는 분류 ─────────────────────────────
  const unknownWords     = dayPool.filter((w) => w.type === 'word' && !isKnown(w));
  const knownWords       = dayPool.filter((w) => w.type === 'word' && isKnown(w));
  const unknownPatterns  = dayPool.filter((w) => w.type === 'pattern' && !isKnown(w));
  const knownPatterns    = dayPool.filter((w) => w.type === 'pattern' && isKnown(w));
  const unknownSentences = dayPool.filter((w) => w.type === 'sentence' && !isKnown(w));
  const knownSentences   = dayPool.filter((w) => w.type === 'sentence' && isKnown(w));

  const totalKnown   = knownWords.length + knownPatterns.length + knownSentences.length;
  const totalUnknown = unknownWords.length + unknownPatterns.length + unknownSentences.length;

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center py-8 px-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border-t-8 border-sky-400">

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
          <button
            onClick={onBack}
            aria-label="돌아가기"
            className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> 돌아가기
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-base font-extrabold text-slate-800">Day {currentDay} 단어 선택</h2>
          </div>
          <span className="text-sm font-bold text-sky-600 whitespace-nowrap">
            {selectedCount} / {totalCount}
          </span>
        </div>

        {/* 필터 칩 영역 */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 flex-wrap">
          <FilterChip
            label={`아는 단어 포함 (${totalKnown})`}
            active={includeKnown}
            onClick={handleToggleKnown}
          />
          <FilterChip
            label="단어"
            active={filterWord}
            onClick={() => handleToggleType('word')}
          />
          <FilterChip
            label="패턴"
            active={filterPattern}
            onClick={() => handleToggleType('pattern')}
          />
          <FilterChip
            label="통문장"
            active={filterSentence}
            onClick={() => handleToggleType('sentence')}
          />
        </div>

        {/* 전체 선택 / 해제 버튼 */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <button
            onClick={onSelectAll}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5" /> 전체 선택
          </button>
          <button
            onClick={onDeselectAll}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Square className="w-3.5 h-3.5" /> 전체 해제
          </button>
          <span className="ml-auto text-[10px] text-slate-400">
            {selectedCount === 0 ? '단어를 선택해주세요' : `${selectedCount}장 선택됨`}
          </span>
        </div>

        {/* 단어 목록 스크롤 영역 */}
        <div className="overflow-y-auto max-h-[55vh] px-4 py-3 space-y-4">

          {/* ── 모르는 단어 영역 (기본 펼침) ── */}
          {totalUnknown > 0 && (
            <AccordionSection title="모르는 단어" count={totalUnknown} defaultOpen={true}>
              {/* 단어 */}
              {unknownWords.length > 0 && (
                <div className="mb-3">
                  <SectionHeader label="단어" count={unknownWords.length} badge="bg-sky-50 text-sky-700" />
                  <div className="space-y-1.5">
                    {unknownWords.map((word) => (
                      <WordRow key={word.id} word={word} isSelected={selectedWordIds.has(word.id)} onToggle={onToggle} isMastered={isKnown(word)} onToggleMastery={onToggleMastery} />
                    ))}
                  </div>
                </div>
              )}
              {/* 패턴 */}
              {unknownPatterns.length > 0 && (
                <div className="mb-3">
                  <SectionHeader label="패턴" count={unknownPatterns.length} badge="bg-violet-50 text-violet-700" />
                  <div className="space-y-1.5">
                    {unknownPatterns.map((word) => (
                      <WordRow key={word.id} word={word} isSelected={selectedWordIds.has(word.id)} onToggle={onToggle} isMastered={isKnown(word)} onToggleMastery={onToggleMastery} />
                    ))}
                  </div>
                </div>
              )}
              {/* 통문장 */}
              {unknownSentences.length > 0 && (
                <div className="mb-3">
                  <SectionHeader label="통문장" count={unknownSentences.length} badge="bg-emerald-50 text-emerald-700" />
                  <div className="space-y-1.5">
                    {unknownSentences.map((word) => (
                      <WordRow key={word.id} word={word} isSelected={selectedWordIds.has(word.id)} onToggle={onToggle} isMastered={isKnown(word)} onToggleMastery={onToggleMastery} />
                    ))}
                  </div>
                </div>
              )}
            </AccordionSection>
          )}

          {/* ── 아는 단어 영역 (기본 접힘) ── */}
          {totalKnown > 0 && (
            <AccordionSection title="이미 아는 단어" count={totalKnown} defaultOpen={false}>
              {knownWords.length > 0 && (
                <div className="mb-3">
                  <SectionHeader label="단어" count={knownWords.length} badge="bg-sky-50 text-sky-700" />
                  <div className="space-y-1.5">
                    {knownWords.map((word) => (
                      <WordRow key={word.id} word={word} isSelected={selectedWordIds.has(word.id)} onToggle={onToggle} isMastered={isKnown(word)} onToggleMastery={onToggleMastery} />
                    ))}
                  </div>
                </div>
              )}
              {knownPatterns.length > 0 && (
                <div className="mb-3">
                  <SectionHeader label="패턴" count={knownPatterns.length} badge="bg-violet-50 text-violet-700" />
                  <div className="space-y-1.5">
                    {knownPatterns.map((word) => (
                      <WordRow key={word.id} word={word} isSelected={selectedWordIds.has(word.id)} onToggle={onToggle} isMastered={isKnown(word)} onToggleMastery={onToggleMastery} />
                    ))}
                  </div>
                </div>
              )}
              {knownSentences.length > 0 && (
                <div className="mb-3">
                  <SectionHeader label="통문장" count={knownSentences.length} badge="bg-emerald-50 text-emerald-700" />
                  <div className="space-y-1.5">
                    {knownSentences.map((word) => (
                      <WordRow key={word.id} word={word} isSelected={selectedWordIds.has(word.id)} onToggle={onToggle} isMastered={isKnown(word)} onToggleMastery={onToggleMastery} />
                    ))}
                  </div>
                </div>
              )}
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
