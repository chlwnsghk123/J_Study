import { useState, useMemo } from 'react';
import { ArrowLeft, Sparkles, Loader2, Save, Trash2, CheckCircle2, Play, ChevronDown, ChevronUp } from 'lucide-react';
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
  if (selected.length < pick80) {
    selected.push(...rest.slice(0, pick80 - selected.length));
  }
  return selected.slice(0, pick80);
}

// ─── 패턴 카드 (선택용) ─────────────────────────────────────────────
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

// ─── 생성된 문장 미리보기 카드 ──────────────────────────────────────
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
        <p className="text-xs text-slate-400">
          <span className="font-medium text-slate-500">일본어:</span> {sentence.hiragana}
        </p>
        <p className="text-xs text-slate-400">
          <span className="font-medium text-slate-500">상황:</span> {sentence.example}
        </p>
        <p className="text-xs text-slate-400">
          <span className="font-medium text-slate-500">포인트:</span> {sentence.description}
        </p>
      </div>
    </div>
  );
}

// ─── 저장된 패턴 그룹 카드 ──────────────────────────────────────────
function SavedPatternGroup({ patternId, sentences, srsData, onDelete, onStartStudy }) {
  const [expanded, setExpanded] = useState(false);
  const pattern = patterns.find((p) => p.id === patternId);
  const patternLabel = pattern?.pron ?? `패턴 #${patternId}`;
  const patternMeaning = pattern?.meaning ?? '';
  const patternStructure = pattern?.structure ?? '';

  const masteredCount = sentences.filter((s) => (srsData[s.id]?.masteryCount ?? 0) >= 2).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-bold text-slate-700 truncate">{patternLabel}</p>
          <p className="text-xs text-slate-400 mt-0.5">{patternMeaning} · {patternStructure}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
            {sentences.length}문장
          </span>
          {masteredCount > 0 && (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {masteredCount}마스터
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* 확장 영역 */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4">
          <div className="space-y-2 mt-3 max-h-[240px] overflow-y-auto">
            {sentences.map((s) => {
              const mc = srsData[s.id]?.masteryCount ?? 0;
              return (
                <div key={s.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50">
                  <div className="flex gap-0.5 mt-1 shrink-0">
                    {[0, 1].map((i) => (
                      <span key={i} className={`w-2 h-2 rounded-full ${i < mc ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{s.pron?.replace(/\*\*/g, '')}</p>
                    <p className="text-xs text-slate-400 truncate">{s.meaning}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onDelete(patternId)}
              className="flex-1 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              삭제
            </button>
            <button
              onClick={() => onStartStudy(sentences)}
              className="flex-1 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              학습 시작
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 스크린 ───────────────────────────────────────────────────
export default function PatternLabScreen({ onBack, onStartStudy, srsData = {} }) {
  const [tab, setTab] = useState('generate'); // 'generate' | 'study'
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatedSentences, setGeneratedSentences] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // 저장된 AI 문장 상태 (localStorage 동기화)
  const [savedSentences, setSavedSentences] = useState(() => loadAISentences());

  // 패턴 검색 필터
  const filteredPatterns = useMemo(() => {
    if (!searchTerm.trim()) return patterns;
    const q = searchTerm.trim().toLowerCase();
    return patterns.filter((p) =>
      p.pron.toLowerCase().includes(q) ||
      p.meaning.toLowerCase().includes(q) ||
      (p.structure ?? '').toLowerCase().includes(q)
    );
  }, [searchTerm]);

  // 저장된 문장을 patternId별 그룹화
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

  // AI 예문 생성
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
      setError(
        err.message?.includes('JSON')
          ? 'AI 응답 형식 오류 — 다시 시도해주세요.'
          : 'AI 예문 생성에 실패했습니다. 네트워크를 확인하거나 다시 시도해주세요.'
      );
    } finally {
      setGenerating(false);
    }
  };

  // 저장 확정
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

  // 패턴별 삭제
  const handleDeletePattern = (patternId) => {
    const updated = savedSentences.filter((s) => s.patternId !== patternId);
    saveAISentences(updated);
    setSavedSentences(updated);
    setDeleteConfirm(null);
  };

  // 전체 학습 (모든 저장된 문장)
  const handleStudyAll = () => {
    if (savedSentences.length === 0) return;
    onStartStudy(savedSentences);
  };

  // 패턴별 학습
  const handleStudyPattern = (sentences) => {
    if (sentences.length === 0) return;
    onStartStudy(sentences);
  };

  // 초기화 (새로 생성)
  const handleReset = () => {
    setGeneratedSentences([]);
    setError('');
    setSaved(false);
  };

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center py-8 px-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-6 border-t-8 border-violet-400">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={onBack}
            aria-label="뒤로 가기"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-500" />
            <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">AI 패턴 랩</h1>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-4 ml-10">
          패턴 기반 AI 예문 생성 · 전용 학습
        </p>

        {/* ─── 탭 ──────────────────────────────────────────── */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
          <button
            onClick={() => setTab('generate')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'generate'
                ? 'bg-white text-violet-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            예문 생성
          </button>
          <button
            onClick={() => setTab('study')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all relative ${
              tab === 'study'
                ? 'bg-white text-violet-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
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

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB 1: 예문 생성 */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === 'generate' && (
          <>
            {/* 패턴 선택 + 생성 */}
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
                    selectedPattern
                      ? 'bg-violet-500 hover:bg-violet-600 active:scale-95 text-white shadow-violet-200'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  AI 예문 자동 생성
                </button>

                {error && <p className="text-sm text-rose-500 text-center mt-3 font-medium">{error}</p>}
              </>
            )}

            {/* 로딩 */}
            {generating && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700">AI가 예문을 생성하고 있습니다</p>
                  <p className="text-xs text-slate-400 mt-1">
                    패턴: {selectedPattern?.pron} · 80% 기존 단어 활용
                  </p>
                </div>
              </div>
            )}

            {/* 미리보기 + 저장 */}
            {generatedSentences.length > 0 && !generating && (
              <>
                <div className="bg-violet-50 rounded-xl border border-violet-200 p-3 mb-4">
                  <p className="text-xs font-medium text-violet-500 mb-1">선택 패턴</p>
                  <p className="text-sm font-bold text-violet-700">{selectedPattern?.pron}</p>
                  <p className="text-xs text-violet-500">{selectedPattern?.meaning} · {selectedPattern?.structure}</p>
                </div>

                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  생성된 예문 ({generatedSentences.length}개)
                </p>
                <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4 pr-1">
                  {generatedSentences.map((s, i) => (
                    <PreviewCard key={i} sentence={s} index={i} />
                  ))}
                </div>

                {saved ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      저장 완료! '내 학습' 탭에서 학습할 수 있습니다
                    </div>
                    <button
                      onClick={handleReset}
                      className="w-full py-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      다른 패턴으로 생성하기
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={handleReset}
                      className="flex-1 py-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      다시 생성
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-200"
                    >
                      <Save className="w-4 h-4" />
                      저장
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB 2: 내 학습 */}
        {/* ═══════════════════════════════════════════════════ */}
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
                {/* 전체 학습 버튼 */}
                <button
                  onClick={handleStudyAll}
                  className="w-full font-bold py-4 rounded-2xl transition-all shadow-lg text-base flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-600 active:scale-95 text-white shadow-violet-200 mb-4"
                >
                  <Play className="w-5 h-5" />
                  전체 학습 ({totalSavedCount}문장)
                </button>

                {/* 패턴별 그룹 */}
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  저장된 패턴 ({Object.keys(groupedByPattern).length}개)
                </p>
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {Object.entries(groupedByPattern).map(([pid, sents]) => (
                    <SavedPatternGroup
                      key={pid}
                      patternId={Number(pid)}
                      sentences={sents}
                      srsData={srsData}
                      onDelete={(id) => setDeleteConfirm(id)}
                      onStartStudy={handleStudyPattern}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-slate-800 mb-2">패턴 삭제</h3>
            <p className="text-sm text-slate-500 mb-5">
              이 패턴의 모든 AI 생성 문장({groupedByPattern[deleteConfirm]?.length ?? 0}개)이 삭제됩니다. 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleDeletePattern(deleteConfirm)}
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
