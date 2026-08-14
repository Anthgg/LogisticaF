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

const TEST_FILE = /(^|[\\/])(test|tests|__tests__|e2e)[\\/]|\.(test|spec)\.[tj]sx?$/

// ── Manifest ────────────────────────────────────────────────────────────────
const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
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
function readLiteral(source, index) {
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
    if (char === quote) return out
    if (quote === '`' && char === '$' && source[i + 1] === '{') {
      let depth = 1
      let k = i + 2
      while (k < source.length && depth) {
        if (source[k] === '{') depth += 1
        else if (source[k] === '}') depth -= 1
        k += 1
      }
      out += '${}'
      i = k
      continue
    }
    out += char
    i += 1
  }
  return out
}

function extractCalls(source) {
  const calls = []

  // apiRequest({ path, method }): se recorta EXACTAMENTE el objeto de opciones
  // por balance de llaves; si no, el `method:` de una llamada vecina contamina.
  for (const match of source.matchAll(/\bapiRequest\s*(?:<[^>]*>)?\s*\(\s*\{/g)) {
    const open = source.indexOf('{', match.index)
    let depth = 1
    let end = open + 1
    while (end < source.length && depth) {
      if (source[end] === '{') depth += 1
      else if (source[end] === '}') depth -= 1
      end += 1
    }
    const options = source.slice(open, end)
    const pathKey = options.match(/\bpath:\s*/)
    if (!pathKey) continue
    const literal = readLiteral(options, pathKey.index + pathKey[0].length)
    if (!literal) continue
    const method = options.match(/\bmethod:\s*['"]([A-Za-z]+)['"]/)?.[1]?.toUpperCase() ?? 'GET'
    calls.push({ path: literal, method, offset: match.index })
  }

  // useQuery(key, path, ...) -> siempre GET
  for (const match of source.matchAll(/\buseQuery\s*(?:<[^>]*>)?\s*\(/g)) {
    const window = source.slice(match.index + 1, match.index + 900)
    const comma = window.search(/,\s*(?=[`'"])/)
    if (comma === -1) continue
    const literal = readLiteral(window, window.slice(comma).search(/[`'"]/) + comma)
    if (!literal) continue
    calls.push({ path: literal, method: 'GET', offset: match.index })
  }

  return calls
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

const rows = []
for (const file of await walk(SRC)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  if (TEST_FILE.test(rel)) continue
  const source = await readFile(file, 'utf8')
  for (const call of extractCalls(source)) {
    if (!call.path.startsWith('/')) continue
    const line = source.slice(0, call.offset).split('\n').length
    rows.push({ file: rel, line, method: call.method, raw: call.path, ...classify(call) })
  }
}

const summary = rows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] ?? 0) + 1
  return acc
}, {})

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, total: rows.length, rows }, null, 1))
} else {
  console.log(`backend manifest: ${manifest.source_backend_sha.slice(0, 7)} (${manifest.operation_count} ops)`)
  console.log(`llamadas runtime: ${rows.length}`)
  for (const [status, count] of Object.entries(summary).sort()) {
    console.log(`  ${status.padEnd(32)} ${count}`)
  }
  const bad = rows.filter((row) => row.status !== 'MATCH')
  if (bad.length) {
    console.log('\nfuera de contrato:')
    for (const row of bad) {
      console.log(`  ${row.status}  ${row.method} ${row.path}`)
      console.log(`      ${row.file}:${row.line}`)
    }
  }
}

process.exitCode = rows.some((row) => row.status !== 'MATCH') ? 1 : 0
