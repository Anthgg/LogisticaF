import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'

import { describe, expect, it } from 'vitest'

// Regenerado en F004: el backend añadió una sola operación,
// GET /api/logistics/branches/{branch_id}/warehouses/{warehouse_id} (973 -> 974).
const EXPECTED_BACKEND_SHA = '9da02054b66955ca527e9423ad4426b632a83751'
const manifestPath = resolve(process.cwd(), 'scripts', 'contracts', 'backend-routes.phase045.json')
const auditPath = resolve(process.cwd(), 'scripts', 'audit-api-contract.mjs')

describe('phase 045 API contract gate', () => {
  it('pins the manifest to the reviewed backend revision', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      source_backend_sha?: string
    }

    expect(manifest.source_backend_sha).toBe(EXPECTED_BACKEND_SHA)
  })

  it('accepts every runtime request and leaves no unresolved call', () => {
    const result = spawnSync(process.execPath, [auditPath, '--json'], {
      encoding: 'utf8',
      cwd: process.cwd(),
    })

    expect(result.status, result.stderr || result.stdout).toBe(0)

    const report = JSON.parse(result.stdout) as {
      total: number
      summary: Record<string, number | undefined>
    }
    const failingStatuses = [
      'METHOD_MISMATCH',
      'PATH_MISMATCH',
      'STATIC_COLLIDES_WITH_PATH_PARAM',
      'UNRESOLVED_DYNAMIC_PATH',
      'UNPARSED_CALL',
    ]

    for (const status of failingStatuses) {
      expect(report.summary[status] ?? 0, status).toBe(0)
    }
    expect(report.summary.MATCH).toBe(report.total)
    // El auditor tarda ~2 s aislado, pero aquí compite con el resto de la suite
    // en paralelo. El margen es para la contención, no para la comprobación.
  }, 120_000)
})
