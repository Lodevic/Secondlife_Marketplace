export default function DataTable({
  columns,
  rows,
  getRowKey = (row, index) => row.id ?? index,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
            {columns.map((column) => (
              <th key={column.key} scope="col" className="px-3 py-2.5">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={getRowKey(row, index)} className="text-slate-700">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-3 align-top">
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
