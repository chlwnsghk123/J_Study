import { Volume2, Volume1 } from 'lucide-react';
import { useTTS, speakText } from '../hooks/useTTS';
import { TYPE_META, CATEGORY_META } from '../data';

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

// ─── TTS 버튼 쌍 (1.0x + 0.7x 상시 배치, item 1) ────────────────
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

// ─── 카드 앞면 ────────────────────────────────────────────────────
function CardFront({ word, onCardClick, reverseMode, blindMode }) {
  const pronSize    = getPronSizeClass(word.pron, word.type);
  const meaningSize = getMeaningSizeClass(word.meaning, word.type);
  const catMeta     = CATEGORY_META[word.type];

  // ── 블라인드 모드 (item 6): 상단 TTS 버튼 + 넓은 탭 영역 ──────
  if (blindMode) {
    return (
      <div className="flex-1 flex flex-col w-full">
        {/* 상단 전용 TTS 버튼 영역 */}
        <div className="flex items-center justify-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
          <button
            onClick={(e) => { e.stopPropagation(); speakText(word.hiragana, { rate: 1.0 }); }}
            title="일반 속도 재생"
            aria-label="일반 속도 재생"
            className="flex items-center gap-2 bg-sky-500 text-white text-sm font-bold px-5 py-3 rounded-2xl hover:bg-sky-600 active:scale-95 transition-all shadow-sm"
          >
            <Volume2 className="w-5 h-5" />
            듣기
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); speakText(word.hiragana, { rate: 0.7 }); }}
            title="천천히 재생"
            aria-label="천천히 재생"
            className="flex items-center gap-2 bg-violet-100 text-violet-600 text-sm font-bold px-5 py-3 rounded-2xl hover:bg-violet-200 active:scale-95 transition-all"
          >
            <Volume1 className="w-5 h-5" />
            천천히
          </button>
        </div>

        {/* 하단 전체 영역이 탭 트리거 (item 6) */}
        <button
          onClick={onCardClick}
          className="flex-1 flex flex-col items-center justify-center p-8 w-full cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <Volume2 className="w-16 h-16 text-sky-100 mb-4" />
          <span className="text-2xl font-bold text-slate-200 select-none">탭하여 뜻 확인</span>
          <span className="text-xs text-slate-300 mt-2">화면 아무데나 탭하세요</span>
        </button>
      </div>
    );
  }

  // ── 리버스 모드: 뜻을 앞에 표시 ──────────────────────────────
  if (reverseMode) {
    return (
      <button
        onClick={onCardClick}
        className="flex-1 flex flex-col items-center justify-center p-8 w-full cursor-pointer hover:bg-slate-50 transition-colors group"
      >
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
      </button>
    );
  }

  // ── 기본 모드: 발음(pron)을 앞에 표시 ────────────────────────
  return (
    <button
      onClick={onCardClick}
      className="flex-1 flex flex-col items-center justify-center p-8 w-full cursor-pointer hover:bg-slate-50 transition-colors group"
    >
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
    </button>
  );
}

// ─── 카드 뒷면 ────────────────────────────────────────────────────
function CardBack({ word, onCardClick, reverseMode }) {
  const pronSize    = getPronSizeClass(word.pron, word.type);
  const meaningSize = getMeaningSizeClass(word.meaning, word.type);

  return (
    <button
      onClick={onCardClick}
      className="flex-1 flex flex-col items-center justify-center w-full cursor-pointer hover:bg-slate-50 transition-colors p-5"
    >
      {/* 히라가나 + 발음 + 주요 답 */}
      <div className="w-full text-center mb-3">
        <span className="text-slate-300 font-medium block text-base mb-0.5 break-keep">
          {word.hiragana}
        </span>
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

      {/* 정중체 + TTS 버튼 */}
      <div className="w-full flex items-center justify-between mt-auto pt-1">
        <PolitenessTag politeness={word.politeness} />
        <TTSButtons hiragana={word.hiragana} />
      </div>
    </button>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
export default function WordCard({
  word,
  showAnswer,
  animateCard,
  selectedWordIds,
  onCardClick,
  reverseMode = false,
  blindMode   = false,
  // inSessionConfirmed 제거 (item 2)
}) {
  const hasPair   = word.type === 'word' && word.antonymId && selectedWordIds.has(word.antonymId);
  const typeBadge = TYPE_META[word.type] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  const badgeText = word.type === 'word'
    ? (word.tags?.[0] ?? '단어')
    : CATEGORY_META[word.type]?.label ?? word.type;

  // TTS 자동 재생: 앞면 노출 시 즉시 재생 (item 1)
  // !showAnswer = 카드 앞면이 보일 때, 모드 무관하게 단일화
  useTTS(word.hiragana, !showAnswer);

  return (
    <div className="max-w-md w-full mb-4 h-[480px]">
      <div
        className={`w-full h-full bg-white rounded-3xl shadow-xl overflow-y-auto flex flex-col
          relative border border-slate-100 transition-all duration-300
          ${animateCard ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}
      >
        {/* 배지 영역 */}
        <div className="absolute top-4 left-4 flex gap-1.5 z-10 flex-wrap max-w-[70%]">
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

        {/* 앞/뒷면 렌더링 */}
        {!showAnswer ? (
          <CardFront
            word={word}
            onCardClick={onCardClick}
            reverseMode={reverseMode}
            blindMode={blindMode}
          />
        ) : (
          <CardBack
            word={word}
            onCardClick={onCardClick}
            reverseMode={reverseMode}
          />
        )}
      </div>
    </div>
  );
}
