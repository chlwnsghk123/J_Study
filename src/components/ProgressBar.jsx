export default function ProgressBar({ mastered, total }) {
  const percent = total > 0 ? (mastered / total) * 100 : 0;

  return (
    <div className="max-w-md w-full mb-3">
      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-sky-500 h-1.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
