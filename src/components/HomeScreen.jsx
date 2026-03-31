import { useState } from 'react';
import { BrainCircuit, ChevronLeft, ChevronRight, Settings, BookOpen, ArrowRight, Trash2, FileText, X, Sparkles } from 'lucide-react';
import { TOTAL_DAYS, getDayBasePool } from '../lib/curriculum';
import updatesRaw from '../../updates.md?raw';

// ─── 토글 스위치 ─────────────────────────────────────────────────
function ToggleSwitch({ label, desc, checked, onChange, colorOn }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex flex-col items-center py-2.5 px-2 rounded-xl border-2 transition-all
        ${checked
          ? `${colorOn} text-white border-transparent`
          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
        }`}
    >
      <span className="text-xs font-bold">{label}</span>
      <span className={`text-[10px] mt-0.5 ${checked ? 'opacity-80' : 'text-slate-400'}`}>{desc}</span>
    </button>
  );
}

// ─── 세션 설정 패널 ──────────────────────────────────────────────
function SettingsPanel({ settings, onSettingsChange }) {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 mb-4">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
        <Settings className="w-3 h-3" /> 세션 설정
      </p>
      <div className="grid grid-cols-3 gap-2">
        <ToggleSwitch label="리버스"   desc="뜻→발음"  checked={settings.reverseMode}  onChange={(v) => onSettingsChange({ reverseMode:  v })} colorOn="bg-blue-500"   />
        <ToggleSwitch label="하드코어" desc="3초 제한" checked={settings.hardcoreMode} onChange={(v) => onSettingsChange({ hardcoreMode: v })} colorOn="bg-red-500"    />
        <ToggleSwitch label="블라인드" desc="소리만"   checked={settings.blindMode}    onChange={(v) => onSettingsChange({ blindMode:    v })} colorOn="bg-purple-500" />
      </div>
    </div>
  );
}

// ─── Day 선택기 ──────────────────────────────────────────────────
function DaySelector({ currentDay, onDayChange, dayPool }) {
  // 패턴 제외 — 단어 + 통문장만
  const filtered = dayPool.filter((w) => w.type !== 'pattern');
  const total  = filtered.length;
  const wCount = filtered.filter((w) => w.type === 'word').length;
  const sCount = filtered.filter((w) => w.type === 'sentence').length;

  // 구성 비율 (inline style — Tailwind 동적 클래스 불가)
  const wPct = total > 0 ? (wCount / total) * 100 : 0;
  const sPct = total > 0 ? (sCount / total) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 shadow-sm">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
        <BookOpen className="w-3 h-3" /> 학습 Day 선택
      </p>

      {/* prev / select / next */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => onDayChange(currentDay - 1)}
          disabled={currentDay <= 1}
          aria-label="이전 Day"
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <select
          value={currentDay}
          onChange={(e) => onDayChange(Number(e.target.value))}
          className="flex-1 text-center font-bold text-sm py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-300 cursor-pointer"
        >
          {Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1).map((day) => {
            const size = getDayBasePool(day).length;
            return (
              <option key={day} value={day}>
                Day {day} · {size}장
              </option>
            );
          })}
        </select>

        <button
          onClick={() => onDayChange(currentDay + 1)}
          disabled={currentDay >= TOTAL_DAYS}
          aria-label="다음 Day"
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day 진행 바 (전체 43일 중 현재) */}
      <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 mb-3">
        <div
          className="bg-sky-400 h-full rounded-full transition-all duration-300"
          style={{ width: `${(currentDay / TOTAL_DAYS) * 100}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-400 text-right mb-3">{currentDay} / {TOTAL_DAYS}일</p>

      {/* 구성 비율 바 */}
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 mb-2">
        {wPct > 0 && <div className="bg-sky-400 h-full" style={{ width: `${wPct}%` }} />}
        {sPct > 0 && <div className="bg-emerald-400 h-full" style={{ width: `${sPct}%` }} />}
      </div>

      {/* 구성 수치 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-slate-600">
          <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0 inline-block" />
          단어 <b>{wCount}</b>
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-600">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 inline-block" />
          통문장 <b>{sCount}</b>
        </span>
      </div>
    </div>
  );
}

// ─── 업데이트 내역 모달 ───────────────────────────────────────────
function UpdatesModal({ onClose }) {
  // 간단한 마크다운 → JSX 변환 (# 헤딩 + - 리스트)
  const lines = updatesRaw.split('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">업데이트 내역</h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 내용 */}
        <div className="overflow-y-auto px-5 py-4 space-y-1">
          {lines.map((line, i) => {
            if (line.startsWith('# ')) return null; // 최상위 제목 숨김
            if (line.startsWith('## ')) {
              return (
                <h4 key={i} className="text-sm font-bold text-slate-700 pt-3 pb-1">
                  {line.replace('## ', '')}
                </h4>
              );
            }
            if (line.startsWith('- ')) {
              return (
                <p key={i} className="text-sm text-slate-600 pl-2">
                  • {line.replace('- ', '')}
                </p>
              );
            }
            if (line.trim() === '') return null;
            return <p key={i} className="text-sm text-slate-600">{line}</p>;
          })}
        </div>
      </div>
    </div>
  );
}

// ─── 관리 설정 메뉴 ──────────────────────────────────────────────
function ManageMenu({ onResetAll }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);

  const handleReset = () => {
    onResetAll();
    setShowConfirm(false);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        title="관리 설정"
        aria-label="관리 설정"
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Settings className="w-4 h-4" />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-8 z-40 bg-white rounded-xl shadow-lg border border-slate-200 py-2 min-w-[160px]">
            <button
              onClick={() => { setShowMenu(false); setShowUpdates(true); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              업데이트 내역
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowConfirm(true); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-rose-500 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              전체 초기화
            </button>
          </div>
        </>
      )}

      {showUpdates && <UpdatesModal onClose={() => setShowUpdates(false)} />}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-slate-800 mb-2">전체 초기화</h3>
            <p className="text-sm text-slate-500 mb-5">
              모든 학습 기록(SRS 데이터, 설정, 진행 상황)이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm transition-colors"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 홈 화면 ────────────────────────────────────────────────
export default function HomeScreen({
  currentDay,
  onDayChange,
  dayPool,
  settings,
  onSettingsChange,
  onStart,
  onShowBrowse,
  onShowPatternLab,
  onResetAll,
}) {
  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center py-8 px-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-6 border-t-8 border-sky-400">

        {/* 헤더 */}
        <div className="flex items-center justify-center gap-2 mb-1 relative">
          <BrainCircuit className="w-8 h-8 text-sky-500" />
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">JFlash</h1>
          <div className="absolute right-0 top-0">
            <ManageMenu onResetAll={onResetAll} />
          </div>
        </div>
        <p className="text-slate-400 text-center text-xs mb-5">
          일본어 소리 반사 훈련 · 430장 · 19일 커리큘럼
        </p>

        {/* Day 선택기 */}
        <DaySelector
          currentDay={currentDay}
          onDayChange={onDayChange}
          dayPool={dayPool}
        />

        {/* 세션 설정 */}
        <SettingsPanel settings={settings} onSettingsChange={onSettingsChange} />

        {/* Day N 시작 버튼 */}
        <button
          onClick={onStart}
          className="w-full font-bold py-4 rounded-2xl transition-all shadow-lg text-lg flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white shadow-sky-200 mb-3"
        >
          Day {currentDay} 시작
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* AI 패턴 랩 */}
        <button
          onClick={onShowPatternLab}
          className="w-full py-3 rounded-2xl border-2 border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-600 text-sm font-semibold flex items-center justify-center gap-2 transition-colors mb-3"
        >
          <Sparkles className="w-4 h-4" />
          패턴 학습하기
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* 전체 단어 보기 (보조) */}
        <button
          onClick={onShowBrowse}
          className="w-full py-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          전체 단어 보기
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
