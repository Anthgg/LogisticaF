import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../common/Button'

export interface EntityFormBreadcrumb {
  label: string
  to?: string
}

interface EntityFormPageProps {
  title: string
  description?: string
  breadcrumbs: EntityFormBreadcrumb[]
  children: ReactNode
  summary: ReactNode
  submitLabel: string
  isSaving?: boolean
  isSubmitDisabled?: boolean
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function EntityFormPage({
  title,
  description,
  breadcrumbs,
  children,
  summary,
  submitLabel,
  isSaving = false,
  isSubmitDisabled = false,
  onCancel,
  onSubmit,
}: EntityFormPageProps) {
  return (
    <div className="w-full space-y-4">
      <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        {breadcrumbs.map((item, index) => (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 && <span aria-hidden="true">/</span>}
            {item.to ? (
              <Link className="hover:text-slate-900 hover:underline" to={item.to}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-slate-700">
                {item.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <header>
        <h1 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
      </header>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">{children}</div>
          <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start" aria-label="Resumen contextual">
            {summary}
          </aside>
        </div>

        <div className="sticky bottom-0 z-20 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-1 py-3 backdrop-blur-sm">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            isLoading={isSaving}
            loadingLabel="Guardando…"
            disabled={isSubmitDisabled}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}
