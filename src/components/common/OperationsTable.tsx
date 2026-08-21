import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'

export interface TableColumn<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
  align?: 'left' | 'right'
}

export function OperationsTable<T>({
  rows,
  columns,
  getRowKey,
  emptyMessage = 'No hay registros para mostrar.',
}: {
  rows?: T[]
  columns: TableColumn<T>[]
  getRowKey: (row: T) => string
  emptyMessage?: string
}) {
  const safeRows = rows ?? []
  if (safeRows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="Sin registros operativos"
          description={emptyMessage}
          icon="archive"
        />
      </div>
    )
  }

  return (
    <div className="operations-table w-full overflow-x-auto [webkit-overflow-scrolling:touch]">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/90">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`text-slate-500 font-semibold text-[10px] uppercase tracking-wider px-3.5 py-2.5 whitespace-nowrap ${
                  column.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {safeRows.map((row) => (
            <tr key={getRowKey(row)} className="group hover:bg-slate-50/80 transition-colors">
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.label || 'Acciones'}
                  className={`px-3.5 py-2.5 text-slate-800 align-middle ${
                    column.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
