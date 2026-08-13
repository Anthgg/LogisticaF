import type { DecimalString } from './types/inventory-balances'

/**
 * Utilidades decimales de Fase 045.
 *
 * El backend expone las cantidades como `Numeric(38,18)`. Un valor como
 * `12345678901234567890.123456789012345678` no cabe en un `number` de
 * JavaScript, así que aquí NUNCA se usa `Number()` ni `parseFloat()`:
 * todo se opera sobre la cadena original.
 */

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

/** Normaliza a string sin perder dígitos, aceptando lo que devuelva el JSON. */
export function toDecimalString(value: unknown): DecimalString {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'bigint') return value.toString()
  return '0'
}

export function isDecimalString(value: string): boolean {
  return DECIMAL_PATTERN.test(value.trim())
}

/** `true` si el valor decimal es exactamente cero, sin convertir a número. */
export function isZeroDecimal(value: DecimalString): boolean {
  const trimmed = value.trim().replace(/^[+-]/, '')
  if (!trimmed) return true
  return /^0*(\.0*)?$/.test(trimmed)
}

export function isNegativeDecimal(value: DecimalString): boolean {
  return value.trim().startsWith('-') && !isZeroDecimal(value)
}

interface FormatOptions {
  /** Decimales a mostrar. Se trunca, nunca se redondea con aritmética flotante. */
  maximumFractionDigits?: number
  /** Elimina los ceros finales de la parte decimal. */
  trimTrailingZeros?: boolean
}

/**
 * Formatea para la UI agrupando miles, operando solo con strings.
 * El valor canónico completo debe seguir disponible (por ejemplo en `title`).
 */
export function formatDecimal(
  value: DecimalString,
  { maximumFractionDigits = 3, trimTrailingZeros = true }: FormatOptions = {},
): string {
  const raw = toDecimalString(value)
  if (!isDecimalString(raw)) return raw

  const negative = raw.startsWith('-')
  const unsigned = raw.replace(/^[+-]/, '')
  const [integerPart, fractionPart = ''] = unsigned.split('.')

  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

  let fraction = fractionPart.slice(0, maximumFractionDigits)
  if (trimTrailingZeros) fraction = fraction.replace(/0+$/, '')

  const body = fraction ? `${groupedInteger},${fraction}` : groupedInteger
  return negative ? `-${body}` : body
}

/** Indica si el formateo ocultó dígitos, para poder advertirlo en la UI. */
export function isTruncatedByFormat(
  value: DecimalString,
  maximumFractionDigits = 3,
): boolean {
  const raw = toDecimalString(value)
  const [, fraction = ''] = raw.replace(/^[+-]/, '').split('.')
  return fraction.replace(/0+$/, '').length > maximumFractionDigits
}
