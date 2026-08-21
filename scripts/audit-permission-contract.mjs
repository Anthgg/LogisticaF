/**
 * Comprueba que todo código de permiso que usa el frontend exista en el catálogo
 * canónico del backend.
 *
 * Un permiso que el backend no conoce nunca puede concederse: el gate que lo exige
 * queda cerrado para todo el mundo, siempre. Hasta F006 PR 3 eso no se notaba porque
 * el proveedor concedía todos los permisos a quien tuviera un rol de ámbito global;
 * al retirar ese atajo, cada código inventado se convierte en una pantalla vacía.
 *
 * Clasificación:
 *   KNOWN     el código existe en el catálogo
 *   UNKNOWN   el código no existe — el gate no puede abrirse nunca
 *
 * Los UNKNOWN se comparan contra un trinquete: no se exige arreglarlos todos hoy,
 * pero no pueden aumentar. Corregirlos requiere decidir a qué permiso real
 * corresponde cada pantalla, y eso se decide con la matriz del backend, no aquí.
 *
 * Uso:
 *   node scripts/audit-permission-contract.mjs [--json]
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const CATALOG = join(ROOT, 'scripts', 'contracts', 'backend-permissions.phase006.json')
const MAP = join(SRC, 'features', 'logistics-permissions', 'logistics-permissions-map.ts')

/** SHA del backend del que se exportó el catálogo vendorizado. */
const EXPECTED_BACKEND_SHA = 'abea8bd932d0f781d03124ca98384bb49d4cebfb'

/**
 * Cero, no un trinquete. F006 PR 3.1 reconcilio los 131 codigos que el backend no
 * conocia; dejar el listón en 131 habria dejado a CI diciendo que 131 esta estupendo y
 * 132 es un problema. Un codigo que el backend no conoce no puede concederse nunca, asi
 * que el unico numero correcto es ninguno.
 */
const RATCHET = { declared: 0, inUse: 0 }

const TEST_FILE = /(^|[\/])(test|tests|__tests__|e2e)[\/]|\.(test|spec)\.[tj]sx?$/
const CODE_LITERAL = /'(logistics\.[a-z0-9_.]+)'/g
const MAP_GROUP = /^ {2}(\w+): \{$/
const MAP_GROUP_END = /^ {2}\},?$/
const MAP_LEAF = /^ {4}(\w+): '(logistics\.[a-z0-9_.]+)'/
const MAP_USAGE = /LOGISTICS_PERMISSIONS\.(\w+)\.(\w+)/g

/**
 * `LOGISTICS_PERMISSIONS.purchase_orders.create` solo se puede resolver conociendo el
 * grupo: la hoja `create` aparece en decenas de grupos, y buscarla suelta devuelve el
 * código del último grupo leído. El mapa es plano de dos niveles, así que basta seguir
 * la indentación.
 */
function parseMap(source) {
  const groups = new Map()
  let current = null
  for (const line of source.split(/\r?\n/)) {
    const open = MAP_GROUP.exec(line)
    if (open) {
      current = new Map()
      groups.set(open[1], current)
      continue
    }
    if (MAP_GROUP_END.test(line)) {
      current = null
      continue
    }
    const leaf = MAP_LEAF.exec(line)
    if (leaf && current) current.set(leaf[1], leaf[2])
  }
  return groups
}

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry)
    const info = await stat(full)
    if (info.isDirectory()) out.push(...(await walk(full)))
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

const catalog = JSON.parse(await readFile(CATALOG, 'utf8'))
if (catalog.backend_sha !== EXPECTED_BACKEND_SHA) {
  console.error(
    `El catálogo vendorizado dice ${catalog.backend_sha} pero se esperaba ${EXPECTED_BACKEND_SHA}.\n` +
      'Regenéralo con: python backend/scripts/audit_permission_catalog.py --export',
  )
  process.exit(1)
}
const known = new Set(catalog.permissions.map((p) => p.code))

// El mapa traduce nombre simbólico -> código. Necesitamos ambos sentidos: qué códigos
// declara, y qué código hay detrás de cada `LOGISTICS_PERMISSIONS.x.y` que use una pantalla.
const mapSource = await readFile(MAP, 'utf8')
const groups = parseMap(mapSource)

const declared = new Set([...mapSource.matchAll(CODE_LITERAL)].map((m) => m[1]))
const unknownDeclared = [...declared].filter((code) => !known.has(code)).sort()

const inUse = new Map()
for (const file of await walk(SRC)) {
  if (file === MAP || TEST_FILE.test(file)) continue
  const text = await readFile(file, 'utf8')
  const hits = new Set()
  for (const [, group, leaf] of text.matchAll(MAP_USAGE)) {
    const code = groups.get(group)?.get(leaf)
    if (code && !known.has(code)) hits.add(code)
  }
  for (const [, code] of text.matchAll(CODE_LITERAL)) {
    if (!known.has(code)) hits.add(code)
  }
  for (const code of hits) {
    if (!inUse.has(code)) inUse.set(code, [])
    inUse.get(code).push(relative(ROOT, file))
  }
}

const report = {
  catalog_version: catalog.catalog_version,
  backend_sha: catalog.backend_sha,
  total_backend_permissions: known.size,
  declared_codes: declared.size,
  unknown_declared: unknownDeclared.length,
  unknown_in_use: inUse.size,
  ratchet: RATCHET,
  unknown: unknownDeclared.map((code) => ({ code, used_in: inUse.get(code) ?? [] })),
}

const asJson = process.argv.includes('--json')

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`CATALOG_VERSION            = ${report.catalog_version}`)
  console.log(`BACKEND_PERMISSIONS        = ${report.total_backend_permissions}`)
  console.log(`FRONTEND_DECLARED_CODES    = ${report.declared_codes}`)
  console.log(`UNKNOWN_PERMISSION_CODES   = ${report.unknown_declared} (trinquete ${RATCHET.declared})`)
  console.log(`UNKNOWN_CODES_IN_USE       = ${report.unknown_in_use} (trinquete ${RATCHET.inUse})`)
  if (inUse.size) {
    console.log('\nCódigos inexistentes que alguna pantalla exige:')
    for (const [code, files] of [...inUse].sort()) {
      console.log(`  ${code}`)
      for (const file of files) console.log(`      ${file}`)
    }
  }
}

const failures = []
if (report.unknown_declared > RATCHET.declared)
  failures.push(`UNKNOWN_PERMISSION_CODES subió a ${report.unknown_declared} (máximo ${RATCHET.declared})`)
if (report.unknown_in_use > RATCHET.inUse)
  failures.push(`UNKNOWN_CODES_IN_USE subió a ${report.unknown_in_use} (máximo ${RATCHET.inUse})`)

if (failures.length) {
  console.error('\nRESULTADO=FAIL')
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}
// En modo --json la salida debe ser JSON y nada más, para poder canalizarla.
if (!asJson) console.log('\nRESULTADO=OK')
