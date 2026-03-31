import { useState, useEffect, useRef } from 'react';
import { Clock, X, Undo2 } from 'lucide-react';
import { wordData } from './data';
import { prefetch } from './lib/googleTTS';
import { TOTAL_DAYS, getDayBasePool } from './lib/curriculum';
import HomeScreen        from './components/HomeScreen';
import BrowseScreen      from './components/BrowseScreen';
import DayPreviewScreen  from './components/DayPreviewScreen';
import PatternLabScreen  from './components/PatternLabScreen';
import WordCard          from './components/WordCard';
import ProgressBar       from './components/ProgressBar';
import CompletionScreen  from './components/CompletionScreen';

// ─── localStorage 유틸 ───────────────────────────────────────────
const LS = {
  SETTINGS:   'jflash_settings_v2',
  SRS:        'jflash_srs_v2',
  CURRICULUM: 'jflash_curriculum_v1',
  SESSION:    'jflash_session_v1',
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

// ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── 영구 상태 (localStorage) ────────────────────────────────
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...loadLS(LS.SETTINGS, {}),
  }));
  const [srsData, setSrsData] = useState(() => loadLS(LS.SRS, {}));
  const [currentDay, setCurrentDay] = useState(
    () => {
      const saved = loadLS(LS.CURRICULUM, { currentDay: 1 }).currentDay ?? 1;
      return Math.min(saved, TOTAL_DAYS);
    }
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
  const [appScreen, setAppScreen] = useState(() => {
    const session = loadLS(LS.SESSION, {});
    return session.appScreen ?? 'home';
  });

  // ── 선택 상태 ───────────────────────────────────────────────
  const [selectedWordIds, setSelectedWordIds] = useState(() => {
    const session = loadLS(LS.SESSION, {});
    if (session.selectedWordIds?.length > 0) return new Set(session.selectedWordIds);
    const day = loadLS(LS.CURRICULUM, { currentDay: 1 }).currentDay ?? 1;
    return new Set(getDayBasePool(day).map((w) => w.id));
  });
  const [selectedTags, setSelectedTags] = useState([]);

  // Day 미리보기 풀
  const [dayPreviewPool, setDayPreviewPool] = useState(() => {
    const session = loadLS(LS.SESSION, {});
    if (session.appScreen === 'day-preview' && session.dayPreviewPoolIds?.length > 0) {
      return wordData.filter((w) => session.dayPreviewPoolIds.includes(w.id));
    }
    return [];
  });

  // ── 세션 상태 자동 저장 ──────────────────────────────────
  useEffect(() => {
    saveLS(LS.SESSION, {
      appScreen,
      selectedWordIds: [...selectedWordIds],
      dayPreviewPoolIds: dayPreviewPool.map((w) => w.id),
    });
  }, [appScreen, selectedWordIds, dayPreviewPool]);

  // ── 안드로이드 뒤로가기 (History API) ──────────────────────
  const appScreenRef = useRef(appScreen);
  const gameStartedRef = useRef(false);
  const handleExitRef = useRef(null);
  appScreenRef.current = appScreen;

  useEffect(() => {
    // 초기 로드 시 홈이 아니면 history에 하나 추가 (뒤로가기 대비)
    if (appScreen !== 'home') {
      window.history.pushState({ jflash: true }, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 화면 전환 시 pushState (홈→다른 화면)
  const prevScreenRef = useRef(appScreen);
  useEffect(() => {
    if (prevScreenRef.current === 'home' && appScreen !== 'home') {
      window.history.pushState({ jflash: true }, '');
    }
    prevScreenRef.current = appScreen;
  }, [appScreen]);

  useEffect(() => {
    const handlePopState = () => {
      if (gameStartedRef.current) {
        handleExitRef.current?.();
      } else if (appScreenRef.current !== 'home') {
        setAppScreen('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ── 게임 상태 ─────────────────────────────────────────────
  const [queue, setQueue]         = useState([]);
  const [mastered, setMastered]   = useState([]);
  const [failCount, setFailCount] = useState({});
  const [showAnswer, setShowAnswer]   = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [totalActive, setTotalActive] = useState(0);
  const [passedCount, setPassedCount] = useState(0);

  // gameStartedRef 동기화
  useEffect(() => { gameStartedRef.current = gameStarted; }, [gameStarted]);

  // ── Toast ───────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState('');

  // ── AI 채팅 상태 ─────────────────────────────────────────────
  const [aiMessages, setAiMessages] = useState([]);

  // ── 이전 카드 되돌리기 스택 ────────────────────────────────
  const [historyStack, setHistoryStack] = useState([]);

  // ── 하드코어 타이머 ─────────────────────────────────────────
  const [hcTimeLeft, setHcTimeLeft] = useState(null);
  const hcRef           = useRef(null);
  const handleActionRef = useRef(null);

  // ── 시간 초과 시스템 refs ──────────────────────────────────
  const cardStartTimeRef = useRef(null);
  const overTimeRef      = useRef(false);
  const answerSeenRef    = useRef(false);

  // ── 전체 초기화 ─────────────────────────────────────────────
  const handleResetAll = () => {
    Object.values(LS).forEach((key) => { try { localStorage.removeItem(key); } catch {} });
    try { localStorage.removeItem('jflash_ai_sentences_v1'); } catch {}
    try { localStorage.removeItem('jflash_study_time_v1'); } catch {}
    setSettings({ ...DEFAULT_SETTINGS });
    setSrsData({});
    setCurrentDay(1);
    setSelectedWordIds(new Set(getDayBasePool(1).map((w) => w.id)));
    setAppScreen('home');
    setDayPreviewPool([]);
    setGameStarted(false);
    setQueue([]);
    setMastered([]);
    setPassedCount(0);
    setFailCount({});
    setShowAnswer(false);
    setHistoryStack([]);
    setAiMessages([]);
    clearInterval(hcRef.current);
    setHcTimeLeft(null);
    overTimeRef.current = false;
    answerSeenRef.current = false;
  };

  // ── Toast 헬퍼 ───────────────────────────────────────────────
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2200);
  };

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

  // ── 큐 빌드 ───────────────────────────────────────────────
  const buildQueue = (pool) => {
    const active = [...pool];
    setTotalActive(active.length);
    const byPriority = { 1: [], 2: [], 3: [] };
    active.forEach((word) => {
      const p = Math.min(3, Math.max(1, word.priority ?? 2));
      byPriority[p].push([word]);
    });
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
    setPassedCount(0);
    setFailCount({});
    setShowAnswer(false);
    setGameStarted(true);
    setHistoryStack([]);
    setAiMessages([]);
    clearInterval(hcRef.current);
    setHcTimeLeft(null);
    overTimeRef.current = false;
    answerSeenRef.current = false;
    // 게임 시작 시 pushState (뒤로가기로 종료 가능하도록)
    window.history.pushState({ jflash: true }, '');
  };

  // ── 게임 시작 ─────────────────────────────────────────────
  const startGameByDay = () => {
    const pool = getDayBasePool(currentDay);
    setDayPreviewPool(pool);
    const isKnown = (w) => (srsData[w.id]?.masteryCount ?? 0) >= 2;
    setSelectedWordIds(new Set(pool.filter((w) => !isKnown(w)).map((w) => w.id)));
    setAppScreen('day-preview');
  };

  const startGameByDayWithSelection = () => {
    const pool = wordData.filter((w) => selectedWordIds.has(w.id));
    if (pool.length === 0) return;
    _launchGame(pool);
  };

  const startGameBySelection = () => {
    const pool = wordData.filter((w) => selectedWordIds.has(w.id));
    if (pool.length === 0) return;
    _launchGame(pool);
  };

  // ── 중도 퇴장 ────────────────────────────────────────────────
  const handleExit = () => {
    clearInterval(hcRef.current);
    setGameStarted(false);
    setQueue([]);
    setMastered([]);
    setPassedCount(0);
    setFailCount({});
    setShowAnswer(false);
    setHcTimeLeft(null);
    setHistoryStack([]);
    setAiMessages([]);
    overTimeRef.current = false;
    setAppScreen('home');
  };

  // ── 하드코어 타이머 (word=3초, pattern/sentence=7초) ──────────
  const startHCTimer = (duration) => {
    clearInterval(hcRef.current);
    setHcTimeLeft(duration);
    let remaining = duration;
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
    if (answerSeenRef.current) {
      clearInterval(hcRef.current);
      setHcTimeLeft(null);
      return;
    }
    const duration = queue[0].type === 'word' ? 3 : 7;
    startHCTimer(duration);
    return () => clearInterval(hcRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue[0]?.id, showAnswer, gameStarted, settings.hardcoreMode]);

  // ── 키보드 이벤트 (PC 단축키) ────────────────────────────────
  useEffect(() => {
    if (!gameStarted || queue.length === 0) return;
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.querySelector('.fixed.z-50')) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleFlip();
      }
      if (e.key === 'ArrowLeft' && showAnswer) {
        e.preventDefault();
        handleAction('dontKnow');
      }
      if (e.key === 'ArrowRight' && showAnswer) {
        e.preventDefault();
        handleAction('know');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted, queue.length, showAnswer]);

  // ── 카드 앞면 노출 시 타이머 리셋 ──────────────────────────
  useEffect(() => {
    if (!gameStarted || showAnswer || queue.length === 0) return;
    cardStartTimeRef.current = Date.now();
    overTimeRef.current = false;
  }, [queue[0]?.id, showAnswer, gameStarted]);

  // ── 카드 전환 시 answerSeen 리셋 + AI 채팅 기록 초기화 ───
  useEffect(() => {
    answerSeenRef.current = false;
    setAiMessages([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue[0]?.id]);

  // ── 프리패치 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!gameStarted || queue.length === 0) return;
    const nextTexts = queue.slice(1, 6).map((w) => w.hiragana).filter(Boolean);
    prefetch(nextTexts);
  }, [queue[0]?.id, gameStarted]);

  // ── 카드 뒤집기 ─────────────────────────────────────────────
  const handleFlip = () => {
    if (!showAnswer) {
      clearInterval(hcRef.current);
      setHcTimeLeft(null);
      answerSeenRef.current = true;
      if (cardStartTimeRef.current && queue.length > 0) {
        const t = queue[0].type;
        const threshold = t === 'word' ? 8000 : t === 'pattern' ? 13000 : 17000;
        const elapsed   = Date.now() - cardStartTimeRef.current;
        if (elapsed > threshold) overTimeRef.current = true;
      }
    }
    setShowAnswer((prev) => !prev);
  };

  const handleKnow = () => {
    if (!showAnswer || queue.length === 0) return;
    handleAction('know');
  };

  const handleDragAction = (actionType) => {
    if (queue.length === 0) return;
    if (!showAnswer) {
      clearInterval(hcRef.current);
      setHcTimeLeft(null);
      if (cardStartTimeRef.current) {
        const t = queue[0].type;
        const threshold = t === 'word' ? 8000 : t === 'pattern' ? 13000 : 17000;
        if (Date.now() - cardStartTimeRef.current > threshold) overTimeRef.current = true;
      }
    }
    handleAction(actionType);
  };

  // ── 이전 카드 되돌리기 ───────────────────────────────────────
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setHistoryStack((s) => s.slice(0, -1));
    setQueue((q) => [prev.card, ...q.filter((c) => c.id !== prev.card.id)]);
    setMastered(prev.mastered);
    setFailCount(prev.failCount);
    if (prev.wasPass) setPassedCount(prev.prevPassedCount);
    setShowAnswer(false);
    clearInterval(hcRef.current);
    setHcTimeLeft(null);
    overTimeRef.current = false;
    answerSeenRef.current = false;
    if (prev.srsSnapshot !== undefined) {
      setSrsData((cur) => {
        const restored = { ...cur };
        if (prev.srsSnapshot === null) delete restored[prev.card.id];
        else restored[prev.card.id] = prev.srsSnapshot;
        saveLS(LS.SRS, restored);
        return restored;
      });
    }
  };

  // ── 액션 처리 ─────────────────────────────────────────────────
  const handleAction = (actionType) => {
    if (queue.length === 0) return;
    clearInterval(hcRef.current);
    setHcTimeLeft(null);
    const timedOut = overTimeRef.current;
    overTimeRef.current = false;

    const current   = queue[0];
    let newQueue    = queue.slice(1);
    let newMastered = [...mastered];

    const MAX_HISTORY = 50;
    const was3FailPass = actionType === 'dontKnow' && (failCount[current.id] ?? 0) + 1 >= 3;
    setHistoryStack((s) => {
      const next = [...s, {
        card: current,
        mastered: [...mastered],
        failCount: { ...failCount },
        srsSnapshot: srsData[current.id] ?? null,
        wasPass: was3FailPass,
        prevPassedCount: passedCount,
      }];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });

    if (timedOut && actionType === 'know') {
      newQueue = [...newQueue, current];
      showToast('시간 초과 — 카드 보류됨');
    } else if (actionType === 'know') {
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
      setFailCount((p) => { const n = { ...p }; delete n[current.id]; return n; });
    } else {
      setSrsData((prev) => {
        const rec = prev[current.id] ?? { masteryCount: 0 };
        const newCount = Math.max(rec.masteryCount - 1, 0);
        const updated = {
          ...prev,
          [current.id]: { masteryCount: newCount, nextReview: getSRSNextDate(newCount) },
        };
        saveLS(LS.SRS, updated);
        return updated;
      });

      const currentFail = (failCount[current.id] ?? 0) + 1;
      setFailCount((p) => ({ ...p, [current.id]: currentFail }));

      if (currentFail >= 3) {
        showToast('3회 오답 — 다음 카드로 넘어갑니다');
        setPassedCount((c) => c + 1);
      } else {
        const insertAt = Math.min(Math.floor(Math.random() * 3) + 3, newQueue.length);
        newQueue = [
          ...newQueue.slice(0, insertAt),
          current,
          ...newQueue.slice(insertAt),
        ];
      }
    }

    setQueue(newQueue);
    setMastered(newMastered);
    setShowAnswer(false);
  };

  // ref 갱신 (stale closure 방지)
  handleActionRef.current = handleAction;
  handleExitRef.current = handleExit;

  const handleDontKnow = () => {
    if (queue.length === 0 || !showAnswer) return;
    handleAction('dontKnow');
  };

  // ── 패스 ─────────────────────────────────────────────────────
  const handlePass = () => {
    if (queue.length === 0) return;
    clearInterval(hcRef.current);
    setHcTimeLeft(null);
    overTimeRef.current = false;

    const current = queue[0];
    const MAX_HISTORY = 50;
    setHistoryStack((s) => {
      const next = [...s, {
        card: current,
        mastered: [...mastered],
        failCount: { ...failCount },
        srsSnapshot: srsData[current.id] ?? null,
        wasPass: true,
        prevPassedCount: passedCount,
      }];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });

    showToast('패스 — 이번 학습에서 제외');
    setQueue(queue.slice(1));
    setShowAnswer(false);
    setPassedCount((c) => c + 1);
  };

  // ── 수동 마스터 토글 ────────────────────────────────────────
  const toggleMastery = (wordId) => {
    setSrsData((prev) => {
      const rec = prev[wordId] ?? { masteryCount: 0 };
      const newCount = rec.masteryCount >= 2 ? 0 : 2;
      const updated = {
        ...prev,
        [wordId]: { masteryCount: newCount, nextReview: getSRSNextDate(newCount) },
      };
      saveLS(LS.SRS, updated);
      return updated;
    });
  };

  // ── Toast UI ─────────────────────────────────────────────────
  const Toast = toastMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-lg pointer-events-none whitespace-nowrap">
      {toastMsg}
    </div>
  ) : null;

  // ── 화면 라우팅 ────────────────────────────────────────────────
  if (!gameStarted) {
    if (appScreen === 'browse') {
      return (
        <>
          {Toast}
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
        </>
      );
    }

    if (appScreen === 'day-preview') {
      return (
        <>
          {Toast}
          <DayPreviewScreen
            currentDay={currentDay}
            dayPool={dayPreviewPool}
            selectedWordIds={selectedWordIds}
            srsData={srsData}
            onToggle={toggleWord}
            onSelectAll={() => setSelectedWordIds(new Set(dayPreviewPool.map((w) => w.id)))}
            onDeselectAll={deselectAll}
            onSetSelectedWordIds={setSelectedWordIds}
            onToggleMastery={toggleMastery}
            onStart={startGameByDayWithSelection}
            onBack={() => setAppScreen('home')}
          />
        </>
      );
    }

    if (appScreen === 'pattern-lab') {
      return (
        <>
          {Toast}
          <PatternLabScreen
            onBack={() => setAppScreen('home')}
            onStartStudy={(sentences) => {
              if (sentences.length === 0) return;
              _launchGame(sentences);
            }}
            srsData={srsData}
          />
        </>
      );
    }

    return (
      <>
        {Toast}
        <HomeScreen
          currentDay={currentDay}
          onDayChange={updateCurrentDay}
          dayPool={getDayBasePool(currentDay)}
          settings={settings}
          onSettingsChange={updateSettings}
          onStart={startGameByDay}
          onShowBrowse={() => setAppScreen('browse')}
          onShowPatternLab={() => setAppScreen('pattern-lab')}
          onResetAll={handleResetAll}
        />
      </>
    );
  }

  if (queue.length === 0) {
    return (
      <>
        {Toast}
        <CompletionScreen
          totalActiveWords={totalActive}
          onReset={() => { setGameStarted(false); setAppScreen('home'); }}
        />
      </>
    );
  }

  const currentWord = queue[0];

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center py-6 px-4 font-sans">
      {Toast}

      <div className="max-w-md w-full flex items-center justify-between mb-2">
        <button
          onClick={handleExit}
          aria-label="퀴즈 종료"
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-rose-500 transition-colors py-1 px-2 rounded-lg hover:bg-rose-50"
        >
          <X className="w-4 h-4" /> 종료
        </button>
        <span className="text-xs text-slate-400 font-medium">
          {mastered.length + passedCount} / {totalActive} 완료
        </span>
      </div>

      <ProgressBar mastered={mastered.length + passedCount} total={totalActive} />

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
        selectedWordIds={selectedWordIds}
        onFlip={handleFlip}
        onKnow={handleKnow}
        onDontKnow={handleDontKnow}
        onDragAction={handleDragAction}
        onPass={handlePass}
        onUndo={handleUndo}
        onToggleMastery={toggleMastery}
        srsData={srsData}
        reverseMode={settings.reverseMode}
        blindMode={settings.blindMode}
        aiMessages={aiMessages}
        setAiMessages={setAiMessages}
      />

      {historyStack.length > 0 && (
        <div className="max-w-md w-full mb-1">
          <button
            onClick={handleUndo}
            aria-label="이전 카드로 되돌리기"
            title="이전 카드로 되돌리기"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-sky-500 transition-colors px-2 py-1 rounded-lg hover:bg-sky-50"
          >
            <Undo2 className="w-4 h-4" />
            <span className="font-medium">되돌리기</span>
          </button>
        </div>
      )}

    </div>
  );
}
