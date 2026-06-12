export function DataTable({ columns, rows = [], empty = "No data yet", minWidth = 720, compact = false }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`${compact ? "px-3 py-2" : "px-4 py-3"} font-semibold`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={`${compact ? "px-3" : "px-4"} py-8 text-center text-slate-500 dark:text-slate-400`} colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : rows.map((row, index) => (
            <tr key={row.id || index} className="border-t border-slate-100 dark:border-slate-800">
              {columns.map((column) => (
                <td key={column.key} className={`${compact ? "px-3 py-2.5" : "px-4 py-3"} align-top text-slate-700 dark:text-slate-200`}>
                  {column.render ? column.render(row) : (row[column.key] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
