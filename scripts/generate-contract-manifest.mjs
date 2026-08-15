/**
 * Genera el manifest de contrato del backend a partir de su OpenAPI real.
 *
 * El manifest es una COPIA GENERADA y trazada a un SHA de backend: no es la
 * fuente de verdad, solo permite que el CI del frontend valide el contrato sin
 * levantar el backend en cada ejecución.
 *
 * Uso:
 *   node scripts/generate-contract-manifest.mjs \
 *     --url http://127.0.0.1:8000/openapi.json \
 *     --backend-sha d55e7f2b64ea6d8ce278fb626046c12d3dab1286
 *
 * Regenerar cuando el backend cambie el contrato oficialmente: generar,
 * revisar el diff, actualizar consumidores y ejecutar el validador.
 * Nunca editarlo a mano para hacer pasar un test.
 */
import { writeFile } from 'node:fs/promises'

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
const OUTPUT = new URL('./contracts/backend-routes.phase045.json', import.meta.url)

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

const url = arg('url', 'http://127.0.0.1:8000/openapi.json')
const backendSha = arg('backend-sha', '')

if (!backendSha) {
  console.error('Falta --backend-sha: el manifest debe quedar trazado a un commit del backend.')
  process.exit(1)
}

const response = await fetch(url)
if (!response.ok) {
  console.error(`No se pudo leer el OpenAPI en ${url}: HTTP ${response.status}`)
  process.exit(1)
}

const document = await response.json()
const operations = []

for (const [path, item] of Object.entries(document.paths ?? {})) {
  for (const method of HTTP_METHODS) {
    if (!item[method]) continue
    const parameters = [...(item.parameters ?? []), ...(item[method].parameters ?? [])]
    operations.push({
      method: method.toUpperCase(),
      path,
      query: parameters
        .filter((parameter) => parameter.in === 'query')
        .map((parameter) => parameter.name)
        .sort(),
    })
  }
}

operations.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))

const manifest = {
  source_backend_sha: backendSha,
  source_openapi_version: document.info?.version ?? null,
  generated_from: url,
  operation_count: operations.length,
  operations,
}

await writeFile(OUTPUT, `${JSON.stringify(manifest, null, 1)}\n`, 'utf8')
console.log(`Manifest escrito: ${operations.length} operaciones (backend ${backendSha.slice(0, 7)})`)
