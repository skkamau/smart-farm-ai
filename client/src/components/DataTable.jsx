export default function DataTable({ columns, rows, emptyText, actions }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  {column.label}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={columns.length + (actions ? 1 : 0)}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row._id} className="hover:bg-farm-50/50">
                  {columns.map((column) => (
                    <td key={column.key} className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                  {actions && <td className="px-4 py-3 text-right">{actions(row)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
