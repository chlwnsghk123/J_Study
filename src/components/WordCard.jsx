import { Volume2, RotateCcw } from 'lucide-react';
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

// ─── 카드 앞면 ────────────────────────────────────────────────────
function CardFront({ word, onCardClick, reverseMode, blindMode }) {
  const pronSize    = getPronSizeClass(word.pron, word.type);
  const meaningSize = getMeaningSizeClass(word.meaning, word.type);
  const catMeta     = CATEGORY_META[word.type];

  // 블라인드 모드: 텍스트 없이 오디오만
  if (blindMode) {
    return (
      <button
        onClick={onCardClick}
        className="flex-1 flex flex-col items-center justify-center p-8 w-full cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <Volume2 className="w-20 h-20 text-sky-200 mb-6" />
        <button
          onClick={(e) => { e.stopPropagation(); speakText(word.hiragana, { rate: 0.7 }); }}
          className="text-sky-400 font-semibold text-sm hover:text-sky-600 flex items-center gap-1.5 mb-4"
        >
          <RotateCcw className="w-4 h-4" /> 다시 듣기 (천천히)
        </button>
        <span className="text-slate-300 text-xs">탭하여 뜻 확인</span>
      </button>
    );
  }

  // 리버스 모드: 뜻을 앞에 표시, TTS 자동 재생
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
          className={`${meaningSize} font-black text-slate-800 mb-4 break-keep text-center
            group-hover:scale-105 transition-transform leading-tight`}
        >
          {word.meaning}
        </h2>
        <span className="flex items-center gap-1 text-slate-300 text-xs font-medium mb-2">
          <Volume2 className="w-3.5 h-3.5" /> 자동 재생 중
        </span>
        <span className="text-sky-400 font-semibold text-sm">탭하여 발음 확인</span>
      </button>
    );
  }

  // 기본 모드: 발음(pron)을 앞에 표시
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
      <span className="text-lg font-medium text-slate-300 mb-4 text-center">
        {word.hiragana}
      </span>
      <span className="text-sky-400 font-semibold text-sm mt-2">탭하여 뜻 확인</span>
    </button>
  );
}

// ─── 카드 뒷면 ────────────────────────────────────────────────────
function CardBack({ word, onCardClick, reverseMode, inSessionConfirmed }) {
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

      {/* 정중체 + 재생 버튼 */}
      <div className="w-full flex items-center justify-between mt-auto pt-1">
        <PolitenessTag politeness={word.politeness} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            speakText(word.hiragana, { rate: 0.7 });
          }}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-sky-500 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> 천천히 듣기
        </button>
      </div>

      {/* 재확인 필요 안내 */}
      <div className={`w-full text-center text-xs font-bold py-2.5 rounded-xl mt-2 ${
        inSessionConfirmed
          ? 'bg-amber-100 text-amber-600'
          : 'bg-slate-100 text-slate-400'
      }`}>
        {inSessionConfirmed
          ? '1회 확인 완료 — 한 번 더 맞히면 마스터!'
          : '다시 탭 → 미숙지로 뒤로 이동'}
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
  reverseMode        = false,
  blindMode          = false,
  inSessionConfirmed = false, // 이미 1번 정답 처리된 카드
}) {
  const hasPair   = word.type === 'word' && word.antonymId && selectedWordIds.has(word.antonymId);
  const typeBadge = TYPE_META[word.type] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  const badgeText = word.type === 'word'
    ? (word.tags?.[0] ?? '단어')
    : CATEGORY_META[word.type]?.label ?? word.type;

  // TTS 자동 재생 트리거
  // - 기본 모드: 뒷면(showAnswer=true) 시 재생
  // - 리버스/블라인드 모드: 앞면(!showAnswer) 시 재생
  const autoPlay = (reverseMode || blindMode) ? !showAnswer : showAnswer;
  useTTS(word.hiragana, autoPlay);

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

        {/* TTS 아이콘 */}
        {showAnswer && !blindMode && (
          <div className="absolute top-4 right-4 z-10">
            <span className="flex items-center gap-1 text-xs text-slate-300 font-medium">
              <Volume2 className="w-3.5 h-3.5" /> 자동 재생
            </span>
          </div>
        )}

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
            inSessionConfirmed={inSessionConfirmed}
          />
        )}
      </div>
    </div>
  );
}
