/**
 * Compara TODAS las llamadas API runtime del frontend contra el manifest del
 * backend (método + path + colisiones con path params).
 *
 * Clasificación por llamada:
 *   MATCH                          la operación existe con ese método
 *   METHOD_MISMATCH                el path existe, el método no
 *   STATIC_COLLIDES_WITH_PATH_PARAM  un literal cae donde el backend espera un
 *                                  parámetro (FastAPI devolvería 422)
 *   PATH_MISMATCH                  el path no existe en el contrato
 *   UNRESOLVED_DYNAMIC_PATH        el path se compone en runtime y no se puede
 *                                  resolver estáticamente
 *
 * Uso:
 *   node scripts/audit-api-contract.mjs [--json]
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath decodifica los %20 de rutas con espacios.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const MANIFEST = join(ROOT, 'scripts', 'contracts', 'backend-routes.phase045.json')
// Regenerado en F005: el backend añadió los 5 endpoints de administración de
// roles (978 -> 983 operaciones).
const EXPECTED_BACKEND_SHA = '41c91766ef499eec8deca7d04159cda1664f310f'

const TEST_FILE = /(^|[\\/])(test|tests|__tests__|e2e)[\\/]|\.(test|spec)\.[tj]sx?$/

// Estados que rompen el gate.
const FAILING = new Set([
  'METHOD_MISMATCH',
  'PATH_MISMATCH',
  'STATIC_COLLIDES_WITH_PATH_PARAM',
  'UNRESOLVED_DYNAMIC_PATH',
  'UNPARSED_CALL',
])

// ── Manifest ────────────────────────────────────────────────────────────────
const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
if (manifest.source_backend_sha !== EXPECTED_BACKEND_SHA) {
  console.error(
    `manifest SHA mismatch: expected ${EXPECTED_BACKEND_SHA}, received ${manifest.source_backend_sha ?? '(missing)'}`,
  )
  process.exit(1)
}
const OPERATIONS = manifest.operations.map((operation) => ({
  ...operation,
  segments: operation.path.replace(/^\//, '').split('/'),
}))

const PATHS_BY_SHAPE = new Map()
for (const operation of OPERATIONS) {
  const list = PATHS_BY_SHAPE.get(operation.path) ?? []
  list.push(operation.method)
  PATHS_BY_SHAPE.set(operation.path, list)
}

// ── Lectura de literales (template literals con ${...} anidados) ────────────
/**
 * Lee el literal que empieza en `index`. Las interpolaciones se sustituyen por
 * el valor de la constante cuando se conoce (`${BASE}` -> `/logistics/...`) y
 * por `${}` cuando no, que es lo que `normalize` sabe convertir en parámetro.
 */
function readLiteral(source, index, constants) {
  const quote = source[index]
  if (!'`\'"'.includes(quote)) return null
  let out = ''
  let i = index + 1
  while (i < source.length) {
    const char = source[i]
    if (char === '\\') {
      out += source.slice(i, i + 2)
      i += 2
      continue
    }
    if (char === quote) return { text: out, end: i + 1 }
    if (quote === '`' && char === '$' && source[i + 1] === '{') {
      let depth = 1
      let k = i + 2
      while (k < source.length && depth) {
        if (source[k] === '{') depth += 1
        else if (source[k] === '}') depth -= 1
        k += 1
      }
      const expression = source.slice(i + 2, k - 1).trim()
      out += constants?.get(expression) ?? '${}'
      i = k
      continue
    }
    out += char
    i += 1
  }
  return null
}

/** `const X = '...'` de nivel de módulo, para resolver `path: X`. */
function collectConstants(source, inherited) {
  const constants = new Map(inherited)
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?=['"`])/g)) {
    const literal = readLiteral(source, match.index + match[0].length, constants)
    if (literal) constants.set(match[1], literal.text)
  }
  // Alias entre bases: `const BASE = BALANCES_BASE_PATH`.
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*(?:$|[\n;])/gm)) {
    const target = constants.get(match[2])
    if (target !== undefined) constants.set(match[1], target)
  }
  return constants
}

/**
 * Valor de la declaración `const <name> =` más cercana **antes** de `before`.
 * Resuelve `const path = cond ? \`/a\` : \`/b\`` sin depender del nombre, que
 * se repite en cada método del módulo.
 */
function findDeclaration(source, name, before) {
  let declaration = null
  for (const match of source.matchAll(new RegExp(`\\bconst\\s+${name}\\s*=\\s*`, 'g'))) {
    if (match.index >= before) break
    declaration = match
  }
  if (!declaration) return null

  const start = declaration.index + declaration[0].length
  let depth = 0
  for (let i = start; i < source.length; i += 1) {
    const char = source[i]
    if ('([{'.includes(char)) depth += 1
    else if (')]}'.includes(char)) depth -= 1
    else if ('`\'"'.includes(char)) {
      const literal = readLiteral(source, i)
      if (literal) i = literal.end - 1
    } else if (char === ';' && depth === 0) return source.slice(start, i)
    else if (char === '\n' && depth === 0) {
      // La sentencia sigue si la línea siguiente encadena (ternario, acceso…).
      const next = source.slice(i + 1).match(/^\s*(\S)/)
      if (!next || !'?:.+'.includes(next[1])) return source.slice(start, i)
    }
  }
  return null
}

/** Recorta el texto entre delimitadores balanceados a partir de `open`. */
function readBalanced(source, open, [start, close]) {
  let depth = 1
  let i = open + 1
  while (i < source.length && depth) {
    if (source[i] === start) depth += 1
    else if (source[i] === close) depth -= 1
    i += 1
  }
  return source.slice(open, i)
}

/**
 * Todos los paths que una expresión puede producir. Cubre el literal directo,
 * la constante (`path: BASE`), el ternario (`cond ? '/x' : ''`) y el helper
 * (`withQuery('/x', {...})`). Devuelve `null` si nada es legible.
 */
function resolvePathCandidates(expression, constants, context) {
  const trimmed = expression.trim()
  const asConstant = constants.get(trimmed)
  if (asConstant !== undefined) return [asConstant]

  // `path` a secas o `path: url`: se busca la declaración local más cercana.
  if (context && context.depth < 3 && /^[A-Za-z_$][\w$]*$/.test(trimmed)) {
    const declaration = findDeclaration(context.source, trimmed, context.offset)
    if (declaration === null) return null
    return resolvePathCandidates(declaration, constants, { ...context, depth: context.depth + 1 })
  }

  const found = []
  for (let i = 0; i < expression.length; i += 1) {
    const literal = readLiteral(expression, i, constants)
    if (!literal) continue
    found.push(literal.text)
    i = literal.end - 1
  }
  // Una expresión puede contener literales que no son el path (claves de query,
  // valores de orden). El path siempre empieza en `/`.
  const paths = found.filter((value) => value.startsWith('/'))

  // `withQuery(path, query)`: el path es el primer argumento del helper.
  if (!paths.length && context && context.depth < 3) {
    const call = trimmed.match(/^[A-Za-z_$][\w$]*\s*\(/)
    if (call) {
      const args = readBalanced(trimmed, call[0].length - 1, ['(', ')'])
      const first = splitTopLevel(args.slice(1, -1))[0]
      if (first !== undefined && first.trim() !== '') {
        return resolvePathCandidates(first, constants, { ...context, depth: context.depth + 1 })
      }
    }
  }

  if (!found.length) return null
  // Todos los literales vacíos => capacidad deshabilitada a propósito.
  if (!paths.length) return found.every((value) => value === '') ? [] : null
  return paths
}

function extractCalls(source, inheritedConstants) {
  const constants = collectConstants(source, inheritedConstants)
  const calls = []

  const push = (expression, method, offset) => {
    const candidates = expression === null
      ? null
      : resolvePathCandidates(expression, constants, { source, offset, depth: 0 })
    if (candidates === null) {
      // Identificador sin literal detrás: es un wrapper que recibe el path de
      // quien lo llama, y esas llamadas se auditan por su cuenta.
      const passthrough = expression !== null && /^\s*[A-Za-z_$][\w$]*\s*$/.test(expression)
      calls.push({ path: null, method, offset, unparsed: !passthrough, passthrough })
      return
    }
    for (const path of candidates) calls.push({ path, method, offset })
  }

  // apiRequest/requestPdf({ path, method }): se recorta EXACTAMENTE el objeto de opciones
  // por balance de llaves; si no, el `method:` de una llamada vecina contamina.
  for (const match of source.matchAll(/\b(?:apiRequest|requestPdf)\s*(?:<[^>]*>)?\s*\(\s*\{/g)) {
    // La llave es la ÚLTIMA del match: `apiRequest<{ id: string }>({` tiene una
    // llave dentro del genérico, y buscar la primera cortaría ahí.
    const options = readBalanced(source, match.index + match[0].length - 1, ['{', '}'])
    const method = options.match(/\bmethod:\s*['"]([A-Za-z]+)['"]/)?.[1]?.toUpperCase() ?? 'GET'
    const pathKey = options.match(/\bpath:\s*/)
    // Una llamada que no se puede leer NO se descarta: se marca. Un auditor que
    // ignora en silencio lo que no entiende deja de ser una red de seguridad.
    const value = pathKey
      ? sliceValue(options, pathKey.index + pathKey[0].length)
      : (/\bpath\s*[,}]/.test(options) ? 'path' : null) // forma abreviada `{ path, ... }`
    push(value, method, match.index)
  }

  // useQuery(key, path, ...) -> siempre GET. `function useQuery(` es la
  // declaración del hook, no una llamada.
  for (const match of source.matchAll(/(?<!function\s)\buseQuery\s*(?:<[^>]*>)?\s*\(/g)) {
    const args = readBalanced(source, match.index + match[0].length - 1, ['(', ')'])
    const parts = splitTopLevel(args.slice(1, -1))
    push(parts[1] ?? null, 'GET', match.index)
  }

  return calls
}

/** Valor de una propiedad: hasta la coma de su mismo nivel. */
function sliceValue(source, start) {
  let depth = 0
  for (let i = start; i < source.length; i += 1) {
    const char = source[i]
    if ('([{'.includes(char)) depth += 1
    else if (')]}'.includes(char)) {
      if (depth === 0) return source.slice(start, i)
      depth -= 1
    } else if ('`\'"'.includes(char)) {
      const literal = readLiteral(source, i)
      if (literal) i = literal.end - 1
    } else if (char === ',' && depth === 0) return source.slice(start, i)
  }
  return source.slice(start)
}

/** Argumentos de una llamada, separados por las comas de nivel superior. */
function splitTopLevel(source) {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if ('([{'.includes(char)) depth += 1
    else if (')]}'.includes(char)) depth -= 1
    else if ('`\'"'.includes(char)) {
      const literal = readLiteral(source, i)
      if (literal) i = literal.end - 1
    } else if (char === ',' && depth === 0) {
      parts.push(source.slice(start, i))
      start = i + 1
    }
  }
  parts.push(source.slice(start))
  return parts
}

// ── Normalización ───────────────────────────────────────────────────────────
function normalize(rawPath) {
  let path = rawPath.split('?')[0].split('#')[0]
  // interpolación pegada a un segmento = query string, no parámetro
  path = path.replace(/(?<=[^/])\$\{\}/g, '')
  path = path.replace(/\$\{\}/g, '{param}')
  path = path.replace(/\/+$/, '') || '/'
  if (!path.startsWith('/api')) path = `/api${path}`
  return path.replace(/\/{2,}/g, '/')
}

function classify(call) {
  const path = normalize(call.path)
  if (path.includes('${')) return { status: 'UNRESOLVED_DYNAMIC_PATH', path }

  const segments = path.replace(/^\//, '').split('/')

  let sawParamCollision = false
  for (const operation of OPERATIONS) {
    if (operation.segments.length !== segments.length) continue

    let matches = true
    let collision = false
    for (let i = 0; i < segments.length; i += 1) {
      const backend = operation.segments[i]
      const front = segments[i]
      const backendIsParam = backend.startsWith('{') && backend.endsWith('}')
      const frontIsParam = front === '{param}'

      if (backendIsParam && frontIsParam) continue
      if (!backendIsParam && backend === front) continue
      // Un literal estático donde el backend espera un parámetro NO es válido:
      // FastAPI intentaría parsearlo (uuid_parsing -> 422).
      if (backendIsParam && !frontIsParam) {
        collision = true
        matches = false
        break
      }
      matches = false
      break
    }

    if (matches) {
      const methods = PATHS_BY_SHAPE.get(operation.path) ?? []
      if (methods.includes(call.method)) return { status: 'MATCH', path, backend: operation.path }
      return { status: 'METHOD_MISMATCH', path, backend: operation.path, methods }
    }
    if (collision) sawParamCollision = true
  }

  if (sawParamCollision) return { status: 'STATIC_COLLIDES_WITH_PATH_PARAM', path }
  return { status: 'PATH_MISMATCH', path }
}

// ── Recorrido ───────────────────────────────────────────────────────────────
async function walk(dir, out = []) {
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry)
    if ((await stat(full)).isDirectory()) await walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

const sources = new Map()
for (const file of await walk(SRC)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  if (TEST_FILE.test(rel)) continue
  sources.set(rel, await readFile(file, 'utf8'))
}

// Las bases (`UNLOADING_OPERATIONS_BASE`, `BALANCES_BASE_PATH`…) se declaran en
// un módulo y se importan en otro. Se comparten las que tienen un único valor
// en todo `src`: si un nombre significa dos cosas distintas, no se adivina.
const shared = new Map()
for (const source of sources.values()) {
  for (const [name, value] of collectConstants(source)) {
    if (shared.has(name) && shared.get(name) !== value) shared.set(name, null)
    else if (!shared.has(name)) shared.set(name, value)
  }
}
const inherited = new Map([...shared].filter(([, value]) => value !== null))

const rows = []
const wrappers = []
for (const [rel, source] of sources) {
  for (const call of extractCalls(source, inherited)) {
    const line = source.slice(0, call.offset).split('\n').length
    if (call.passthrough) {
      // La definición genérica no es una llamada runtime adicional. Se reporta
      // fuera de `rows`; sus invocaciones concretas sí se extraen y clasifican.
      wrappers.push({ file: rel, line, method: call.method })
      continue
    }
    if (call.unparsed) {
      rows.push({ file: rel, line, method: call.method, raw: null, status: 'UNPARSED_CALL', path: '(no legible)' })
      continue
    }
    if (!call.path.startsWith('/')) continue
    rows.push({ file: rel, line, method: call.method, raw: call.path, ...classify(call) })
  }
}

const summary = rows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] ?? 0) + 1
  return acc
}, {})

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, total: rows.length, wrappers, rows }, null, 1))
} else {
  console.log(`backend manifest: ${manifest.source_backend_sha.slice(0, 7)} (${manifest.operation_count} ops)`)
  console.log(`llamadas runtime: ${rows.length}`)
  for (const [status, count] of Object.entries(summary).sort()) {
    console.log(`  ${status.padEnd(32)} ${count}`)
  }
  if (wrappers.length) {
    console.log(`  ${'WRAPPERS_TRACED_AT_CALL_SITES'.padEnd(32)} ${wrappers.length}`)
  }
  const bad = rows.filter((row) => FAILING.has(row.status))
  if (bad.length) {
    console.log('\nfuera de contrato:')
    for (const row of bad) {
      console.log(`  ${row.status}  ${row.method} ${row.path}`)
      console.log(`      ${row.file}:${row.line}`)
    }
  }
}

process.exitCode = rows.some((row) => FAILING.has(row.status)) ? 1 : 0
