import type { ReactNode } from 'react'
import { LogisticsIcon } from './LogisticsIcon'

export function QueryBar({
  search,
  onSearch,
  placeholder = 'Buscar por nombre, código o documento…',
  className = '',
  children,
}: {
  search: string
  onSearch: (value: string) => void
  placeholder?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 mb-3.5 ${className}`.trim()}>
      <div className="relative flex-1 min-w-[260px] max-w-[420px]">
        <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
          <LogisticsIcon name="search" size={14} aria-hidden="true" />
        </span>
        <input
          type="search"
          value={search}
          placeholder={placeholder}
          aria-label="Buscar"
          onChange={(event) => onSearch(event.target.value)}
          className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 text-xs text-slate-900 shadow-xs transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch('')}
            className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            aria-label="Limpiar búsqueda"
          >
            <LogisticsIcon name="x" size={12} />
          </button>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
