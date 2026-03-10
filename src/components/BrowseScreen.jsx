import { useState } from 'react';
import {
  ChevronLeft, ChevronRight, CheckSquare, Square, Shuffle, Tag, Search,
} from 'lucide-react';
import { CATEGORY_META } from '../data';

// ─── 카테고리 패널 ───────────────────────────────────────────────
function CategoryPanel({ wordData, selectedWordIds, onToggleCategory }) {
  return (
    <div className="flex flex-col gap-2 mb-4">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">카테고리</p>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(CATEGORY_META).map(([type, meta]) => {
          const items = wordData.filter((w) => w.type === type);
          const sel   = items.filter((w) => selectedWordIds.has(w.id)).length;
          const all   = sel > 0 && sel === items.length;
          return (
            <button
              key={type}
              onClick={() => onToggleCategory(type)}
              className={`flex flex-col items-center py-3 px-2 rounded-2xl border-2 transition-all font-bold
                ${all ? meta.active : meta.idle}`}
            >
              <span className="text-sm leading-tight">{meta.label}</span>
              <span className={`text-xs mt-1 font-normal ${all ? 'opacity-80' : 'text-slate-400'}`}>
                {sel}/{items.length}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 태그 필터 ──────────────────────────────────────────────────
function TagFilter({ wordData, selectedTags, onTagToggle, onClearTags }) {
  const allTags = [...new Set(
    wordData.flatMap((w) => w.tags?.slice(1) ?? [])
  )].sort();

  if (allTags.length === 0) return null;

  return (
    <div className="mb-3">
      <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
        <Tag className="w-3 h-3" /> 태그 필터 <span className="font-normal text-slate-400">(OR)</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => onTagToggle(tag)}
            className={`text-xs px-2.5 py-1 rounded-full border font-semibold transition-colors ${
              selectedTags.includes(tag)
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tag}
          </button>
        ))}
        {selectedTags.length > 0 && (
          <button
            onClick={onClearTags}
            className="text-xs px-2.5 py-1 rounded-full border font-semibold bg-red-50 text-red-400 border-red-200 hover:bg-red-100 transition-colors"
          >
            초기화
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 빠른 동작 버튼 ─────────────────────────────────────────────
function QuickActions({ onSelectAll, onDeselectAll, onSelectRandom }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      <button
        onClick={onSelectAll}
        className="text-xs bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 py-1.5 px-3 rounded-lg flex items-center gap-1 transition-colors"
      >
        <CheckSquare className="w-3 h-3" /> 전체 선택
      </button>
      <button
        onClick={onDeselectAll}
        className="text-xs bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 py-1.5 px-3 rounded-lg flex items-center gap-1 transition-colors"
      >
        <Square className="w-3 h-3" /> 전체 해제
      </button>
      <button
        onClick={() => onSelectRandom(20)}
        className="text-xs bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-700 py-1.5 px-3 rounded-lg flex items-center gap-1 transition-colors"
      >
        <Shuffle className="w-3 h-3" /> 랜덤 20개
      </button>
    </div>
  );
}

// ─── 단어 그리드 ────────────────────────────────────────────────
function WordGrid({ wordData, selectedWordIds, activeFilter, selectedTags, onToggle }) {
  const [search, setSearch] = useState('');

  let filtered = activeFilter === '전체'
    ? wordData
    : wordData.filter((w) => w.type === activeFilter);

  if (selectedTags.length > 0) {
    filtered = filtered.filter((w) => w.tags?.some((t) => selectedTags.includes(t)));
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (w) => w.pron?.toLowerCase().includes(q) || w.meaning?.toLowerCase().includes(q)
    );
  }

  return (
    <>
      {/* 검색창 */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="발음 또는 뜻 검색..."
          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[35vh] overflow-y-auto p-1 pr-2">
        {filtered.length === 0 && (
          <p className="col-span-3 text-xs text-slate-400 text-center py-4">검색 결과 없음</p>
        )}
        {filtered.map((word) => {
          const isSelected = selectedWordIds.has(word.id);
          const catMeta    = CATEGORY_META[word.type];
          const badgeText  = word.type === 'word' ? (word.tags?.[0] ?? '단어') : catMeta?.label;

          return (
            <button
              key={word.id}
              onClick={() => onToggle(word.id)}
              className={`text-left p-3 rounded-xl border transition-all ${
                isSelected
                  ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-400'
                  : 'border-slate-200 bg-white opacity-60 hover:opacity-80'
              }`}
            >
              <div className="flex justify-between items-start mb-1 gap-1">
                <span className="font-bold text-slate-800 text-sm truncate leading-tight">
                  {word.pron}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${catMeta?.badge ?? ''}`}>
                  {badgeText}
                </span>
              </div>
              <div className="text-xs text-slate-500 truncate">{word.meaning}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── 메인 브라우즈 화면 ──────────────────────────────────────────
export default function BrowseScreen({
  wordData,
  selectedWordIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onToggleCategory,
  onSelectRandom,
  selectedTags,
  onTagToggle,
  onClearTags,
  onStart,
  onBack,
}) {
  const [activeFilter, setActiveFilter] = useState('전체');
  const filterTabs = ['전체', ...Object.keys(CATEGORY_META)];

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center py-8 px-4 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden p-6 border-t-8 border-violet-400">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors font-semibold"
          >
            <ChevronLeft className="w-4 h-4" /> 돌아가기
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-lg font-extrabold text-slate-800">전체 단어 탐색</h2>
          </div>
          <span className="text-sm font-bold text-sky-600">{selectedWordIds.size}장 선택</span>
        </div>

        {/* 카테고리 */}
        <CategoryPanel
          wordData={wordData}
          selectedWordIds={selectedWordIds}
          onToggleCategory={onToggleCategory}
        />

        {/* 카드 목록 */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-5">

          {/* 태그 필터 */}
          <TagFilter
            wordData={wordData}
            selectedTags={selectedTags}
            onTagToggle={onTagToggle}
            onClearTags={onClearTags}
          />

          {/* 빠른 동작 */}
          <QuickActions
            onSelectAll={onSelectAll}
            onDeselectAll={onDeselectAll}
            onSelectRandom={onSelectRandom}
          />

          {/* 뷰 필터 탭 */}
          <div className="flex gap-1 mb-3 flex-wrap">
            {filterTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`text-xs px-3 py-1 rounded-lg font-bold transition-colors ${
                  activeFilter === tab
                    ? 'bg-slate-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {tab === '전체' ? '전체' : CATEGORY_META[tab]?.label}
              </button>
            ))}
          </div>

          <WordGrid
            wordData={wordData}
            selectedWordIds={selectedWordIds}
            activeFilter={activeFilter}
            selectedTags={selectedTags}
            onToggle={onToggle}
          />
        </div>

        {/* 시작 버튼 */}
        <button
          onClick={onStart}
          disabled={selectedWordIds.size === 0}
          className={`w-full font-bold py-4 rounded-2xl transition-all shadow-lg text-lg flex items-center justify-center gap-2 ${
            selectedWordIds.size > 0
              ? 'bg-violet-500 hover:bg-violet-600 active:scale-95 text-white shadow-violet-200'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          선택 카드로 시작 <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
