import { describe, expect, it } from 'vitest'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'

/**
 * Guardia contra la reintroducción del namespace de permisos legacy.
 *
 * `logistics.inbound_docks.*` no existe en el catálogo RBAC del backend
 * (`backend/app/modules/logistics/rbac/permission_catalog.py`). Cualquier
 * comprobación basada en él deja la capability en `false` para siempre y
 * bloquea la UI en silencio. La autoridad es `LOGISTICS_PERMISSIONS`.
 */

const LEGACY_NAMESPACE = 'logistics.inbound_docks.'

/**
 * Únicos archivos autorizados a nombrar el namespace legacy, y solo porque su
 * cometido es precisamente demostrar que ya NO concede acceso.
 */
const ALLOWED_FIXTURES = [
  '/src/features/inbound-docks/test/no-legacy-permissions.test.ts',
  '/src/features/inbound-docks/test/InboundDocksCanonicalRbac.test.tsx',
]

// Todo el frontend salvo dependencias y artefactos de build.
const SOURCES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('permisos legacy de inbound docks', () => {
  it('el corpus de fuentes se pudo leer', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100)
  })

  it('ningún archivo de src/ contiene el namespace legacy', () => {
    const offenders = Object.entries(SOURCES)
      .filter(([file, source]) => {
        if (ALLOWED_FIXTURES.includes(file)) return false
        return source.includes(LEGACY_NAMESPACE)
      })
      .map(([file]) => file)

    expect(
      offenders,
      `Usa LOGISTICS_PERMISSIONS.inboundDocks en lugar de ${LEGACY_NAMESPACE}*:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('el mapa canónico no define capabilities bajo el namespace legacy', () => {
    const codes = Object.values(LOGISTICS_PERMISSIONS.inboundDocks)

    for (const code of codes) {
      expect(code.startsWith(LEGACY_NAMESPACE), `${code} pertenece al namespace legacy`).toBe(false)
    }
    expect(codes.length).toBeGreaterThan(0)
  })

  it('las capabilities migradas apuntan a los códigos reales del backend', () => {
    expect(LOGISTICS_PERMISSIONS.inboundDocks.view).toBe('logistics.inbound_dock_queue.read')
    expect(LOGISTICS_PERMISSIONS.inboundDocks.viewQueue).toBe('logistics.inbound_dock_queue.read')
    expect(LOGISTICS_PERMISSIONS.inboundDocks.changePriority).toBe(
      'logistics.inbound_dock_queue.change_priority',
    )
    expect(LOGISTICS_PERMISSIONS.inboundDocks.complete).toBe(
      'logistics.unloading_operations.complete',
    )
  })
})
