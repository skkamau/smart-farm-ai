export default function DataTable({ columns, rows, emptyText, actions }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-farm-100 text-sm">
          <thead className="bg-field-mist">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-farm-800/70">
                  {column.label}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-farm-800/70">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-farm-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={columns.length + (actions ? 1 : 0)}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row._id} className="hover:bg-field-cream">
                  {columns.map((column) => (
                    <td key={column.key} className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
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
