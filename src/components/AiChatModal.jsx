import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { askAI } from '../lib/gemini';

// ─── 마크다운 인라인 파서 ────────────────────────────────────────
// **굵게**, *기울임*, `코드` 패턴을 React 엘리먼트로 변환
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

// 줄바꿈·불릿(- )·빈 줄 처리 포함
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

// ** 마크다운 제거 (제목 표시용)
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
  const dragStartY              = useRef(null);
  const dragDeltaY              = useRef(0);
  const handleRef               = useRef(null);

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
      // 대화 히스토리 전달 (현재 질문 제외)
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

  // ── 드래그 핸들로 닫기 ──────────────────────────────────────
  const handleHandleTouchStart = (e) => {
    dragStartY.current = e.touches[0].clientY;
    dragDeltaY.current = 0;
  };

  const handleHandleTouchMove = (e) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    dragDeltaY.current = dy;
    if (dy > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
      sheetRef.current.style.transition = 'none';
    }
  };

  const handleHandleTouchEnd = () => {
    if (dragStartY.current === null) return;
    const dy = dragDeltaY.current;
    dragStartY.current = null;
    if (dy > 80) {
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.2s ease';
        sheetRef.current.style.transform = 'translateY(100%)';
      }
      setTimeout(onClose, 200);
    } else if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.2s ease';
      sheetRef.current.style.transform = 'translateY(0)';
    }
  };

  // 마우스 드래그도 지원
  const handleHandleMouseDown = (e) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragDeltaY.current = 0;

    const onMouseMove = (ev) => {
      if (dragStartY.current === null) return;
      const dy = ev.clientY - dragStartY.current;
      dragDeltaY.current = dy;
      if (dy > 0 && sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${dy}px)`;
        sheetRef.current.style.transition = 'none';
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      handleHandleTouchEnd();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    /* 오버레이 — 빈 공간 클릭 시 닫기 */
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={onClose}
    >
      {/* 반투명 배경 */}
      <div className="absolute inset-0 bg-black/40" />

      {/* 바텀 시트 */}
      <div
        ref={sheetRef}
        className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >

        {/* 드래그 핸들 — 터치/마우스로 아래로 끌어서 닫기 */}
        <div
          ref={handleRef}
          className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing"
          onTouchStart={handleHandleTouchStart}
          onTouchMove={handleHandleTouchMove}
          onTouchEnd={handleHandleTouchEnd}
          onMouseDown={handleHandleMouseDown}
        >
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
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
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
        <div className="flex items-end gap-2 px-4 py-3 border-t border-slate-100 shrink-0">
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
            style={{ fieldSizing: 'content' }}
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
