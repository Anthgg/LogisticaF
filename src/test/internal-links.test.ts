import { describe, expect, it } from 'vitest'
import { extractRouteGuards } from './route-guards'
import ROUTER_SOURCE from '../router/AppRouter.tsx?raw'

/**
 * Todo destino de navegación interna (`navigate(...)` y `to=`) debe
 * corresponder a una ruta declarada en AppRouter.
 *
 * Este test detecta enlaces muertos como el prefijo `/logistics/quality-inspection-plans`
 * —que es el endpoint del backend, no la ruta de la UI (`/logistics/quality/plans`)—
 * antes de que lleguen a producción como un 404.
 */

// Solo .tsx: `navigate(...)` y `to=` viven en componentes y páginas.
const SOURCES = import.meta.glob('/src/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const ROUTE_PATTERNS = extractRouteGuards(ROUTER_SOURCE)
  .map((row) => row.path)
  .filter((path) => path.startsWith('/'))
  .map((path) => ({
    path,
    regex: new RegExp(`^${path.replace(/:[A-Za-z0-9_]+/g, '[^/]+')}$`),
  }))

function isDeclaredRoute(target: string): boolean {
  return ROUTE_PATTERNS.some((route) => route.regex.test(target))
}

/** `/logistics/x/${id}?a=1` → `/logistics/x/X` */
function normalizeTarget(raw: string): string {
  const withoutQuery = raw.replace(/\$\{[^}]*\}/g, 'X').split('?')[0]
  return withoutQuery.replace(/\/$/, '') || '/'
}

function collectTargets(source: string): Array<{ target: string; line: number }> {
  const found: Array<{ target: string; line: number }> = []
  const expressions = [
    /navigate\(\s*[`'"]([^`'"]+)[`'"]/g,
    /\bto=\{?\s*[`'"]([^`'"]+)[`'"]/g,
  ]

  for (const expression of expressions) {
    for (const match of source.matchAll(expression)) {
      if (!match[1].startsWith('/')) continue
      found.push({
        target: match[1],
        line: source.slice(0, match.index).split('\n').length,
      })
    }
  }

  return found
}

describe('enlaces internos', () => {
  it('el catálogo de rutas y de fuentes se pudo leer', () => {
    expect(ROUTE_PATTERNS.length).toBeGreaterThan(100)
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100)
  })

  it('todo navigate() y to= apunta a una ruta declarada en AppRouter', () => {
    const broken: string[] = []

    for (const [file, source] of Object.entries(SOURCES)) {
      if (file.endsWith('/router/AppRouter.tsx')) continue
      for (const { target, line } of collectTargets(source)) {
        if (isDeclaredRoute(normalizeTarget(target))) continue
        broken.push(`${file}:${line} → ${target}`)
      }
    }

    expect(broken, `Enlaces sin ruta declarada:\n${broken.join('\n')}`).toEqual([])
  })
})
