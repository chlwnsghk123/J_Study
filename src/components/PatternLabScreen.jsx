import { useState, useMemo } from 'react';
import { ArrowLeft, Sparkles, Loader2, Save, Trash2, CheckCircle2, Play, ChevronRight, X, RotateCcw } from 'lucide-react';
import { patterns } from '../data/patterns';
import { verbs } from '../data/verbs';
import { adjectives } from '../data/adjectives';
import { nouns } from '../data/nouns';
import { generatePatternSentences } from '../lib/gemini';

// ─── localStorage 유틸 ──────────────────────────────────────────────
const AI_SENTENCES_KEY = 'jflash_ai_sentences_v1';

function loadAISentences() {
  try { return JSON.parse(localStorage.getItem(AI_SENTENCES_KEY)) ?? []; }
  catch { return []; }
}

function saveAISentences(data) {
  try { localStorage.setItem(AI_SENTENCES_KEY, JSON.stringify(data)); } catch {}
}

function getNextAIId() {
  const existing = loadAISentences();
  if (existing.length === 0) return 10001;
  return Math.max(...existing.map((s) => s.id)) + 1;
}

// ─── 80/20 단어 자동 추출 ─────────────────────────────────────────
function pickWordsForPattern(pattern, count = 8) {
  const allWords = [...verbs, ...adjectives, ...nouns];
  const shuffled = [...allWords];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const struct = (pattern.structure ?? '').toLowerCase();
  let preferred = [];
  let rest = [];
  for (const w of shuffled) {
    const tag = w.tags?.[0] ?? '';
    if (struct.includes('동사') && tag === '#동사') preferred.push(w);
    else if (struct.includes('형용사') && tag === '#형용사') preferred.push(w);
    else if (struct.includes('명사') && tag === '#명사') preferred.push(w);
    else rest.push(w);
  }
  const pick80 = Math.ceil(count * 0.8);
  const selected = [...preferred.slice(0, pick80)];
  if (selected.length < pick80) selected.push(...rest.slice(0, pick80 - selected.length));
  return selected.slice(0, pick80);
}

// ─── 패턴 선택 카드 ─────────────────────────────────────────────────
function PatternCard({ pattern, selected, onSelect }) {
  const isSelected = selected?.id === pattern.id;
  return (
    <button
      onClick={() => onSelect(pattern)}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        isSelected
          ? 'border-violet-400 bg-violet-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${isSelected ? 'text-violet-700' : 'text-slate-700'}`}>
            {pattern.pron}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{pattern.meaning}</p>
        </div>
        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">
          {pattern.structure}
        </span>
      </div>
    </button>
  );
}

// ─── 생성 미리보기 카드 ─────────────────────────────────────────────
function PreviewCard({ sentence, index }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium border border-emerald-200">
          AI 생성
        </span>
      </div>
      <p className="text-base font-bold text-slate-800 mb-1">{sentence.pron}</p>
      <p className="text-sm text-slate-600 mb-2">{sentence.meaning}</p>
      <div className="flex flex-col gap-1">
        <p className="text-xs text-slate-400"><span className="font-medium text-slate-500">일본어:</span> {sentence.hiragana}</p>
        <p className="text-xs text-slate-400"><span className="font-medium text-slate-500">상황:</span> {sentence.example}</p>
        <p className="text-xs text-slate-400"><span className="font-medium text-slate-500">포인트:</span> {sentence.description}</p>
      </div>
    </div>
  );
}

// ─── 문장 아이템 (내 학습 - 개별 문장) ──────────────────────────────
function SentenceItem({ sentence, srsData, selected, onToggle, onDelete }) {
  const mc = srsData[sentence.id]?.masteryCount ?? 0;
  const isSelected = selected;
  return (
    <div className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
      isSelected ? 'border-violet-300 bg-violet-50' : 'border-slate-100 bg-white'
    }`}>
      {/* 체크박스 */}
      <button
        onClick={() => onToggle(sentence.id)}
        className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${
          isSelected
            ? 'bg-violet-500 border-violet-500 text-white'
            : 'border-slate-300 hover:border-violet-400'
        }`}
      >
        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
      </button>

      {/* 내용 */}
      <div className="flex-1 min-w-0" onClick={() => onToggle(sentence.id)}>
        <p className="text-sm font-medium text-slate-700 truncate">
          {sentence.pron?.replace(/\*\*/g, '')}
        </p>
        <p className="text-xs text-slate-400 truncate">{sentence.meaning}</p>
      </div>

      {/* 마스터리 표시 */}
      <div className="flex gap-0.5 shrink-0">
        {[0, 1].map((i) => (
          <span key={i} className={`w-2 h-2 rounded-full ${i < mc ? 'bg-emerald-400' : 'bg-slate-200'}`} />
        ))}
      </div>

      {/* 삭제 */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(sentence.id); }}
        className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
        title="삭제"
        aria-label="삭제"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── 패턴 그룹 헤더 (내 학습) ───────────────────────────────────────
function PatternGroupHeader({ pattern, count, masteredCount, isAllSelected, onToggleAll, onStudy, onDeleteAll }) {
  const patternLabel = pattern?.pron ?? '알 수 없는 패턴';
  return (
    <div className="bg-slate-50 rounded-xl p-3 mb-2">
      <div className="flex items-center gap-2 mb-2">
        {/* 전체 선택 */}
        <button
          onClick={onToggleAll}
          className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${
            isAllSelected
              ? 'bg-violet-500 border-violet-500 text-white'
              : 'border-slate-300 hover:border-violet-400'
          }`}
        >
          {isAllSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-700 truncate">{patternLabel}</p>
          <p className="text-[10px] text-slate-400">
            {pattern?.meaning} · {count}문장
            {masteredCount > 0 && <span className="text-emerald-500 ml-1">· {masteredCount}마스터</span>}
          </p>
        </div>

        {/* 액션 버튼 */}
        <button
          onClick={onStudy}
          title="이 패턴만 학습"
          aria-label="이 패턴만 학습"
          className="p-1.5 rounded-lg bg-violet-100 text-violet-600 hover:bg-violet-200 transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDeleteAll}
          title="이 패턴 전체 삭제"
          aria-label="이 패턴 전체 삭제"
          className="p-1.5 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-100 hover:text-rose-500 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── 메인 스크린 ───────────────────────────────────────────────────
export default function PatternLabScreen({ onBack, onStartStudy, srsData = {} }) {
  const [tab, setTab] = useState('generate');
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatedSentences, setGeneratedSentences] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 내 학습 상태
  const [savedSentences, setSavedSentences] = useState(() => loadAISentences());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'pattern'|'sentence'|'selected', id?, patternId? }
  const [editMode, setEditMode] = useState(false);

  // 패턴 검색
  const filteredPatterns = useMemo(() => {
    if (!searchTerm.trim()) return patterns;
    const q = searchTerm.trim().toLowerCase();
    return patterns.filter((p) =>
      p.pron.toLowerCase().includes(q) ||
      p.meaning.toLowerCase().includes(q) ||
      (p.structure ?? '').toLowerCase().includes(q)
    );
  }, [searchTerm]);

  // 패턴별 그룹
  const groupedByPattern = useMemo(() => {
    const groups = {};
    for (const s of savedSentences) {
      const pid = s.patternId ?? 0;
      if (!groups[pid]) groups[pid] = [];
      groups[pid].push(s);
    }
    return groups;
  }, [savedSentences]);

  const totalSavedCount = savedSentences.length;

  // ── 선택 관리 ──────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === savedSentences.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(savedSentences.map((s) => s.id)));
    }
  };

  const togglePatternAll = (patternId) => {
    const ids = (groupedByPattern[patternId] ?? []).map((s) => s.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  // ── AI 예문 생성 ──────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedPattern) return;
    setGenerating(true);
    setError('');
    setGeneratedSentences([]);
    setSaved(false);
    try {
      const words = pickWordsForPattern(selectedPattern, 8);
      const sentences = await generatePatternSentences(selectedPattern, words, 5);
      setGeneratedSentences(sentences);
    } catch (err) {
      console.error('AI 생성 오류:', err);
      setError(err.message?.includes('JSON')
        ? 'AI 응답 형식 오류 — 다시 시도해주세요.'
        : 'AI 예문 생성에 실패했습니다. 네트워크를 확인하거나 다시 시도해주세요.');
    } finally {
      setGenerating(false);
    }
  };

  // ── 저장 ──────────────────────────────────────────────
  const handleSave = () => {
    if (generatedSentences.length === 0 || !selectedPattern) return;
    let nextId = getNextAIId();
    const existing = loadAISentences();
    const newEntries = generatedSentences.map((s) => ({
      id: nextId++,
      type: 'sentence',
      priority: 2,
      tags: ['#통문장', '#AI생성', `#${selectedPattern.tags?.[1] ?? '패턴연습'}`],
      politeness: selectedPattern.politeness ?? '정중체',
      pron: s.pron,
      meaning: s.meaning,
      hiragana: s.hiragana,
      example: s.example,
      description: `[AI 패턴 랩] ${selectedPattern.pron} 패턴 활용. ${s.description}`,
      patternId: selectedPattern.id,
    }));
    const updated = [...existing, ...newEntries];
    saveAISentences(updated);
    setSavedSentences(updated);
    setSaved(true);
  };

  // ── 삭제 처리 ─────────────────────────────────────────
  const executeDelete = () => {
    if (!deleteConfirm) return;
    let updated;
    if (deleteConfirm.type === 'sentence') {
      updated = savedSentences.filter((s) => s.id !== deleteConfirm.id);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(deleteConfirm.id); return n; });
    } else if (deleteConfirm.type === 'pattern') {
      updated = savedSentences.filter((s) => s.patternId !== deleteConfirm.patternId);
      const removedIds = new Set((groupedByPattern[deleteConfirm.patternId] ?? []).map((s) => s.id));
      setSelectedIds((prev) => { const n = new Set(prev); removedIds.forEach((id) => n.delete(id)); return n; });
    } else if (deleteConfirm.type === 'selected') {
      updated = savedSentences.filter((s) => !selectedIds.has(s.id));
      setSelectedIds(new Set());
    } else if (deleteConfirm.type === 'all') {
      updated = [];
      setSelectedIds(new Set());
    }
    saveAISentences(updated);
    setSavedSentences(updated);
    setDeleteConfirm(null);
    if (updated.length === 0) setEditMode(false);
  };

  const getDeleteMessage = () => {
    if (!deleteConfirm) return '';
    if (deleteConfirm.type === 'sentence') return '이 문장 1개를 삭제합니다.';
    if (deleteConfirm.type === 'pattern') {
      const count = (groupedByPattern[deleteConfirm.patternId] ?? []).length;
      return `이 패턴의 문장 ${count}개를 모두 삭제합니다.`;
    }
    if (deleteConfirm.type === 'selected') return `선택한 ${selectedIds.size}개 문장을 삭제합니다.`;
    if (deleteConfirm.type === 'all') return `저장된 문장 ${totalSavedCount}개를 모두 삭제합니다.`;
    return '';
  };

  // ── 학습 시작 ─────────────────────────────────────────
  const handleStudyAll = () => {
    if (savedSentences.length === 0) return;
    onStartStudy(savedSentences);
  };

  const handleStudySelected = () => {
    const pool = savedSentences.filter((s) => selectedIds.has(s.id));
    if (pool.length === 0) return;
    onStartStudy(pool);
  };

  const handleStudyPattern = (patternId) => {
    const pool = groupedByPattern[patternId] ?? [];
    if (pool.length === 0) return;
    onStartStudy(pool);
  };

  const handleStudyUnmastered = () => {
    const pool = savedSentences.filter((s) => (srsData[s.id]?.masteryCount ?? 0) < 2);
    if (pool.length === 0) return;
    onStartStudy(pool);
  };

  const handleReset = () => {
    setGeneratedSentences([]);
    setError('');
    setSaved(false);
  };

  const unmasteredCount = savedSentences.filter((s) => (srsData[s.id]?.masteryCount ?? 0) < 2).length;

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center py-8 px-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-6 border-t-8 border-violet-400">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-1">
          <button onClick={onBack} aria-label="뒤로 가기" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-500" />
            <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">AI 패턴 랩</h1>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-4 ml-10">패턴 기반 AI 예문 생성 · 전용 학습</p>

        {/* ─── 탭 ─────────────────────────────────────── */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
          <button
            onClick={() => setTab('generate')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'generate' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            예문 생성
          </button>
          <button
            onClick={() => setTab('study')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all relative ${
              tab === 'study' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            내 학습
            {totalSavedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center">
                {totalSavedCount}
              </span>
            )}
          </button>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* TAB 1: 예문 생성 */}
        {/* ═══════════════════════════════════════════════ */}
        {tab === 'generate' && (
          <>
            {generatedSentences.length === 0 && !generating && (
              <>
                <input
                  type="text"
                  placeholder="패턴 검색 (발음, 뜻, 구조)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300 mb-3"
                />
                <div className="space-y-2 max-h-[340px] overflow-y-auto mb-4 pr-1">
                  {filteredPatterns.map((p) => (
                    <PatternCard key={p.id} pattern={p} selected={selectedPattern} onSelect={setSelectedPattern} />
                  ))}
                  {filteredPatterns.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-6">검색 결과가 없습니다</p>
                  )}
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!selectedPattern}
                  className={`w-full font-bold py-4 rounded-2xl transition-all shadow-lg text-base flex items-center justify-center gap-2 ${
                    selectedPattern ? 'bg-violet-500 hover:bg-violet-600 active:scale-95 text-white shadow-violet-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  AI 예문 자동 생성
                </button>
                {error && <p className="text-sm text-rose-500 text-center mt-3 font-medium">{error}</p>}
              </>
            )}

            {generating && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700">AI가 예문을 생성하고 있습니다</p>
                  <p className="text-xs text-slate-400 mt-1">패턴: {selectedPattern?.pron} · 80% 기존 단어 활용</p>
                </div>
              </div>
            )}

            {generatedSentences.length > 0 && !generating && (
              <>
                <div className="bg-violet-50 rounded-xl border border-violet-200 p-3 mb-4">
                  <p className="text-xs font-medium text-violet-500 mb-1">선택 패턴</p>
                  <p className="text-sm font-bold text-violet-700">{selectedPattern?.pron}</p>
                  <p className="text-xs text-violet-500">{selectedPattern?.meaning} · {selectedPattern?.structure}</p>
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">생성된 예문 ({generatedSentences.length}개)</p>
                <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4 pr-1">
                  {generatedSentences.map((s, i) => <PreviewCard key={i} sentence={s} index={i} />)}
                </div>
                {saved ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      저장 완료! '내 학습' 탭에서 학습하세요
                    </div>
                    <button onClick={handleReset} className="w-full py-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                      다른 패턴으로 생성하기
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={handleReset} className="flex-1 py-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                      <RotateCcw className="w-4 h-4" />
                      다시 생성
                    </button>
                    <button onClick={handleSave} className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-200">
                      <Save className="w-4 h-4" />
                      저장
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* TAB 2: 내 학습 */}
        {/* ═══════════════════════════════════════════════ */}
        {tab === 'study' && (
          <>
            {totalSavedCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Sparkles className="w-10 h-10 text-slate-300" />
                <p className="text-sm text-slate-400 font-medium">저장된 AI 예문이 없습니다</p>
                <p className="text-xs text-slate-300">'예문 생성' 탭에서 패턴을 선택하고 생성해 보세요</p>
              </div>
            ) : (
              <>
                {/* ── 학습 시작 버튼 그룹 ─────────────────── */}
                <div className="space-y-2 mb-4">
                  {/* 전체 학습 */}
                  <button
                    onClick={handleStudyAll}
                    className="w-full font-bold py-3.5 rounded-2xl transition-all shadow-md text-sm flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-600 active:scale-95 text-white shadow-violet-200"
                  >
                    <Play className="w-4 h-4" />
                    전체 학습 ({totalSavedCount}문장)
                  </button>

                  <div className="flex gap-2">
                    {/* 모르는 것만 */}
                    <button
                      onClick={handleStudyUnmastered}
                      disabled={unmasteredCount === 0}
                      className={`flex-1 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        unmasteredCount > 0
                          ? 'bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100'
                          : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5" />
                      모르는 것만 ({unmasteredCount})
                    </button>

                    {/* 선택 학습 */}
                    <button
                      onClick={handleStudySelected}
                      disabled={selectedIds.size === 0}
                      className={`flex-1 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        selectedIds.size > 0
                          ? 'bg-sky-50 border border-sky-200 text-sky-600 hover:bg-sky-100'
                          : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      선택 학습 ({selectedIds.size})
                    </button>
                  </div>
                </div>

                {/* ── 도구 바 ─────────────────────────────── */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSelectAll}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        selectedIds.size === totalSavedCount
                          ? 'bg-violet-100 text-violet-600'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {selectedIds.size === totalSavedCount ? '전체 해제' : '전체 선택'}
                    </button>
                    <span className="text-[10px] text-slate-400">
                      {Object.keys(groupedByPattern).length}패턴 · {totalSavedCount}문장
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* 편집 모드 토글 */}
                    <button
                      onClick={() => setEditMode(!editMode)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        editMode ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {editMode ? '편집 완료' : '편집'}
                    </button>
                  </div>
                </div>

                {/* ── 편집 모드 액션 바 ────────────────────── */}
                {editMode && (
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => selectedIds.size > 0 && setDeleteConfirm({ type: 'selected' })}
                      disabled={selectedIds.size === 0}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        selectedIds.size > 0
                          ? 'bg-rose-50 border border-rose-200 text-rose-500 hover:bg-rose-100'
                          : 'bg-slate-50 border border-slate-100 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      선택 삭제 ({selectedIds.size})
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'all' })}
                      className="py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      전체 삭제
                    </button>
                  </div>
                )}

                {/* ── 패턴별 문장 목록 ─────────────────────── */}
                <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                  {Object.entries(groupedByPattern).map(([pid, sents]) => {
                    const patternId = Number(pid);
                    const pattern = patterns.find((p) => p.id === patternId);
                    const masteredCount = sents.filter((s) => (srsData[s.id]?.masteryCount ?? 0) >= 2).length;
                    const allPatternSelected = sents.every((s) => selectedIds.has(s.id));

                    return (
                      <div key={pid}>
                        <PatternGroupHeader
                          pattern={pattern}
                          count={sents.length}
                          masteredCount={masteredCount}
                          isAllSelected={allPatternSelected}
                          onToggleAll={() => togglePatternAll(patternId)}
                          onStudy={() => handleStudyPattern(patternId)}
                          onDeleteAll={() => setDeleteConfirm({ type: 'pattern', patternId })}
                        />
                        <div className="space-y-1.5 pl-1">
                          {sents.map((s) => (
                            <SentenceItem
                              key={s.id}
                              sentence={s}
                              srsData={srsData}
                              selected={selectedIds.has(s.id)}
                              onToggle={toggleSelect}
                              onDelete={editMode ? (id) => setDeleteConfirm({ type: 'sentence', id }) : () => {}}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── 삭제 확인 다이얼로그 ─────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-slate-800 mb-2">삭제 확인</h3>
            <p className="text-sm text-slate-500 mb-5">{getDeleteMessage()} 되돌릴 수 없습니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
              >
                취소
              </button>
              <button
                onClick={executeDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
