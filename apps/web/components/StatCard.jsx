export function StatCard({ label, value, hint }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{value}</div>
      {hint ? <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </div>
  );
}
