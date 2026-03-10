export default function ProgressBar({ mastered, total }) {
  const percent = total > 0 ? (mastered / total) * 100 : 0;

  return (
    <div className="max-w-md w-full mb-6">
      <div className="flex justify-between items-end mb-2 px-2">
        <span className="text-sm font-bold text-slate-500">마스터 현황</span>
        <span className="text-lg font-bold text-sky-600">{mastered} / {total}</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
        <div
          className="bg-sky-500 h-3 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
