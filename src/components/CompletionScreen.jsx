import { CheckCircle2, RefreshCw } from 'lucide-react';

export default function CompletionScreen({ totalActiveWords, onReset }) {
  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden p-8 text-center border-t-8 border-emerald-400">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">학습 완료</h2>
        <p className="text-slate-600 mb-8 text-lg">
          선택한 {totalActiveWords}개의 단어를 확인했다.
        </p>
        <button
          onClick={onReset}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-sky-200 flex items-center justify-center gap-2 text-lg"
        >
          <RefreshCw className="w-5 h-5" /> 첫 화면으로
        </button>
      </div>
    </div>
  );
}
