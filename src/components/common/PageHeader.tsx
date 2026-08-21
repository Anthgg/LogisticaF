import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col items-stretch justify-between gap-3 border-b border-slate-200/80 pb-3 mb-3.5 sm:flex-row sm:items-center">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-bold text-orange uppercase tracking-widest mb-0.5">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[20px] sm:text-[22px] font-bold text-ink tracking-tight leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-muted mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center justify-start gap-2 sm:justify-end">{actions}</div>}
    </header>
  )
}
