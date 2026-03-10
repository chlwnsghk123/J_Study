import { ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react';
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
function WordRow({ word, isSelected, onToggle }) {
  const catMeta   = CATEGORY_META[word.type];
  const badgeText = word.type === 'word' ? (word.tags?.[0] ?? '단어') : catMeta?.label;

  return (
    <button
      onClick={() => onToggle(word.id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
        isSelected
          ? 'border-sky-300 bg-sky-50'
          : 'border-slate-100 bg-white opacity-50 hover:opacity-75'
      }`}
    >
      {/* 체크박스 아이콘 */}
      <span className={`shrink-0 ${isSelected ? 'text-sky-500' : 'text-slate-300'}`}>
        {isSelected
          ? <CheckSquare className="w-4 h-4" />
          : <Square className="w-4 h-4" />
        }
      </span>

      {/* 발음 */}
      <span className="font-bold text-slate-800 text-sm truncate flex-1 min-w-0">
        {word.pron}
      </span>

      {/* 뜻 */}
      <span className="text-xs text-slate-500 truncate flex-1 min-w-0">
        {word.meaning}
      </span>

      {/* 타입 뱃지 */}
      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${catMeta?.badge ?? ''}`}>
        {badgeText}
      </span>
    </button>
  );
}

// ─── 메인 Day 미리보기 화면 ──────────────────────────────────────
export default function DayPreviewScreen({
  currentDay,
  dayPool,
  selectedWordIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onStart,
  onBack,
}) {
  const selectedCount = dayPool.filter((w) => selectedWordIds.has(w.id)).length;
  const totalCount    = dayPool.length;

  // 타입별 그룹 분리
  const words     = dayPool.filter((w) => w.type === 'word');
  const patterns  = dayPool.filter((w) => w.type === 'pattern');
  const sentences = dayPool.filter((w) => w.type === 'sentence');

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

          {/* 단어 섹션 */}
          {words.length > 0 && (
            <div>
              <SectionHeader
                label="단어"
                count={words.length}
                badge="bg-sky-50 text-sky-700"
              />
              <div className="space-y-1.5">
                {words.map((word) => (
                  <WordRow
                    key={word.id}
                    word={word}
                    isSelected={selectedWordIds.has(word.id)}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 패턴 섹션 */}
          {patterns.length > 0 && (
            <div>
              <SectionHeader
                label="패턴"
                count={patterns.length}
                badge="bg-violet-50 text-violet-700"
              />
              <div className="space-y-1.5">
                {patterns.map((word) => (
                  <WordRow
                    key={word.id}
                    word={word}
                    isSelected={selectedWordIds.has(word.id)}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 통문장 섹션 */}
          {sentences.length > 0 && (
            <div>
              <SectionHeader
                label="통문장"
                count={sentences.length}
                badge="bg-emerald-50 text-emerald-700"
              />
              <div className="space-y-1.5">
                {sentences.map((word) => (
                  <WordRow
                    key={word.id}
                    word={word}
                    isSelected={selectedWordIds.has(word.id)}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </div>
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
