import { expect, test, type Page } from '@playwright/test'
import { installApiMocks } from './fixtures/api-mocks'

const permissions = [
  'logistics.quality_plan.read',
  'logistics.quality_quarantine.read',
  'logistics.putaway.read',
  'logistics.putaway.execute',
  'logistics.reception_difference_cases.read',
  'logistics.vehicles.verify',
]

const domainPaths = [
  '/api/logistics/quality-inspection-plans',
  '/api/logistics/quality-quarantine-cases',
  '/api/logistics/putaway/tasks',
  '/api/logistics/reception-difference-cases',
  '/api/logistics/vehicles/',
]

async function fulfillJson(page: Page, pattern: RegExp, body: unknown) {
  await page.route(pattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    }),
  )
}

test.describe('Cierre post-Fase 045 - runtime y contrato de red', () => {
  test.setTimeout(120_000)

  test('carga los cinco dominios corregidos sin rutas malformadas', async ({ page }) => {
    await installApiMocks(
      page,
      { permissions },
      {
        enabled: true,
        permissions,
        organizations: ['org-1'],
        branches: ['branch-1'],
        warehouses: ['wh-1'],
        defaultOrganizationId: 'org-1',
        defaultBranchId: 'branch-1',
        defaultWarehouseId: 'wh-1',
      },
    )

    // El selector de contexto pide paginación; el fixture base cubre la URL
    // sin query string, por lo que este smoke debe cubrir también su forma real.
    await fulfillJson(page, /\/api\/logistics\/organizations(?:\?.*)?$/, {
      items: [
        {
          id: 'org-1',
          code: 'ORG-001',
          name: 'Organización Principal',
          status: 'active',
          country_code: 'PE',
          timezone: 'America/Lima',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      page: 1,
      page_size: 100,
      total: 1,
      total_pages: 1,
    })

    await fulfillJson(page, /\/api\/logistics\/quality-inspection-plans(?:\?.*)?$/, {
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
      total_pages: 0,
    })
    await fulfillJson(page, /\/api\/logistics\/quality-quarantine-cases(?:\?.*)?$/, [])
    await fulfillJson(page, /\/api\/logistics\/putaway\/tasks(?:\?.*)?$/, {
      items: [],
      page: 1,
      page_size: 50,
      total: 0,
      total_pages: 0,
    })
    await fulfillJson(page, /\/api\/logistics\/reception-difference-cases(?:\?.*)?$/, {
      items: [],
      page: 1,
      page_size: 50,
      total: 0,
      total_pages: 0,
    })
    await fulfillJson(page, /\/api\/logistics\/vehicles\/vehicle-smoke\/verifications(?:\?.*)?$/, [])

    const requests: string[] = []
    const responses: Array<{ url: string; status: number }> = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('/api/logistics/')) requests.push(url)
    })
    page.on('response', (response) => {
      const url = response.url()
      if (url.includes('/api/logistics/')) responses.push({ url, status: response.status() })
    })

    const routes: Array<[string, RegExp, string]> = [
      ['/logistics/quality/plans', /Planes de inspección de calidad/i, domainPaths[0]],
      ['/logistics/quality/quarantine/cases', /Casos de cuarentena/i, domainPaths[1]],
      ['/logistics/putaway/mobile', /Workspace móvil de ubicación/i, domainPaths[2]],
      ['/logistics/inbound/reception-differences', /Diferencias de Recepción/i, domainPaths[3]],
    ]

    for (const [route, heading, expectedRequest] of routes) {
      const request = page.waitForRequest((candidate) => candidate.url().includes(expectedRequest))
      await page.goto(route)
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
      await request
    }

    await page.goto('/logistics/integrations/vehicle-verifications')
    await expect(page.getByRole('heading', { name: /Verificaciones vehiculares/i })).toBeVisible()
    await page.getByLabel('ID del vehículo').fill('vehicle-smoke')
    await page.getByRole('button', { name: 'Consultar verificaciones' }).click()
    await expect(page.getByText('El vehículo consultado no tiene verificaciones registradas.')).toBeVisible()

    for (const expectedPath of domainPaths) {
      expect(requests.some((url) => url.includes(expectedPath))).toBe(true)
    }

    expect(requests).not.toEqual([])
    for (const url of requests) {
      expect(url).not.toContain('/api/api/')
      expect(url).not.toMatch(/[?&]warehouse_id=(?:&|$)/)
      expect(url).not.toMatch(/run\.app|cloudfunctions\.net/)
    }
    for (const response of responses.filter(({ url }) => domainPaths.some((path) => url.includes(path)))) {
      expect(response.status).not.toBe(404)
      expect(response.status).not.toBe(422)
    }
  })
})
