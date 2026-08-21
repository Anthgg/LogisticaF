/**
 * Genera el contrato de permisos que consume el frontend a partir del catálogo del
 * backend vendorizado.
 *
 * Mantener 555 códigos a mano fue exactamente lo que produjo la deriva que F006 PR 3.1
 * tuvo que reconciliar: 131 códigos que el backend no conocía, 23 de ellos exigidos por
 * pantallas vivas. La lista deja de escribirse a mano.
 *
 * La salida es un tipo, no datos: la unión se borra al compilar, así que el paquete no
 * crece ni un byte, y cualquier código que el backend no conozca deja de compilar. Un
 * error de tipos es una barrera más temprana que un script de CI.
 *
 * Uso:
 *   node scripts/generate-permission-contract.mjs
 *   node scripts/generate-permission-contract.mjs --check   (falla si hay deriva)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CATALOG = join(ROOT, 'scripts', 'contracts', 'backend-permissions.phase006.json')
const OUT = join(ROOT, 'src', 'features', 'logistics-permissions', 'generated', 'permission-codes.ts')

const catalog = JSON.parse(await readFile(CATALOG, 'utf8'))
const codes = [...new Set(catalog.permissions.map((p) => p.code))].sort()

const content = `/**
 * GENERADO — no editar a mano.
 *
 * Fuente: catálogo canónico del backend (\`rbac/permission_catalog.py\`), exportado a
 * \`scripts/contracts/backend-permissions.phase006.json\` y traducido por
 * \`scripts/generate-permission-contract.mjs\`.
 *
 * Regenerar:  npm run permissions:contract
 *
 * Catálogo ${catalog.catalog_version} · ${codes.length} permisos
 * Backend ${catalog.backend_sha}
 */

export type LogisticsPermissionCode =
${codes.map((c) => `  | '${c}'`).join('\n')}

/** Cuántos permisos declara el catálogo del backend. Lo comprueban las pruebas. */
export const BACKEND_PERMISSION_COUNT = ${codes.length}
`

if (process.argv.includes('--check')) {
  const current = await readFile(OUT, 'utf8').catch(() => null)
  if (current !== content) {
    console.error(
      'GENERATED_PERMISSION_CONTRACT_DRIFT=1\n' +
        'El contrato generado no corresponde al catálogo vendorizado.\n' +
        'Regenéralo con: npm run permissions:contract',
    )
    process.exit(1)
  }
  console.log('GENERATED_PERMISSION_CONTRACT_DRIFT=0')
} else {
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, content, 'utf8')
  console.log(`Contrato escrito: ${codes.length} permisos (catálogo ${catalog.catalog_version})`)
}
