import { Button } from './Button'

export function Pagination({
  page,
  totalPages,
  total,
  pageSize = 20,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  pageSize?: number
  onPageChange: (page: number) => void
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const safeTotalPages = Math.max(totalPages, 1)

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 pt-3 pb-1 text-xs text-slate-500 border-t border-slate-100"
      aria-label="Paginación"
    >
      <span className="text-[11px] font-medium text-slate-600">
        {total > 0 ? (
          <>
            <strong className="text-slate-900">{start}–{end}</strong> de{' '}
            <strong className="text-slate-900">{total}</strong> registros
          </>
        ) : (
          '0 registros'
        )}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="small"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹ Anterior
        </Button>
        <span className="px-1 text-[11px] text-slate-400">
          Página {page} de {safeTotalPages}
        </span>
        <Button
          variant="secondary"
          size="small"
          disabled={page >= totalPages || totalPages === 0}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente ›
        </Button>
      </div>
    </div>
  )
}
