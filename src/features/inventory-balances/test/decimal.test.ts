import { describe, expect, it } from 'vitest'
import {
  formatDecimal,
  isNegativeDecimal,
  isTruncatedByFormat,
  isZeroDecimal,
  toDecimalString,
} from '../decimal'
import { normalizePositionBalance, normalizeSummary } from '../api/inventory-balances-api'

/** El caso obligatorio del contrato: Numeric(38,18) fuera del rango de `number`. */
const LONG_DECIMAL = '12345678901234567890.123456789012345678'

describe('precisión decimal', () => {
  it('conserva íntegro un Numeric(38,18) sin pasar por Number()', () => {
    expect(toDecimalString(LONG_DECIMAL)).toBe(LONG_DECIMAL)
    // Prueba de que la conversión numérica SÍ habría perdido dígitos.
    expect(String(Number(LONG_DECIMAL))).not.toBe(LONG_DECIMAL)
  })

  it('el resumen normalizado mantiene la cadena original en las 8 métricas', () => {
    const payload = {
      physical_on_hand: LONG_DECIMAL,
      available_to_promise: LONG_DECIMAL,
      reserved_stock: LONG_DECIMAL,
      blocked_stock: LONG_DECIMAL,
      quarantine_stock: LONG_DECIMAL,
      in_transit_stock: LONG_DECIMAL,
      damaged_stock: LONG_DECIMAL,
      expired_stock: LONG_DECIMAL,
    }
    const summary = normalizeSummary(payload)

    for (const value of Object.values(summary)) {
      expect(value).toBe(LONG_DECIMAL)
    }
    expect(Object.keys(summary)).toHaveLength(8)
  })

  it('el detalle de posición mantiene la cantidad exacta', () => {
    const balance = normalizePositionBalance({ quantity: LONG_DECIMAL })
    expect(balance.quantity).toBe(LONG_DECIMAL)
  })

  it('rellena con 0 las métricas ausentes en vez de romper', () => {
    const summary = normalizeSummary({})
    expect(summary.physical_on_hand).toBe('0')
    expect(Object.keys(summary)).toHaveLength(8)
  })

  it('formatea para la UI sin tocar el valor canónico', () => {
    expect(formatDecimal('1234567.891234')).toBe('1 234 567,891')
    expect(formatDecimal('1000')).toBe('1 000')
    expect(formatDecimal('0.500000')).toBe('0,5')
    expect(formatDecimal(LONG_DECIMAL)).toBe('12 345 678 901 234 567 890,123')
    expect(isTruncatedByFormat(LONG_DECIMAL)).toBe(true)
    expect(isTruncatedByFormat('12.5')).toBe(false)
  })

  it('detecta cero y negativo sin aritmética flotante', () => {
    expect(isZeroDecimal('0')).toBe(true)
    expect(isZeroDecimal('0.000000000000000000')).toBe(true)
    expect(isZeroDecimal('-0.00')).toBe(true)
    expect(isZeroDecimal('0.000000000000000001')).toBe(false)
    expect(isNegativeDecimal('-15.2')).toBe(true)
    expect(isNegativeDecimal('15.2')).toBe(false)
    expect(isNegativeDecimal('-0.0')).toBe(false)
  })
})
