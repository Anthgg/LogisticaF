/**
 * Extrae de `AppRouter.tsx` cada `path` con las permissions que lo protegen.
 *
 * Se usa en los tests de navegación para comprobar que el permiso declarado en
 * el navbar coincide con el guard real de la ruta. El parser recorre el JSX
 * carácter a carácter para cerrar cada `<Route ...>` respetando el anidamiento
 * de llaves de los atributos (`element={<Guard ... />}`).
 */
export interface RouteGuardRow {
  path: string
  /**
   * Claves `namespace.action` de `LOGISTICS_PERMISSIONS`, o `literal:<code>`
   * cuando el guard recibe la cadena directamente.
   */
  guards: string[]
}

export function extractRouteGuards(source: string): RouteGuardRow[] {
  const rows: RouteGuardRow[] = []
  const stack: string[][] = []
  let cursor = 0

  while (cursor < source.length) {
    const openTag = source.indexOf('<Route', cursor)
    const closeTag = source.indexOf('</Route>', cursor)

    if (openTag === -1 && closeTag === -1) break

    if (closeTag !== -1 && (openTag === -1 || closeTag < openTag)) {
      stack.pop()
      cursor = closeTag + '</Route>'.length
      continue
    }

    let depth = 0
    let quote: string | null = null
    let end = openTag + '<Route'.length

    for (; end < source.length; end += 1) {
      const char = source[end]
      if (quote) {
        if (char === quote) quote = null
        continue
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char
      } else if (char === '{') {
        depth += 1
      } else if (char === '}') {
        depth -= 1
      } else if (char === '>' && depth === 0) {
        break
      }
    }

    const tag = source.slice(openTag, end + 1)
    const permissionKeys = [
      ...tag.matchAll(/LOGISTICS_PERMISSIONS\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g),
    ].map((match) => `${match[1]}.${match[2]}`)
    const literals = [...tag.matchAll(/permission="([^"]+)"/g)].map(
      (match) => `literal:${match[1]}`,
    )
    const own = [...permissionKeys, ...literals]
    const pathMatch = tag.match(/path="([^"]+)"/)

    if (pathMatch) {
      rows.push({ path: pathMatch[1], guards: [...stack.flat(), ...own] })
    }
    if (!tag.trimEnd().endsWith('/>')) stack.push(own)
    cursor = end + 1
  }

  return rows
}
