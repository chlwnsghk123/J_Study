import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { askAI } from '../lib/gemini';

// ─── 마크다운 인라인 파서 ────────────────────────────────────────
function parseInline(line, lineKey) {
  const parts = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0, m, ki = 0;
  while ((m = regex.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    if (m[1] != null)
      parts.push(<strong key={`${lineKey}-${ki++}`} className="font-bold">{m[1]}</strong>);
    else if (m[2] != null)
      parts.push(<em key={`${lineKey}-${ki++}`} className="italic">{m[2]}</em>);
    else if (m[3] != null)
      parts.push(
        <code key={`${lineKey}-${ki++}`} className="bg-black/10 px-1 rounded text-xs font-mono">
          {m[3]}
        </code>
      );
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

function MarkdownText({ text }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        const isBullet = /^[-•*]\s/.test(line);
        const content  = isBullet ? line.slice(2) : line;
        return (
          <span key={i} className="block">
            {isBullet && <span className="mr-1 select-none">·</span>}
            {parseInline(content, i)}
          </span>
        );
      })}
    </>
  );
}

function stripBold(text) {
  return text?.replace(/\*\*/g, '') ?? '';
}

// ─── 추천 질문 ────────────────────────────────────────────────────
const SUGGESTED_QUESTIONS = [
  { label: '문장 분석', prompt: '이 문장을 분석해줘. 일본어 발음을 같이 표기해줘.' },
  { label: '비슷한 예시', prompt: '비슷한 예시 문장을 만들어줘. 일본어 발음을 같이 표기해줘.' },
  { label: '단어 뜻', prompt: '각 단어 뜻을 알려줘. 일본어 발음을 같이 표기해줘.' },
];

export default function AiChatModal({ currentCard, onClose, messages, setMessages }) {
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);
  const sheetRef                = useRef(null);
  const scrollRef               = useRef(null);

  // 드래그 상태
  const dragStartY    = useRef(null);
  const dragDeltaY    = useRef(0);
  const isDragging    = useRef(false);   // 드래그 확정 여부
  const isScrollArea  = useRef(false);   // 스크롤 영역에서 시작했는지

  // 새 메시지마다 스크롤 하단 이동
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const userMsg = { id: Date.now(), role: 'user', text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!textOverride) setInput('');
    setLoading(true);

    try {
      const answer = await askAI(currentCard, text, messages);
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'ai', text: answer }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: 'AI 응답 중 오류가 발생했습니다. API 키를 확인해 주세요.',
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ── 시트 translateY 적용 ─────────────────────────────────────
  const applyTranslate = useCallback((dy, animated = false) => {
    if (!sheetRef.current) return;
    if (animated) {
      sheetRef.current.style.transition = 'transform 0.25s ease';
    } else {
      sheetRef.current.style.transition = 'none';
    }
    sheetRef.current.style.transform = `translateY(${Math.max(0, dy)}px)`;
  }, []);

  const closeWithAnimation = useCallback(() => {
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.25s ease';
      sheetRef.current.style.transform = 'translateY(100%)';
    }
    setTimeout(onClose, 250);
  }, [onClose]);

  // ── 시트 전체 터치 드래그 (핸들 + 메시지 영역) ──────────────
  const handleTouchStart = useCallback((e) => {
    // 입력 영역 터치는 무시
    const tag = e.target.closest('textarea, button, input');
    if (tag) return;

    dragStartY.current = e.touches[0].clientY;
    dragDeltaY.current = 0;
    isDragging.current = false;

    // 스크롤 영역 내에서 시작했는지 확인
    isScrollArea.current = !!e.target.closest('[data-scroll-area]');
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;

    // 스크롤 영역에서 시작한 경우: 스크롤이 맨 위에 있을 때만 드래그 허용
    if (isScrollArea.current && !isDragging.current) {
      const scrollEl = scrollRef.current;
      if (scrollEl && scrollEl.scrollTop > 0) {
        // 스크롤 중이면 드래그 안 함
        dragStartY.current = null;
        return;
      }
      // 위로 드래그(dy < 0)는 스크롤에 위임
      if (dy < 0) {
        dragStartY.current = null;
        return;
      }
    }

    // 아래로 10px 이상 이동하면 드래그 확정
    if (!isDragging.current && dy > 10) {
      isDragging.current = true;
    }

    if (isDragging.current && dy > 0) {
      e.preventDefault(); // 브라우저 스크롤 차단
      dragDeltaY.current = dy;
      applyTranslate(dy);
    }
  }, [applyTranslate]);

  const handleTouchEnd = useCallback(() => {
    if (dragStartY.current === null) return;
    const dy = dragDeltaY.current;
    const wasDragging = isDragging.current;
    dragStartY.current = null;
    isDragging.current = false;

    if (!wasDragging) return;

    if (dy > 80) {
      closeWithAnimation();
    } else {
      applyTranslate(0, true);
    }
  }, [applyTranslate, closeWithAnimation]);

  // ── 마우스 드래그 (PC) ──────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    const tag = e.target.closest('textarea, button, input');
    if (tag) return;

    e.preventDefault();
    dragStartY.current = e.clientY;
    dragDeltaY.current = 0;
    isDragging.current = false;
    isScrollArea.current = !!e.target.closest('[data-scroll-area]');

    const onMouseMove = (ev) => {
      if (dragStartY.current === null) return;
      const dy = ev.clientY - dragStartY.current;

      if (isScrollArea.current && !isDragging.current) {
        const scrollEl = scrollRef.current;
        if (scrollEl && scrollEl.scrollTop > 0) { dragStartY.current = null; return; }
        if (dy < 0) { dragStartY.current = null; return; }
      }

      if (!isDragging.current && dy > 10) isDragging.current = true;

      if (isDragging.current && dy > 0) {
        dragDeltaY.current = dy;
        applyTranslate(dy);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      handleTouchEnd();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [applyTranslate, handleTouchEnd]);

  return (
    /* 오버레이 */
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={onClose}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* 반투명 배경 */}
      <div className="absolute inset-0 bg-black/40" />

      {/* 바텀 시트 */}
      <div
        ref={sheetRef}
        className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[75vh]"
        style={{ touchAction: 'none' }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >

        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center gap-2 px-5 pt-1 pb-3 border-b border-slate-100 shrink-0">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <span className="font-bold text-slate-700 text-sm">AI 질문</span>
          <span className="ml-1 text-xs text-slate-400 truncate flex-1 min-w-0">
            {stripBold(currentCard.pron)} · {currentCard.meaning}
          </span>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 메시지 영역 */}
        <div
          ref={scrollRef}
          data-scroll-area
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
          style={{ touchAction: 'pan-y' }}
        >
          {messages.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6">
              이 카드에 대해 궁금한 점을 질문해 보세요.
            </p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                  msg.role === 'user'
                    ? 'bg-sky-500 text-white rounded-br-sm whitespace-pre-wrap'
                    : msg.error
                      ? 'bg-rose-50 text-rose-600 border border-rose-100 rounded-bl-sm'
                      : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                }`}
              >
                {msg.role === 'user'
                  ? msg.text
                  : <MarkdownText text={msg.text} />}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                <span className="text-xs text-slate-400">답변 생성 중...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* 추천 질문 버튼 */}
        {messages.length === 0 && !loading && (
          <div className="flex gap-2 px-4 pb-2 shrink-0 flex-wrap">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q.label}
                onClick={() => handleSend(q.prompt)}
                className="text-xs font-medium text-violet-600 bg-violet-50 border border-violet-200
                  hover:bg-violet-100 transition-colors px-3 py-1.5 rounded-full"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}

        {/* 입력 영역 */}
        <div className="flex items-end gap-2 px-4 py-3 border-t border-slate-100 shrink-0" style={{ touchAction: 'auto' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="질문을 입력하세요"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50
              px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400
              focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300
              max-h-24 overflow-y-auto"
            style={{ fieldSizing: 'content', touchAction: 'auto' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            aria-label="전송"
            className={`p-2.5 rounded-2xl transition-colors shrink-0 ${
              input.trim() && !loading
                ? 'bg-sky-500 hover:bg-sky-600 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
