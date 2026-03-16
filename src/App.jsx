import { useState, useEffect, useRef } from 'react';
import { Clock, X, Undo2 } from 'lucide-react';
import { wordData } from './data';
import { prefetch } from './lib/googleTTS';
import { TOTAL_DAYS, getDayBasePool } from './lib/curriculum';
import HomeScreen        from './components/HomeScreen';
import BrowseScreen      from './components/BrowseScreen';
import DayPreviewScreen  from './components/DayPreviewScreen';
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

// maxCards 제거 (item 4)
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

function isDueToday(wordId, srsData) {
  const rec = srsData[wordId];
  if (!rec) return true;
  const today = new Date().toISOString().slice(0, 10);
  return rec.nextReview <= today;
}

// ─── 동적 슬롯 치환 ──────────────────────────────────────────────
function fillSlots(word, masteredWords) {
  if (!word.pron?.includes('[') && !word.hiragana?.includes('[')) return word;

  const pickByIndex = (arr, seed) => arr.length
    ? arr[seed % arr.length]
    : null;

  const verbs = masteredWords.filter((w) => w.tags?.[0] === '#동사');
  const adjs  = masteredWords.filter((w) => w.tags?.[0] === '#형용사');

  let pron     = word.pron ?? '';
  let hiragana = word.hiragana ?? '';
  const v   = pickByIndex(verbs, word.id);
  const a   = pickByIndex(adjs, word.id + 1);
  const any = pickByIndex(masteredWords, word.id + 2);

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
  // 'home' | 'browse' | 'day-preview'
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

  // Day 미리보기 풀 (item 5): startGameByDay 시 계산
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

  // ── 게임 상태 ─────────────────────────────────────────────
  const [queue, setQueue]         = useState([]);
  const [mastered, setMastered]   = useState([]);
  const [failCount, setFailCount] = useState({});
  const [showAnswer, setShowAnswer]   = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [totalActive, setTotalActive] = useState(0);

  // ── Toast ───────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState('');

  // ── AI 채팅 상태 (호이스팅: 모달 닫아도 유지, 카드 전환 시 초기화) ─
  const [aiMessages, setAiMessages] = useState([]);

  // ── 이전 카드 되돌리기 스택 ────────────────────────────────
  const [historyStack, setHistoryStack] = useState([]);

  // ── 하드코어 타이머 ─────────────────────────────────────────
  const [hcTimeLeft, setHcTimeLeft] = useState(null);
  const hcRef           = useRef(null);
  const handleActionRef = useRef(null);

  // ── 시간 초과 시스템 refs (item 9) ──────────────────────────
  const cardStartTimeRef = useRef(null); // 앞면 노출 시각
  const overTimeRef      = useRef(false); // 초과 플래그
  const answerSeenRef    = useRef(false); // 현재 카드 뒷면 열람 여부

  // ── 전체 초기화 ─────────────────────────────────────────────
  const handleResetAll = () => {
    // localStorage 전체 삭제
    Object.values(LS).forEach((key) => { try { localStorage.removeItem(key); } catch {} });
    // 상태 초기화
    setSettings({ ...DEFAULT_SETTINGS });
    setSrsData({});
    setCurrentDay(1);
    setSelectedWordIds(new Set(getDayBasePool(1).map((w) => w.id)));
    setAppScreen('home');
    setDayPreviewPool([]);
    setGameStarted(false);
    setQueue([]);
    setMastered([]);
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

  // ── 큐 빌드 (pool → SRS → priority 정렬, maxCards 제한 없음) ─
  const buildQueue = (pool) => {
    let active = [...pool];

    // 1. SRS 필터: 오늘 복습 예정만 (기록 충분 시, 최소 5개 보장)
    const hasSRS = Object.keys(srsData).length >= 5;
    if (hasSRS) {
      const due = active.filter((w) => isDueToday(w.id, srsData));
      if (due.length >= 3) {
        const MIN_POOL = 5;
        if (due.length >= MIN_POOL) {
          active = due;
        } else {
          const nonDue = shuffle(active.filter((w) => !isDueToday(w.id, srsData)));
          active = [...due, ...nonDue.slice(0, MIN_POOL - due.length)];
        }
      }
    }

    setTotalActive(active.length);

    // 2. priority별 그룹 + 반의어 쌍 묶기
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

    // 3. Fisher-Yates 셔플 (priority 순서 유지, 타입 믹싱)
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
    setFailCount({});
    setShowAnswer(false);
    setGameStarted(true);
    setHistoryStack([]);
    setAiMessages([]);
    clearInterval(hcRef.current);
    setHcTimeLeft(null);
    overTimeRef.current = false;
    answerSeenRef.current = false;
  };

  // ── 게임 시작 — HomeScreen (Day N 시작 → day-preview로 이동) ─
  const startGameByDay = () => {
    const basePool = getDayBasePool(currentDay);
    // 패턴(pattern) 제외 — 단어 + 통문장만
    const pool = basePool.filter((w) => w.type !== 'pattern');

    setDayPreviewPool(pool);
    // 아는 단어 제외가 디폴트 — masteryCount >= 3인 단어는 초기 선택에서 제외
    const isKnown = (w) => (srsData[w.id]?.masteryCount ?? 0) >= 3;
    setSelectedWordIds(new Set(pool.filter((w) => !isKnown(w)).map((w) => w.id)));
    setAppScreen('day-preview');
  };

  // ── 게임 시작 — DayPreviewScreen (선택된 단어로 시작) ────────
  const startGameByDayWithSelection = () => {
    const pool = wordData.filter((w) => selectedWordIds.has(w.id));
    if (pool.length === 0) return;
    _launchGame(pool);
  };

  // ── 게임 시작 — BrowseScreen (selectedWordIds 직접 사용) ──────
  const startGameBySelection = () => {
    const pool = wordData.filter((w) => selectedWordIds.has(w.id));
    if (pool.length === 0) return;
    _launchGame(pool);
  };

  // ── 중도 퇴장 (item 3) ────────────────────────────────────────
  const handleExit = () => {
    clearInterval(hcRef.current);
    setGameStarted(false);
    setQueue([]);
    setMastered([]);
    setFailCount({});
    setShowAnswer(false);
    setHcTimeLeft(null);
    setHistoryStack([]);
    setAiMessages([]);
    overTimeRef.current = false;
    setAppScreen('home');
    // srsData는 handleAction 시마다 saveLS 처리됨 — 추가 저장 불필요
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
    // 이미 뒷면을 본 카드는 타이머 재시작 안 함 (뒤→앞 재플립 악용 방지)
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
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleFlip();   // ↑/↓ = 카드 뒤집기
      }
      if (e.key === 'ArrowLeft' && showAnswer) {
        e.preventDefault();
        handleAction('dontKnow');  // ← = 모르는 단어
      }
      if (e.key === 'ArrowRight' && showAnswer) {
        e.preventDefault();
        handleAction('know');  // → = 아는 단어
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

  // ── 카드 뒤집기 (Flip) — 탭/클릭은 뒤집기만 수행 ─────────────
  const handleFlip = () => {
    if (!showAnswer) {
      // 앞→뒤: 하드코어 타이머 정지 + 오버타임 체크
      clearInterval(hcRef.current);
      setHcTimeLeft(null);
      answerSeenRef.current = true;

      if (cardStartTimeRef.current && queue.length > 0) {
        const t = queue[0].type;
        const threshold = t === 'word' ? 8000 : t === 'pattern' ? 13000 : 17000;
        const elapsed   = Date.now() - cardStartTimeRef.current;
        if (elapsed > threshold) {
          overTimeRef.current = true;
        }
      }
    }
    setShowAnswer((prev) => !prev);
  };

  // ── 아는 단어 처리 (WordCard 버튼/키보드용, 뒷면에서만) ──────
  const handleKnow = () => {
    if (!showAnswer || queue.length === 0) return;
    handleAction('know');
  };

  // ── 드래그 액션 처리 (앞면/뒷면 모두, 드래그 전용) ──────────
  const handleDragAction = (actionType) => {
    if (queue.length === 0) return;
    // 앞면이면 오버타임 체크 (handleFlip의 앞→뒤 로직 동일)
    if (!showAnswer) {
      clearInterval(hcRef.current);
      setHcTimeLeft(null);
      if (cardStartTimeRef.current) {
        const t = queue[0].type;
        const threshold = t === 'word' ? 8000 : t === 'pattern' ? 13000 : 17000;
        if (Date.now() - cardStartTimeRef.current > threshold) {
          overTimeRef.current = true;
        }
      }
    }
    handleAction(actionType);
  };

  // ── 이전 카드 되돌리기 ───────────────────────────────────────
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setHistoryStack((s) => s.slice(0, -1));
    setQueue((q) => [prev.card, ...q]);
    setMastered(prev.mastered);
    setFailCount(prev.failCount);
    setShowAnswer(false);
    clearInterval(hcRef.current);
    setHcTimeLeft(null);
    overTimeRef.current = false;
    answerSeenRef.current = false;
    // SRS 롤백
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
    // 시간 초과 플래그 스냅샷
    const timedOut = overTimeRef.current;
    overTimeRef.current = false;

    const current   = queue[0];
    let newQueue    = queue.slice(1);
    let newMastered = [...mastered];

    // ── 히스토리 기록 (되돌리기용, 최대 50개) ──────────────
    const MAX_HISTORY = 50;
    setHistoryStack((s) => {
      const next = [...s, {
        card: current,
        mastered: [...mastered],
        failCount: { ...failCount },
        srsSnapshot: srsData[current.id] ?? null,
      }];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });

    if (timedOut) {
      // ── 시간 초과: 큐 맨 끝으로 이동 (SRS 미갱신, masteryCount 유지)
      newQueue = [...newQueue, current];
      showToast('시간 초과 — 카드 보류됨');

    } else if (actionType === 'know') {
      // ── 1회 즉시 마스터 (item 2)
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
      // ── 오답 처리
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

      // ── 3회 이상 실패 → pass (재삽입 없이 건너뛰기)
      if (currentFail >= 3) {
        showToast('3회 오답 — 다음 카드로 넘어갑니다');
      } else {
        // 반의어 함께 재삽입
        let antonym = null;
        if (current.type === 'word' && current.antonymId && selectedWordIds.has(current.antonymId)) {
          const antId = current.antonymId;
          const mIdx  = newMastered.findIndex((w) => w.id === antId);
          if (mIdx !== -1) antonym = newMastered.splice(mIdx, 1)[0];
          else {
            const qIdx = newQueue.findIndex((w) => w.id === antId);
            if (qIdx !== -1) antonym = newQueue.splice(qIdx, 1)[0];
            else {
              // Fallback: 패스 등으로 세션에서 제거된 경우 wordData에서 직접 주입
              const fromData = wordData.find((w) => w.id === antId);
              if (fromData) antonym = fromData;
            }
          }
        }

        // 의존성 주입: componentIds를 큐 5~10번째에 삽입
        if (current.componentIds?.length > 0) {
          current.componentIds.forEach((cid) => {
            const comp = wordData.find((w) => w.id === cid);
            if (comp && !newQueue.find((w) => w.id === cid) && !newMastered.find((w) => w.id === cid)) {
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
    }

    // 슬롯 치환: 큐 첫 번째 카드에 적용
    const filledQueue = newQueue.length > 0
      ? [fillSlots(newQueue[0], newMastered), ...newQueue.slice(1)]
      : newQueue;

    setQueue(filledQueue);
    setMastered(newMastered);
    setShowAnswer(false);
  };

  // ref 갱신 (stale closure 방지)
  handleActionRef.current = handleAction;

  // ── 모르는 단어 처리 (WordCard 스와이프/화살표용) ──────────────
  const handleDontKnow = () => {
    if (queue.length === 0 || !showAnswer) return;
    handleAction('dontKnow');
  };

  // ── 패스 (이번 세션에서 완전 제외) ─────────────────────────────
  const handlePass = () => {
    if (queue.length === 0) return;
    clearInterval(hcRef.current);
    setHcTimeLeft(null);
    overTimeRef.current = false;

    // ── 히스토리 기록 (되돌리기용) ──────────────────────
    const current = queue[0];
    const MAX_HISTORY = 50;
    setHistoryStack((s) => {
      const next = [...s, {
        card: current,
        mastered: [...mastered],
        failCount: { ...failCount },
        srsSnapshot: srsData[current.id] ?? null,
      }];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });

    const newQueue = queue.slice(1); // 큐에서 완전 제거
    const filledQueue = newQueue.length > 0
      ? [fillSlots(newQueue[0], mastered), ...newQueue.slice(1)]
      : newQueue;

    showToast('패스 — 이번 학습에서 제외');
    setQueue(filledQueue);
    setShowAnswer(false);
  };

  // ── 수동 마스터 토글 (체크 아이콘, 확인 다이얼로그 경유) ─────
  const toggleMastery = (wordId) => {
    setSrsData((prev) => {
      const rec = prev[wordId] ?? { masteryCount: 0 };
      const newCount = rec.masteryCount >= 3 ? 1 : 3;  // 아는→모르는: 3→1
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

      {/* 진행 헤더: Exit 버튼 + 완료 수 */}
      <div className="max-w-md w-full flex items-center justify-between mb-2">
        <button
          onClick={handleExit}
          aria-label="퀴즈 종료"
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-rose-500 transition-colors py-1 px-2 rounded-lg hover:bg-rose-50"
        >
          <X className="w-4 h-4" /> 종료
        </button>
        <span className="text-xs text-slate-400 font-medium">
          {mastered.length} / {totalActive} 완료
        </span>
      </div>

      {/* 진행률 바 (item 8) */}
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

      {/* 되돌리기 버튼 — 카드 아래 왼쪽 */}
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
