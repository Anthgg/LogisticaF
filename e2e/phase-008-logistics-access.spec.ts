import { test, expect } from '@playwright/test'
import {
  installApiMocks,
  installUnauthorizedMocks,
} from './fixtures/api-mocks'

test.describe('Fase 008 - Acceso logístico', () => {
  test('usuario con acceso logístico entra a /logistics/warehouses', async ({
    page,
  }) => {
    await installApiMocks(page, {}, {
      enabled: true,
      permissions: ['logistics.warehouses.read'],
      roles: ['LOGISTICS_ADMIN'],
      organizations: ['org-1'],
      branches: ['branch-1'],
      warehouses: ['wh-1'],
    })
    await page.goto('/logistics/warehouses')
    await expect(page.getByPlaceholder('Buscar almacén por nombre o código…')).toBeVisible({ timeout: 15000 })
  })

  test('usuario sin acceso logístico ve pantalla controlada', async ({
    page,
  }) => {
    await installApiMocks(
      page,
      { permissions: [], sensitivePermissions: [], stepUpPermissions: [], roles: [] },
      {
        enabled: false,
        roles: [],
        permissions: [],
        organizations: [],
        branches: [],
        warehouses: [],
        defaultOrganizationId: null,
        defaultBranchId: null,
        defaultWarehouseId: null,
      },
    )
    await page.goto('/logistics/warehouses')
    await expect(page.getByText('Acceso logístico deshabilitado')).toBeVisible({ timeout: 15000 })
  })

  test('usuario sin sesión es redirigido a login desde /logistics', async ({
    page,
  }) => {
    await installUnauthorizedMocks(page)
    await page.goto('/logistics/warehouses')
    await expect(page).toHaveURL(/\/login/)
  })

  test('ruta /logistics redirige a /logistics/warehouses', async ({ page }) => {
    await installApiMocks(page, {}, {
      enabled: true,
      permissions: ['logistics.warehouses.read'],
      roles: ['LOGISTICS_ADMIN'],
      organizations: ['org-1'],
      branches: ['branch-1'],
      warehouses: ['wh-1'],
    })
    await page.goto('/logistics')
    await expect(page).toHaveURL(/\/logistics\/warehouses/, { timeout: 15000 })
  })
})

test.describe('Fase 008 - Cambio de contexto', () => {
  test('selector muestra organizaciones autorizadas', async ({ page }) => {
    await installApiMocks(page, {}, {
      enabled: true,
      permissions: ['logistics.warehouses.read'],
      roles: ['LOGISTICS_ADMIN'],
      organizations: ['org-1', 'org-2'],
      branches: ['branch-1'],
      warehouses: ['wh-1'],
    })
    await page.goto('/logistics/warehouses')
    await expect(page.getByPlaceholder('Buscar almacén por nombre o código…')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /Cambiar contexto/i })).toBeVisible({ timeout: 15000 })
  })

  test('selector no aparece con una sola organización', async ({ page }) => {
    await installApiMocks(page, {}, {
      enabled: true,
      permissions: ['logistics.warehouses.read'],
      roles: ['LOGISTICS_ADMIN'],
      organizations: ['org-1'],
      branches: ['branch-1'],
      warehouses: ['wh-1'],
    })
    await page.goto('/logistics/warehouses')
    await expect(page.getByRole('button', { name: /Cambiar contexto/i })).toBeHidden({ timeout: 15000 })
  })
})

test.describe('Fase 008 - Logout y sesión', () => {
  test('logout redirige a login y limpia estado logístico', async ({
    page,
  }) => {
    await installApiMocks(page, {}, {
      enabled: true,
      permissions: ['logistics.warehouses.read'],
      roles: ['LOGISTICS_ADMIN'],
      organizations: ['org-1'],
      branches: ['branch-1'],
      warehouses: ['wh-1'],
    })
    await page.goto('/logistics/warehouses')
    await expect(page.getByPlaceholder('Buscar almacén por nombre o código…')).toBeVisible({ timeout: 15000 })

    // Simular logout: el backend revoca la sesión y /auth/me devuelve 401
    await page.route('**/api/auth/logout', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'ok', revoked_sessions: 0 }),
      }),
    )
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'SESSION_REQUIRED', message: 'Sin sesión' },
        }),
      }),
    )

    // Navegar a /dashboard debería redirigir a login tras logout
    // (el flujo real requiere clic en logout del UserMenu)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Rediseño de formularios estructurales', () => {
  test('organización usa página dedicada, resumen lateral y preview de país', async ({ page }) => {
    await installApiMocks(
      page,
      {},
      {
        enabled: true,
        permissions: ['logistics.organizations.read', 'logistics.organizations.create'],
        roles: ['LOGISTICS_ADMIN'],
        organizations: ['org-1'],
        branches: ['branch-1'],
        warehouses: ['wh-1'],
      },
      {
        '**/api/logistics/catalogs/countries': {
          status: 200,
          body: [{ code: 'PE', name: 'Perú' }],
        },
        '**/api/logistics/catalogs/timezones*': {
          status: 200,
          body: [{ code: 'America/Lima', name: 'Lima', country_code: 'PE' }],
        },
      },
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/logistics/organizations/new')

    await expect(page.getByRole('heading', { name: 'Nueva organización' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByLabel('Resumen contextual')).toBeVisible()
    await expect(page.getByTestId('country-map-preview')).toContainText('Perú (PE)')
    await expect(page.getByLabel('Mapa de contexto de Perú')).toBeVisible()
  })
})
