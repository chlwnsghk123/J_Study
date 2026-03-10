import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Star, Clock, XCircle } from 'lucide-react';
import { wordData } from './data';
import { prefetch } from './lib/googleTTS';
import { TOTAL_DAYS, getDayBasePool } from './lib/curriculum';
import HomeScreen        from './components/HomeScreen';
import BrowseScreen      from './components/BrowseScreen';
import WordCard          from './components/WordCard';
import ProgressBar       from './components/ProgressBar';
import CompletionScreen  from './components/CompletionScreen';

// ─── localStorage 유틸 ───────────────────────────────────────────
const LS = {
  SETTINGS:   'jflash_settings_v2',
  SRS:        'jflash_srs_v2',
  CURRICULUM: 'jflash_curriculum_v1', // { currentDay: number }
};

function loadLS(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; }
  catch { return def; }
}

function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const DEFAULT_SETTINGS = {
  reverseMode:  false,
  blindMode:    false,
  hardcoreMode: false,
  maxCards:     30,
};

// ─── Fisher-Yates 셔플 ───────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── SRS 유틸 ────────────────────────────────────────────────────
const SRS_INTERVALS = [1, 3, 7];

function getSRSNextDate(masteryCount) {
  const days = SRS_INTERVALS[Math.min(masteryCount, SRS_INTERVALS.length - 1)];
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isDueToday(wordId, srsData) {
  const rec = srsData[wordId];
  if (!rec) return true;
  const today = new Date().toISOString().slice(0, 10);
  return rec.nextReview <= today;
}

// ─── 동적 슬롯 치환 ──────────────────────────────────────────────
function fillSlots(word, masteredWords) {
  if (!word.pron?.includes('[') && !word.hiragana?.includes('[')) return word;

  const pickRandom = (arr) => arr.length
    ? arr[Math.floor(Math.random() * arr.length)]
    : null;

  const verbs = masteredWords.filter((w) => w.tags?.[0] === '#동사');
  const adjs  = masteredWords.filter((w) => w.tags?.[0] === '#형용사');

  let pron     = word.pron ?? '';
  let hiragana = word.hiragana ?? '';
  const v   = pickRandom(verbs);
  const a   = pickRandom(adjs);
  const any = pickRandom(masteredWords);

  if (v)   { pron = pron.replace(/\[VERB\]/g, v.pron);   hiragana = hiragana.replace(/\[VERB\]/g, v.hiragana); }
  if (a)   { pron = pron.replace(/\[ADJ\]/g,  a.pron);   hiragana = hiragana.replace(/\[ADJ\]/g,  a.hiragana); }
  if (any) { pron = pron.replace(/\[WORD\]/g, any.pron); hiragana = hiragana.replace(/\[WORD\]/g, any.hiragana); }

  return { ...word, pron, hiragana };
}

// ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── 영구 상태 (localStorage) ────────────────────────────────
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...loadLS(LS.SETTINGS, {}),
  }));
  const [srsData, setSrsData] = useState(() => loadLS(LS.SRS, {}));
  const [currentDay, setCurrentDay] = useState(
    () => loadLS(LS.CURRICULUM, { currentDay: 1 }).currentDay ?? 1
  );

  const updateSettings = (patch) => {
    setSettings((s) => { const n = { ...s, ...patch }; saveLS(LS.SETTINGS, n); return n; });
  };

  const updateCurrentDay = (day) => {
    const d = Math.max(1, Math.min(TOTAL_DAYS, day));
    setCurrentDay(d);
    saveLS(LS.CURRICULUM, { currentDay: d });
    setSelectedWordIds(new Set(getDayBasePool(d).map((w) => w.id)));
  };

  // ── 화면 상태 ─────────────────────────────────────────────
  const [appScreen, setAppScreen] = useState('home'); // 'home' | 'browse'

  // ── 선택 상태 ───────────────────────────────────────────────
  const [selectedWordIds, setSelectedWordIds] = useState(() => {
    const day = loadLS(LS.CURRICULUM, { currentDay: 1 }).currentDay ?? 1;
    return new Set(getDayBasePool(day).map((w) => w.id));
  });
  const [selectedTags, setSelectedTags] = useState([]);

  // ── 게임 상태 ─────────────────────────────────────────────
  const [queue, setQueue]                       = useState([]);
  const [mastered, setMastered]                 = useState([]);
  const [inSessionCorrect, setInSessionCorrect] = useState({});
  const [failCount, setFailCount]               = useState({});
  const [showAnswer, setShowAnswer]             = useState(false);
  const [gameStarted, setGameStarted]           = useState(false);
  const [animateCard, setAnimateCard]           = useState(false);
  const [totalActive, setTotalActive]           = useState(0);

  // ── 하드코어 타이머 ─────────────────────────────────────────
  const [hcTimeLeft, setHcTimeLeft] = useState(null);
  const hcRef            = useRef(null);
  const handleActionRef  = useRef(null);

  // ── 선택 핸들러 (BrowseScreen 전용) ──────────────────────────
  const toggleWord = (id) => {
    setSelectedWordIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll   = () => setSelectedWordIds(new Set(wordData.map((w) => w.id)));
  const deselectAll = () => setSelectedWordIds(new Set());

  const toggleCategory = (type) => {
    const items = wordData.filter((w) => w.type === type);
    setSelectedWordIds((prev) => {
      const allSelected = items.every((w) => prev.has(w.id));
      const next = new Set(prev);
      items.forEach((w) => (allSelected ? next.delete(w.id) : next.add(w.id)));
      return next;
    });
  };

  const selectRandom = (count) => {
    const shuffled = shuffle(wordData);
    setSelectedWordIds(new Set(shuffled.slice(0, count).map((w) => w.id)));
  };

  const toggleTag = (tag) => setSelectedTags((p) =>
    p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]
  );
  const clearTags = () => setSelectedTags([]);

  // ── 큐 빌드 (pool → SRS → maxCards → priority 정렬) ────────
  const buildQueue = (pool) => {
    let active = [...pool];

    // 1. SRS 필터: 오늘 복습 예정만 (기록 충분 시)
    const hasSRS = Object.keys(srsData).length >= 5;
    if (hasSRS) {
      const due = active.filter((w) => isDueToday(w.id, srsData));
      if (due.length >= 3) active = due;
    }

    // 2. 최대 카드 수 제한 (priority 낮은 순으로 자름)
    if (active.length > settings.maxCards) {
      active = [...active]
        .sort((a, b) => a.priority - b.priority)
        .slice(0, settings.maxCards);
    }

    setTotalActive(active.length);

    // 3. priority별 그룹 + 반의어 쌍 묶기
    const poolIds    = new Set(pool.map((w) => w.id));
    const byPriority = { 1: [], 2: [], 3: [] };
    const seen       = new Set();

    active.forEach((word) => {
      if (seen.has(word.id)) return;

      let group;
      if (word.type === 'word' && word.antonymId && poolIds.has(word.antonymId)) {
        const antonym = active.find((w) => w.id === word.antonymId);
        if (antonym && !seen.has(antonym.id)) {
          group = Math.random() > 0.5 ? [word, antonym] : [antonym, word];
          seen.add(word.id);
          seen.add(antonym.id);
        } else {
          group = [word]; seen.add(word.id);
        }
      } else {
        group = [word]; seen.add(word.id);
      }

      const p = Math.min(3, Math.max(1, word.priority ?? 2));
      byPriority[p].push(group);
    });

    // 4. Fisher-Yates 셔플 (priority 순서 유지, 타입 믹싱)
    return [
      ...shuffle(byPriority[1]),
      ...shuffle(byPriority[2]),
      ...shuffle(byPriority[3]),
    ].flat();
  };

  // ── 공통 게임 세팅 ────────────────────────────────────────
  const _launchGame = (pool) => {
    const poolIds = new Set(pool.map((w) => w.id));
    setSelectedWordIds(poolIds);

    const q = buildQueue(pool);
    if (q.length === 0) return;

    setQueue(q);
    setMastered([]);
    setInSessionCorrect({});
    setFailCount({});
    setShowAnswer(false);
    setGameStarted(true);
    clearInterval(hcRef.current);
    setHcTimeLeft(null);
  };

  // ── 게임 시작 — HomeScreen (Day 풀 + 중요 패턴 1개) ─────────
  const startGameByDay = () => {
    const basePool    = getDayBasePool(currentDay);
    const allPatterns = wordData.filter((w) => w.type === 'pattern');
    let pool = [...basePool];

    if (allPatterns.length > 0) {
      const rp = allPatterns[Math.floor(Math.random() * allPatterns.length)];
      if (!pool.find((w) => w.id === rp.id)) pool.push(rp);
    }

    _launchGame(pool);
  };

  // ── 게임 시작 — BrowseScreen (selectedWordIds 직접 사용) ──────
  const startGameBySelection = () => {
    const pool = wordData.filter((w) => selectedWordIds.has(w.id));
    if (pool.length === 0) return;
    _launchGame(pool);
  };

  // ── 하드코어 타이머 ──────────────────────────────────────────
  const startHCTimer = () => {
    clearInterval(hcRef.current);
    setHcTimeLeft(3);
    let remaining = 3;
    hcRef.current = setInterval(() => {
      remaining -= 1;
      setHcTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(hcRef.current);
        setHcTimeLeft(null);
        handleActionRef.current?.('dontKnow');
      }
    }, 1000);
  };

  useEffect(() => {
    if (!gameStarted || !settings.hardcoreMode || showAnswer || queue.length === 0) {
      clearInterval(hcRef.current);
      if (!showAnswer) setHcTimeLeft(null);
      return;
    }
    startHCTimer();
    return () => clearInterval(hcRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue[0]?.id, showAnswer, gameStarted, settings.hardcoreMode]);

  // ── 프리패치 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!gameStarted || queue.length === 0) return;
    const nextTexts = queue.slice(1, 6).map((w) => w.hiragana).filter(Boolean);
    prefetch(nextTexts);
  }, [queue[0]?.id, gameStarted]);

  // ── 카드 클릭 ────────────────────────────────────────────────
  const handleCardClick = () => {
    if (!showAnswer) {
      clearInterval(hcRef.current);
      setHcTimeLeft(null);
      setShowAnswer(true);
    } else {
      handleAction('dontKnow');
    }
  };

  // ── 액션 처리 ─────────────────────────────────────────────────
  const handleAction = (actionType) => {
    if (queue.length === 0) return;
    clearInterval(hcRef.current);
    setHcTimeLeft(null);
    setAnimateCard(true);

    setTimeout(() => {
      const current   = queue[0];
      let newQueue    = queue.slice(1);
      let newMastered = [...mastered];

      if (actionType === 'know') {
        const prevCorrect = inSessionCorrect[current.id] ?? 0;
        const newCorrect  = prevCorrect + 1;

        if (newCorrect >= 2) {
          // 마스터 확정 — SRS 업데이트
          setSrsData((prev) => {
            const rec = prev[current.id] ?? { masteryCount: 0 };
            const next = {
              masteryCount: rec.masteryCount + 1,
              nextReview:   getSRSNextDate(rec.masteryCount + 1),
            };
            const updated = { ...prev, [current.id]: next };
            saveLS(LS.SRS, updated);
            return updated;
          });
          newMastered.push(current);
          setInSessionCorrect((p) => { const n = { ...p }; delete n[current.id]; return n; });
          setFailCount((p)        => { const n = { ...p }; delete n[current.id]; return n; });
        } else {
          // 1회 정답 — +10~+15번째에 재삽입
          setInSessionCorrect((p) => ({ ...p, [current.id]: newCorrect }));
          const insertAt = Math.min(Math.floor(Math.random() * 6) + 10, newQueue.length);
          newQueue = [...newQueue.slice(0, insertAt), current, ...newQueue.slice(insertAt)];
        }
      } else {
        // 오답 처리
        setSrsData((prev) => {
          const rec = prev[current.id] ?? { masteryCount: 0 };
          const updated = {
            ...prev,
            [current.id]: { masteryCount: rec.masteryCount, nextReview: getSRSNextDate(0) },
          };
          saveLS(LS.SRS, updated);
          return updated;
        });

        const currentFail = (failCount[current.id] ?? 0) + 1;
        setFailCount((p)        => ({ ...p, [current.id]: currentFail }));
        setInSessionCorrect((p) => { const n = { ...p }; delete n[current.id]; return n; });

        // 반의어 함께 재삽입
        let antonym = null;
        if (current.type === 'word' && current.antonymId && selectedWordIds.has(current.antonymId)) {
          const antId = current.antonymId;
          const mIdx  = newMastered.findIndex((w) => w.id === antId);
          if (mIdx !== -1) antonym = newMastered.splice(mIdx, 1)[0];
          else {
            const qIdx = newQueue.findIndex((w) => w.id === antId);
            if (qIdx !== -1) antonym = newQueue.splice(qIdx, 1)[0];
          }
        }

        // 의존성 주입: 3회 이상 실패 → componentIds를 큐 5~10번째에 삽입
        // ※ Day 풀 필터링 이후, 동적으로 전체 wordData에서 탐색
        if (currentFail >= 3 && current.componentIds?.length > 0) {
          current.componentIds.forEach((cid) => {
            const comp = wordData.find((w) => w.id === cid);
            if (comp && !newQueue.find((w) => w.id === cid)) {
              const filled = fillSlots(comp, newMastered);
              const at = Math.min(Math.floor(Math.random() * 6) + 5, newQueue.length);
              newQueue = [...newQueue.slice(0, at), filled, ...newQueue.slice(at)];
            }
          });
        }

        // 현재 카드 재삽입 (+3~+5)
        const insertAt = Math.min(Math.floor(Math.random() * 3) + 3, newQueue.length);
        newQueue = [
          ...newQueue.slice(0, insertAt),
          current,
          ...(antonym ? [antonym] : []),
          ...newQueue.slice(insertAt),
        ];
      }

      // 슬롯 치환: 큐 첫 번째 카드에 적용
      const filledQueue = newQueue.length > 0
        ? [fillSlots(newQueue[0], newMastered), ...newQueue.slice(1)]
        : newQueue;

      setQueue(filledQueue);
      setMastered(newMastered);
      setShowAnswer(false);
      setAnimateCard(false);
    }, 250);
  };

  // ref 갱신 (stale closure 방지)
  handleActionRef.current = handleAction;

  // ── 화면 라우팅 ────────────────────────────────────────────────
  if (!gameStarted) {
    if (appScreen === 'browse') {
      return (
        <BrowseScreen
          wordData={wordData}
          selectedWordIds={selectedWordIds}
          onToggle={toggleWord}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onToggleCategory={toggleCategory}
          onSelectRandom={selectRandom}
          selectedTags={selectedTags}
          onTagToggle={toggleTag}
          onClearTags={clearTags}
          onStart={startGameBySelection}
          onBack={() => setAppScreen('home')}
        />
      );
    }

    return (
      <HomeScreen
        currentDay={currentDay}
        onDayChange={updateCurrentDay}
        dayPool={getDayBasePool(currentDay)}
        settings={settings}
        onSettingsChange={updateSettings}
        onStart={startGameByDay}
        onShowBrowse={() => setAppScreen('browse')}
      />
    );
  }

  if (queue.length === 0) {
    return (
      <CompletionScreen
        totalActiveWords={totalActive}
        onReset={() => setGameStarted(false)}
      />
    );
  }

  const currentWord      = queue[0];
  const isFirstConfirmed = (inSessionCorrect[currentWord.id] ?? 0) >= 1;

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center py-6 px-4 font-sans">
      <ProgressBar mastered={mastered.length} total={totalActive} />

      {/* 하드코어 타이머 표시 */}
      {settings.hardcoreMode && hcTimeLeft !== null && !showAnswer && (
        <div className={`mb-3 flex items-center gap-2 px-5 py-2 rounded-full font-black text-base shadow-sm ${
          hcTimeLeft <= 1
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-orange-100 text-orange-600'
        }`}>
          <Clock className="w-4 h-4" />
          {hcTimeLeft}초
        </div>
      )}

      <WordCard
        word={currentWord}
        showAnswer={showAnswer}
        animateCard={animateCard}
        selectedWordIds={selectedWordIds}
        onCardClick={handleCardClick}
        reverseMode={settings.reverseMode}
        blindMode={settings.blindMode}
        inSessionConfirmed={isFirstConfirmed}
      />

      {/* 버튼 영역 */}
      <div className="max-w-md w-full space-y-3">
        <button
          disabled={!showAnswer}
          onClick={() => handleAction('know')}
          className={`w-full flex items-center justify-center py-4 rounded-3xl transition-all shadow-md ${
            showAnswer
              ? isFirstConfirmed
                ? 'bg-yellow-400 text-white hover:bg-yellow-500 active:scale-95'
                : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95'
              : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
          }`}
        >
          {isFirstConfirmed ? (
            <><Star className="w-7 h-7 mr-2" /><span className="font-bold text-xl">확실히 안다 (마스터 확정)</span></>
          ) : (
            <><CheckCircle2 className="w-7 h-7 mr-2" /><span className="font-bold text-xl">안다 (1차 확인)</span></>
          )}
        </button>

        {showAnswer && (
          <button
            onClick={() => handleAction('dontKnow')}
            className="w-full flex items-center justify-center py-3 rounded-3xl bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 transition-all"
          >
            <XCircle className="w-5 h-5 mr-2" />
            <span className="font-semibold">모른다 (뒤로)</span>
          </button>
        )}
      </div>

      <p className="mt-4 text-sm font-medium text-slate-400">
        남은: <span className="text-slate-600 font-bold">{queue.length}</span>장
        &nbsp;·&nbsp;
        완료: <span className="text-emerald-600 font-bold">{mastered.length}</span>장
      </p>
    </div>
  );
}
