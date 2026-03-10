import { BrainCircuit, ChevronLeft, ChevronRight, Settings, BookOpen, ArrowRight } from 'lucide-react';
import { TOTAL_DAYS, getDayBasePool } from '../lib/curriculum';

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
  const total  = dayPool.length;
  const wCount = dayPool.filter((w) => w.type === 'word').length;
  const pCount = dayPool.filter((w) => w.type === 'pattern').length;
  const sCount = dayPool.filter((w) => w.type === 'sentence').length;

  // 구성 비율 (inline style — Tailwind 동적 클래스 불가)
  const wPct = total > 0 ? (wCount / total) * 100 : 0;
  const pPct = total > 0 ? (pCount / total) * 100 : 0;
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
        {pPct > 0 && <div className="bg-violet-400 h-full" style={{ width: `${pPct}%` }} />}
        {sPct > 0 && <div className="bg-emerald-400 h-full" style={{ width: `${sPct}%` }} />}
      </div>

      {/* 구성 수치 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-slate-600">
          <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0 inline-block" />
          단어 <b>{wCount}</b>
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-600">
          <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0 inline-block" />
          패턴 <b>{pCount}</b>
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-600">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 inline-block" />
          통문장 <b>{sCount}</b>
        </span>
        <span className="ml-auto text-[10px] font-semibold text-violet-500 whitespace-nowrap">
          +1 중요 패턴
        </span>
      </div>
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
}) {
  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center py-8 px-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-6 border-t-8 border-sky-400">

        {/* 헤더 */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <BrainCircuit className="w-8 h-8 text-sky-500" />
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">JFlash</h1>
        </div>
        <p className="text-slate-400 text-center text-xs mb-5">
          일본어 소리 반사 훈련 · 430장 · 43일 커리큘럼
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
