import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Volume1, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { useTTS, speakText } from '../hooks/useTTS';
import { TYPE_META, CATEGORY_META } from '../data';
import AiChatModal from './AiChatModal';

// ─── 동적 폰트 사이즈 ────────────────────────────────────────────
function getPronSizeClass(pron, type) {
  const len = pron?.length ?? 0;
  if (type === 'word') {
    if (len <= 4)  return 'text-6xl';
    if (len <= 7)  return 'text-5xl';
    return 'text-4xl';
  }
  if (len <= 8)  return 'text-4xl';
  if (len <= 14) return 'text-3xl';
  if (len <= 22) return 'text-2xl';
  return 'text-xl';
}

function getMeaningSizeClass(meaning, type) {
  if (type === 'word') return 'text-5xl';
  const len = meaning?.length ?? 0;
  if (len <= 10) return 'text-3xl';
  if (len <= 18) return 'text-2xl';
  return 'text-xl';
}

// ─── 블라인드 모드 뒷면 전용 사이즈 (4/7 · 2/7 · 1/7 비율) ──────
function getBlindHiraganaSizeClass(hiragana) {
  const len = hiragana?.length ?? 0;
  if (len <= 6)  return 'text-5xl';
  if (len <= 12) return 'text-4xl';
  if (len <= 20) return 'text-3xl';
  return 'text-2xl';
}

function getBlindMeaningSizeClass(meaning) {
  const len = meaning?.length ?? 0;
  if (len <= 10) return 'text-2xl';
  if (len <= 18) return 'text-xl';
  return 'text-lg';
}

// ─── 정중체 뱃지 ──────────────────────────────────────────────────
function PolitenessTag({ politeness }) {
  if (!politeness || politeness === '해당없음') return null;
  const style = politeness === '정중체'
    ? 'bg-blue-50 text-blue-600 border-blue-200'
    : 'bg-orange-50 text-orange-600 border-orange-200';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${style}`}>
      {politeness}
    </span>
  );
}

// ─── 마스터리 진행 표시 (●●○) ──────────────────────────────────────
function MasteryDots({ masteryCount = 0 }) {
  const dots = [];
  for (let i = 0; i < 3; i++) {
    dots.push(
      <span
        key={i}
        className={`inline-block w-2 h-2 rounded-full ${
          i < masteryCount ? 'bg-emerald-400' : 'bg-slate-200'
        }`}
      />
    );
  }
  return <div className="flex items-center gap-1">{dots}</div>;
}

// ─── 드래그 스와이프 훅 (카드를 실제로 끌어서 넘기기) ────────────────
const DRAG_THRESHOLD = 80; // 이 이상 드래그하면 액션 실행

function useDrag({ onSwipeLeft, onSwipeRight, enabled }) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const locked = useRef(false);     // 수평 드래그 확정 여부
  const cancelled = useRef(false);  // 수직 스크롤로 취소
  const didMove = useRef(false);    // 이동 발생 여부 (클릭 방지용)

  const handleStart = useCallback((clientX, clientY) => {
    if (!enabled) return;
    startX.current = clientX;
    startY.current = clientY;
    locked.current = false;
    cancelled.current = false;
    didMove.current = false;
    setIsDragging(true);
  }, [enabled]);

  const handleMove = useCallback((clientX, clientY) => {
    if (startX.current === null || cancelled.current) return;
    const dx = clientX - startX.current;
    const dy = clientY - startY.current;

    // 아직 방향 미확정 시: 수직이면 취소
    if (!locked.current) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        cancelled.current = true;
        didMove.current = true;  // 수직 스크롤도 이동으로 간주 (클릭 방지)
        setDragX(0);
        setIsDragging(false);
        return;
      }
      if (Math.abs(dx) > 10) { locked.current = true; didMove.current = true; }
    }

    if (locked.current) setDragX(dx);
  }, []);

  const handleEnd = useCallback(() => {
    if (startX.current === null) return;
    startX.current = null;
    startY.current = null;
    setIsDragging(false);

    if (cancelled.current) { setDragX(0); /* didMove는 유지 — click 이후 리셋 */ setTimeout(() => { didMove.current = false; }, 0); return; }

    if (dragX > DRAG_THRESHOLD) { onSwipeRight?.(); }
    else if (dragX < -DRAG_THRESHOLD) { onSwipeLeft?.(); }
    setDragX(0);
    // click 이벤트는 touchend/mouseup 이후에 발생하므로 다음 틱에 리셋
    setTimeout(() => { didMove.current = false; }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragX, onSwipeLeft, onSwipeRight]);

  const handlers = {
    onTouchStart:  (e) => handleStart(e.touches[0].clientX, e.touches[0].clientY),
    onTouchMove:   (e) => {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
      if (locked.current) e.preventDefault(); // 브라우저 기본 스와이프 차단
    },
    onTouchEnd:    handleEnd,
    onMouseDown:   (e) => { e.preventDefault(); handleStart(e.clientX, e.clientY); },
    onMouseMove:   (e) => { if (isDragging) handleMove(e.clientX, e.clientY); },
    onMouseUp:     handleEnd,
    onMouseLeave:  () => { if (isDragging) handleEnd(); },
  };

  // 드래그 진행도 (0~1, 1이면 threshold 도달)
  const progress = Math.min(Math.abs(dragX) / DRAG_THRESHOLD, 1);
  const direction = dragX > 0 ? 'right' : dragX < 0 ? 'left' : null;

  return { handlers, dragX, isDragging: isDragging && locked.current, progress, direction, didMove };
}

// ─── TTS 버튼 쌍 (1.0x + 0.7x 상시 배치) ────────────────────────
function TTSButtons({ hiragana }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); speakText(hiragana, { rate: 1.0 }); }}
        title="일반 속도 재생 (1.0x)"
        aria-label="일반 속도 재생"
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-sky-500 transition-colors px-2 py-1 rounded-lg hover:bg-sky-50"
      >
        <Volume2 className="w-4 h-4" />
        <span className="font-medium">듣기</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); speakText(hiragana, { rate: 0.7 }); }}
        title="천천히 재생 (0.7x)"
        aria-label="천천히 재생"
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-500 transition-colors px-2 py-1 rounded-lg hover:bg-violet-50"
      >
        <Volume1 className="w-4 h-4" />
        <span className="font-medium">천천히</span>
      </button>
    </div>
  );
}

// ─── 카드 오버레이 (좌상단 뱃지 + 우상단 마스터리) ─────────────────
function CardOverlay({ word, hasPair, typeBadge, badgeText, reverseMode, blindMode, masteryCount, isMastered, onCheckClick }) {
  return (
    <>
      {/* 좌상단 뱃지 */}
      <div className="absolute top-4 left-4 flex gap-1.5 z-10 flex-wrap max-w-[60%]">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm border ${typeBadge}`}>
          {badgeText}
        </span>
        {hasPair && (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold shadow-sm bg-slate-50 text-slate-500 border border-slate-200">
            반의어 쌍
          </span>
        )}
        {reverseMode && (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-500 border border-blue-200">
            리버스
          </span>
        )}
        {blindMode && (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-500 border border-purple-200">
            블라인드
          </span>
        )}
      </div>

      {/* 우상단: 마스터리 진행 + 체크 토글 */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <MasteryDots masteryCount={Math.min(masteryCount, 3)} />
        <button
          onClick={onCheckClick}
          title={isMastered ? '모르는 단어로 변경' : '아는 단어로 변경'}
          aria-label={isMastered ? '모르는 단어로 변경' : '아는 단어로 변경'}
          className="p-1 rounded-lg transition-colors hover:bg-emerald-50"
        >
          <CheckCircle2 className={`w-4 h-4 ${isMastered ? 'text-emerald-500' : 'text-slate-300'}`} />
        </button>
      </div>
    </>
  );
}

// ─── 카드 앞면 ────────────────────────────────────────────────────
function CardFront({ word, reverseMode, blindMode }) {
  const pronSize    = getPronSizeClass(word.pron, word.type);
  const meaningSize = getMeaningSizeClass(word.meaning, word.type);
  const catMeta     = CATEGORY_META[word.type];

  // ── 블라인드 모드 앞면: 우상단 소형 TTS 버튼 + 전체 탭 영역 ───
  if (blindMode) {
    return (
      <div className="flex-1 flex flex-col w-full cursor-pointer">
        {/* 우상단 소형 TTS 버튼 */}
        <div className="flex justify-end px-3 pt-3 gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); speakText(word.hiragana, { rate: 1.0 }); }}
            title="일반 속도 재생"
            aria-label="일반 속도 재생"
            className="p-1.5 rounded-lg bg-sky-50 text-sky-400 hover:bg-sky-100 hover:text-sky-600 transition-colors"
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); speakText(word.hiragana, { rate: 0.7 }); }}
            title="천천히 재생"
            aria-label="천천히 재생"
            className="p-1.5 rounded-lg bg-violet-50 text-violet-400 hover:bg-violet-100 hover:text-violet-600 transition-colors"
          >
            <Volume1 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 w-full">
          <Volume2 className="w-16 h-16 text-sky-100 mb-4" />
          <span className="text-2xl font-bold text-slate-200 select-none">탭하여 뜻 확인</span>
          <span className="text-xs text-slate-300 mt-2">화면 아무데나 탭하세요</span>
        </div>
      </div>
    );
  }

  // ── 리버스 모드: 뜻을 앞에 표시 ──────────────────────────────
  if (reverseMode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 w-full cursor-pointer group">
        {word.type !== 'word' && (
          <span className={`text-xs font-bold px-3 py-1 rounded-full border mb-4 ${catMeta?.badge ?? ''}`}>
            {catMeta?.label}
          </span>
        )}
        <h2
          className={`${meaningSize} font-black text-slate-800 mb-6 break-keep text-center
            group-hover:scale-105 transition-transform leading-tight`}
        >
          {word.meaning}
        </h2>
        <span className="text-sky-400 font-semibold text-sm mb-4">탭하여 발음 확인</span>
        <TTSButtons hiragana={word.hiragana} />
      </div>
    );
  }

  // ── 기본 모드: 발음(pron)을 앞에 표시 ────────────────────────
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 w-full cursor-pointer group">
      {word.type !== 'word' && (
        <span className={`text-xs font-bold px-3 py-1 rounded-full border mb-4 ${catMeta?.badge ?? ''}`}>
          {catMeta?.label}
        </span>
      )}
      <h2
        className={`${pronSize} font-black text-slate-800 mb-2 break-keep text-center
          group-hover:scale-105 transition-transform leading-tight`}
      >
        {word.pron}
      </h2>
      <span className="text-lg font-medium text-slate-300 mb-6 text-center">
        {word.hiragana}
      </span>
      <span className="text-sky-400 font-semibold text-sm mb-4">탭하여 뜻 확인</span>
      <TTSButtons hiragana={word.hiragana} />
    </div>
  );
}

// ─── AI 질문 버튼 (뒷면 하단 전용) ────────────────────────────────
function AiButton({ onAiClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onAiClick(); }}
      title="AI에게 질문하기"
      aria-label="AI에게 질문하기"
      className="flex items-center gap-1 text-xs font-semibold text-violet-500
        bg-violet-50 border border-violet-200 hover:bg-violet-100
        transition-colors px-2.5 py-1.5 rounded-full"
    >
      <Sparkles className="w-3.5 h-3.5" />
      AI 질문
    </button>
  );
}

// ─── 카드 뒷면 ────────────────────────────────────────────────────
function CardBack({ word, reverseMode, blindMode = false, onAiClick, onKnow, onDontKnow }) {
  const pronSize    = getPronSizeClass(word.pron, word.type);
  const meaningSize = getMeaningSizeClass(word.meaning, word.type);

  // ── 블라인드 모드 뒷면
  if (blindMode) {
    const hiraSize = getBlindHiraganaSizeClass(word.hiragana);
    const meanSize = getBlindMeaningSizeClass(word.meaning);
    return (
      <div className="flex-1 flex flex-col items-center w-full px-6 py-6">
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {/* hiragana + 정중체 인라인 */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <p className={`${hiraSize} font-black text-slate-800 break-keep text-center leading-tight`}>
              {word.hiragana}
            </p>
            <PolitenessTag politeness={word.politeness} />
          </div>

          {/* pron */}
          <p className="text-sm font-medium text-slate-400 break-keep text-center mb-3">
            {word.pron}
          </p>

          {/* meaning */}
          <p className={`${meanSize} font-bold text-slate-600 break-keep text-center leading-snug mb-3`}>
            {word.meaning}
          </p>

          {/* TTS + AI */}
          <div className="w-full flex items-center justify-between pt-4">
            <TTSButtons hiragana={word.hiragana} />
            <AiButton onAiClick={onAiClick} />
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="w-full flex gap-3 pt-3 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDontKnow?.(); }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold text-base transition-all shadow-md"
          >
            <XCircle className="w-5 h-5" /> 모름
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onKnow?.(); }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-base transition-all shadow-md"
          >
            <CheckCircle2 className="w-5 h-5" /> 앎
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center w-full p-5">
      <div className="flex-1 flex flex-col items-center justify-center w-full overflow-y-auto">
        {/* 히라가나 + 정중체 인라인 + 발음 + 주요 답 */}
        <div className="w-full text-center mb-2">
          <div className="flex items-center justify-center gap-2 mb-0.5">
            <span className="text-slate-300 font-medium text-base break-keep">
              {word.hiragana}
            </span>
            <PolitenessTag politeness={word.politeness} />
          </div>
          <span className="text-slate-400 font-medium block text-xs mb-3 break-keep">
            [{word.pron}]
          </span>
          <h2
            className={`${reverseMode ? pronSize : meaningSize} font-extrabold text-slate-800 break-keep leading-snug`}
          >
            {reverseMode ? word.pron : word.meaning}
          </h2>
        </div>

        {/* 문법 구조 (패턴 전용) */}
        {word.structure && (
          <div className="w-full bg-violet-50 border border-violet-100 rounded-2xl p-3 text-center mb-2">
            <p className="text-xs font-bold text-violet-400 mb-1">문법 구조</p>
            <p className="text-sm font-bold text-violet-700">{word.structure}</p>
          </div>
        )}

        {/* 예문/상황 */}
        <div className={`w-full p-3 rounded-2xl border text-center mb-2 ${
          word.type === 'sentence'
            ? 'bg-emerald-50 border-emerald-100'
            : 'bg-slate-50 border-slate-100'
        }`}>
          <p className="text-xs font-bold text-slate-400 mb-1">
            {word.type === 'sentence' ? '상황' : '예문'}
          </p>
          <p className="text-sm font-semibold text-slate-600 break-keep">{word.example}</p>
        </div>

        {/* 학습 포인트 */}
        {word.description && (
          <div className="w-full bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center mb-2">
            <p className="text-xs font-bold text-amber-400 mb-1">학습 포인트</p>
            <p className="text-xs text-amber-700 break-keep">{word.description}</p>
          </div>
        )}

        {/* TTS + AI */}
        <div className="w-full flex items-center justify-between pt-1">
          <TTSButtons hiragana={word.hiragana} />
          <AiButton onAiClick={onAiClick} />
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="w-full flex gap-3 pt-3 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onDontKnow?.(); }}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold text-base transition-all shadow-md"
        >
          <XCircle className="w-5 h-5" /> 모름
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onKnow?.(); }}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-base transition-all shadow-md"
        >
          <CheckCircle2 className="w-5 h-5" /> 앎
        </button>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
export default function WordCard({
  word,
  showAnswer,
  animateCard,
  slideDirection,
  selectedWordIds,
  onFlip,
  onKnow,
  onDontKnow,
  onDragAction,
  onToggleMastery,
  srsData = {},
  reverseMode = false,
  blindMode   = false,
  aiMessages,
  setAiMessages,
}) {
  const [showAiModal, setShowAiModal] = useState(false);
  const [showMasteryConfirm, setShowMasteryConfirm] = useState(false);
  const [enableFlipTransition, setEnableFlipTransition] = useState(true);

  const hasPair   = word.type === 'word' && word.antonymId && selectedWordIds.has(word.antonymId);
  const typeBadge = TYPE_META[word.type] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  const badgeText = word.type === 'word'
    ? (word.tags?.[0] ?? '단어')
    : CATEGORY_META[word.type]?.label ?? word.type;

  const masteryCount = srsData[word.id]?.masteryCount ?? 0;
  const isMastered = masteryCount >= 3;

  // 카드 전환 시 확인 다이얼로그 리셋 + 플립 트랜지션 일시 해제
  useEffect(() => {
    setShowMasteryConfirm(false);
    // 새 카드 로드 시 플립 트랜지션 비활성화 (뒤→앞 뒤집힘 방지)
    setEnableFlipTransition(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setEnableFlipTransition(true);
      });
    });
  }, [word.id]);

  // TTS 자동 재생: 앞면 노출 시 즉시 재생
  useTTS(word.hiragana, !showAnswer);

  // 드래그 스와이프 (앞면/뒷면 모두 활성)
  const { handlers: dragHandlers, dragX, isDragging, progress, direction: dragDirection, didMove } = useDrag({
    onSwipeRight: () => { setEnableFlipTransition(false); onDragAction?.('know'); },
    onSwipeLeft:  () => { setEnableFlipTransition(false); onDragAction?.('dontKnow'); },
    enabled: true,
  });

  const handleCheckClick = (e) => {
    e.stopPropagation();
    setShowMasteryConfirm(true);
  };

  const handleMasteryConfirm = () => {
    onToggleMastery?.(word.id);
    setShowMasteryConfirm(false);
  };

  const overlayProps = {
    word, hasPair, typeBadge, badgeText, reverseMode, blindMode,
    masteryCount, isMastered, onCheckClick: handleCheckClick,
  };

  // 드래그 중 카드 회전 (최대 ±8도)
  const dragRotate = isDragging ? dragX * 0.05 : 0;
  // rotateY(180deg) 상태에서 translateX가 미러링되므로 뒷면일 때 -dragX 보정
  const tx = showAnswer ? -dragX : dragX;
  const baseTransform = showAnswer ? 'rotateY(180deg) ' : '';
  const dragStyle = isDragging
    ? { transform: `${baseTransform}translateX(${tx}px) rotate(${dragRotate}deg)`, transition: 'none' }
    : {};

  return (
    <>
      <div
        className="max-w-md w-full mb-4 h-[480px] flip-card relative"
        {...dragHandlers}
      >
        {/* ── 드래그 방향 힌트 (카드 뒤에 표시) ── */}
        {isDragging && progress > 0.1 && (
          <>
            {/* 오른쪽 = 앎 */}
            <div
              className="absolute inset-0 flex items-center justify-end pr-8 pointer-events-none z-0"
              style={{ opacity: dragDirection === 'right' ? progress : 0 }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <span className="text-sm font-bold text-emerald-600">앎</span>
              </div>
            </div>
            {/* 왼쪽 = 모름 */}
            <div
              className="absolute inset-0 flex items-center justify-start pl-8 pointer-events-none z-0"
              style={{ opacity: dragDirection === 'left' ? progress : 0 }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-rose-500" />
                </div>
                <span className="text-sm font-bold text-rose-600">모름</span>
              </div>
            </div>
          </>
        )}

        <div
          className={`flip-card-inner
            ${showAnswer ? 'flipped' : ''}
            ${enableFlipTransition && !isDragging ? 'flip-transition' : ''}
            ${animateCard && slideDirection === 'right' ? (showAnswer ? 'slide-right-back' : 'slide-right-front') : ''}
            ${animateCard && slideDirection === 'left' ? (showAnswer ? 'slide-left-back' : 'slide-left-front') : ''}
            ${animateCard && !slideDirection ? 'scale-95 opacity-50' : ''}
            ${!isDragging && dragX === 0 ? 'snap-back' : ''}`}
          style={isDragging ? dragStyle : {}}
          onClick={(isDragging || didMove.current) ? undefined : onFlip}
        >
          {/* ── 앞면 ── */}
          <div className="flip-card-face bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col
            relative border border-slate-100">
            <CardOverlay {...overlayProps} />
            <CardFront
              word={word}
              reverseMode={reverseMode}
              blindMode={blindMode}
            />
          </div>

          {/* ── 뒷면 ── */}
          <div className="flip-card-face flip-card-back bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col
            relative border border-slate-100">
            <CardOverlay {...overlayProps} />
            <CardBack
              word={word}
              reverseMode={reverseMode}
              blindMode={blindMode}
              onAiClick={() => setShowAiModal(true)}
              onKnow={onKnow}
              onDontKnow={onDontKnow}
            />
          </div>
        </div>

        {/* ── 마스터리 확인 다이얼로그 ── */}
        {showMasteryConfirm && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 rounded-3xl"
            onClick={(e) => { e.stopPropagation(); setShowMasteryConfirm(false); }}
          >
            <div
              className="bg-white rounded-2xl shadow-xl p-6 mx-6 max-w-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-slate-700 text-center mb-4">
                이 단어를 {isMastered ? '모르는 단어로' : '아는 단어로'} 설정하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMasteryConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleMasteryConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAiModal && (
        <AiChatModal
          currentCard={word}
          onClose={() => setShowAiModal(false)}
          messages={aiMessages}
          setMessages={setAiMessages}
        />
      )}
    </>
  );
}
