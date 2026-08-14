import { describe, expect, it } from 'vitest'

/**
 * Guardia de contrato de API.
 *
 * Impide reintroducir rutas que el backend NO publica. Cada una fue verificada
 * contra el router real (`Anthgg/Logistica` @ main) y produce 404 —o 422 cuando
 * un literal estático cae en un path param UUID— si se vuelve a llamar.
 *
 * La lista no es una allowlist de errores tolerados: son rutas prohibidas.
 */

// path inexistente -> por qué / cuál es el contrato real
const FORBIDDEN_ROUTES: Record<string, string> = {
  '/logistics/inbound/dock-assignments':
    'el recurso real es /logistics/inbound-dock-assignments',
  '/logistics/inbound/unloading':
    'el recurso real es /logistics/unloading-operations',
  '/logistics/inbound/dock-metrics':
    'el backend no publica un resumen de métricas de muelles',
  '/logistics/putaway/scan':
    'el escaneo real es POST /logistics/putaway/sessions/{session_id}/scans',
  '/logistics/putaway/users/':
    'el backend no publica endpoints de putaway por usuario',
  '/logistics/vehicle-verifications/stats':
    'no existe /stats: "stats" caería en {verification_id} y daría 422',
  '/logistics/quality-inspection-plans/summary':
    'no existe /summary: "summary" caería en {plan_id} y daría 422',
  '/logistics/procurement/requisitions/stats':
    'no existe /stats: caería en {requisition_id} y daría 422',
}

/**
 * Archivos autorizados a nombrar una ruta prohibida, y solo porque su cometido
 * es precisamente prohibirla o documentar por qué se retiró.
 */
const ALLOWED = [
  '/src/test/api-contract-guard.test.ts',
  '/src/features/inbound-docks/test/supported-query-scope.test.ts',
  '/src/features/putaway/api/putawayMobileApi.ts',
]

const SOURCES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Las rutas de la UI comparten forma con algunas rutas de API prohibidas. */
function isUiRouteUsage(line: string): boolean {
  return (
    line.includes('navigate(') ||
    line.includes('<Route') ||
    /\bto=/.test(line) ||
    /path="\/logistics/.test(line)
  )
}

describe('contrato de API', () => {
  it('el corpus de fuentes se pudo leer', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100)
  })

  it('ninguna llamada de API usa una ruta que el backend no publica', () => {
    const offenders: string[] = []

    for (const [file, source] of Object.entries(SOURCES)) {
      if (ALLOWED.includes(file)) continue
      const lines = source.split('\n')
      lines.forEach((line, index) => {
        if (isUiRouteUsage(line)) return
        for (const [route, reason] of Object.entries(FORBIDDEN_ROUTES)) {
          if (line.includes(route)) {
            offenders.push(`${file}:${index + 1} → ${route} (${reason})`)
          }
        }
      })
    }

    expect(offenders, `Rutas fuera de contrato:\n${offenders.join('\n')}`).toEqual([])
  })

  it('las bases canónicas de muelles apuntan al contrato real', async () => {
    const { INBOUND_DOCK_ASSIGNMENTS_BASE, UNLOADING_OPERATIONS_BASE } = await import(
      '../features/inbound-docks/hooks/useInboundDocksQueries'
    )

    expect(INBOUND_DOCK_ASSIGNMENTS_BASE).toBe('/logistics/inbound-dock-assignments')
    expect(UNLOADING_OPERATIONS_BASE).toBe('/logistics/unloading-operations')
  })

  it('ninguna ruta de API duplica el prefijo /api', () => {
    const offenders: string[] = []

    for (const [file, source] of Object.entries(SOURCES)) {
      // Los tests sí comprueban la URL ya compuesta (con /api), es su cometido.
      if (/\.(test|spec)\.[tj]sx?$/.test(file)) continue
      for (const match of source.matchAll(/path:\s*[`'"](\/api\/[^`'"]+)/g)) {
        offenders.push(`${file} → ${match[1]}`)
      }
    }

    // API_URL ya aporta /api: repetirlo produce /api/api/...
    expect(offenders, `Prefijo /api duplicado:\n${offenders.join('\n')}`).toEqual([])
  })
})
