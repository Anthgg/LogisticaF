import { formatDecimal, isNegativeDecimal, isTruncatedByFormat } from '../decimal'
import type { DecimalString } from '../types/inventory-balances'

interface DecimalDisplayProps {
  value: DecimalString
  className?: string
  maximumFractionDigits?: number
}

/**
 * Muestra una cantidad decimal del backend sin perder precisión.
 *
 * El texto visible se agrupa y trunca solo para la UI; el valor canónico
 * completo queda siempre accesible en el `title` del elemento.
 */
export function DecimalDisplay({
  value,
  className,
  maximumFractionDigits = 3,
}: DecimalDisplayProps) {
  const formatted = formatDecimal(value, { maximumFractionDigits })
  const truncated = isTruncatedByFormat(value, maximumFractionDigits)

  return (
    <span
      className={`tabular-nums ${isNegativeDecimal(value) ? 'text-rose-600' : ''} ${className ?? ''}`}
      title={truncated ? `Valor exacto: ${value}` : value}
      data-testid="decimal-display"
      data-exact={value}
    >
      {formatted}
      {truncated && (
        <span className="ml-0.5 text-slate-400" aria-hidden="true">
          …
        </span>
      )}
    </span>
  )
}
