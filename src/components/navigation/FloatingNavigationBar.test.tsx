import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FloatingNavigationBar } from './FloatingNavigationBar'
import { ModuleGroupNav } from './ModuleGroupNav'

const permissionState = { permissions: new Set<string>(), isLoading: false }

vi.mock('../../features/logistics-permissions/hooks/useLogisticsPermissions', () => ({
  useLogisticsPermissions: () => ({
    isLoading: permissionState.isLoading,
    hasPermission: (code: string) => permissionState.permissions.has(code),
    hasAnyPermission: (codes: readonly string[]) =>
      codes.some((code) => permissionState.permissions.has(code)),
  }),
}))

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="ruta">{location.pathname}</span>
}

/** Monta la barra inferior + la sub-navegación superior, como en el layout real. */
function renderNavigation(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <LocationProbe />
      <ModuleGroupNav />
      <Routes>
        <Route path="*" element={<FloatingNavigationBar />} />
      </Routes>
    </MemoryRouter>,
  )
}

function grantPermissions(...codes: string[]) {
  permissionState.permissions = new Set(codes)
}

const FLOTA_COMPLETA = ['logistics.vehicles.read', 'logistics.vehicles.verify']

beforeEach(() => {
  localStorage.clear()
  permissionState.isLoading = false
  grantPermissions()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FloatingNavigationBar · el botón de grupo entra a la página', () => {
  it('navega al módulo principal del grupo en vez de abrir un desplegable', async () => {
    const user = userEvent.setup()
    grantPermissions(...FLOTA_COMPLETA)
    renderNavigation('/dashboard')

    const boton = screen.getByRole('link', { name: /^Flota:/ })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await user.click(boton)

    expect(screen.getByTestId('ruta')).toHaveTextContent('/logistics/vehicles')
  })

  it('el enlace del grupo apunta al primer módulo del orden canónico', () => {
    grantPermissions(...FLOTA_COMPLETA)
    renderNavigation('/dashboard')

    expect(screen.getByRole('link', { name: /^Flota:/ })).toHaveAttribute(
      'href',
      '/logistics/vehicles',
    )
  })

  it('si el módulo principal no está permitido entra al primero que sí lo esté', () => {
    grantPermissions('logistics.vehicles.verify')
    renderNavigation('/dashboard')

    // Con un solo hijo visible el grupo se aplana en acceso directo.
    expect(
      screen.getByRole('link', { name: 'Verificaciones Vehiculares' }),
    ).toHaveAttribute('href', '/logistics/integrations/vehicle-verifications')
  })

  it('anuncia cuántas secciones agrupa', () => {
    grantPermissions(...FLOTA_COMPLETA)
    renderNavigation('/dashboard')

    expect(
      screen.getByRole('link', { name: 'Flota: Vehículos & Flota y 3 secciones más' }),
    ).toBeInTheDocument()
  })
})

describe('FloatingNavigationBar · visibilidad por permisos', () => {
  it('no muestra un grupo cuando el usuario no tiene ninguno de sus permisos', () => {
    renderNavigation('/dashboard')

    expect(screen.queryByRole('link', { name: /^Flota:/ })).not.toBeInTheDocument()
  })

  it('convierte el grupo en acceso directo cuando solo un hijo es visible', () => {
    grantPermissions('logistics.vehicles.verify')
    renderNavigation('/dashboard')

    expect(screen.getByRole('link', { name: 'Verificaciones Vehiculares' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Flota:/ })).not.toBeInTheDocument()
  })

  it('mientras cargan los permisos solo se ven los módulos legacy', () => {
    permissionState.isLoading = true
    renderNavigation('/dashboard')

    expect(screen.getByRole('link', { name: 'Panel principal' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Flota:/ })).not.toBeInTheDocument()
  })
})

describe('ModuleGroupNav · opciones en la parte superior', () => {
  it('no aparece fuera de un grupo', () => {
    grantPermissions(...FLOTA_COMPLETA)
    renderNavigation('/dashboard')

    expect(screen.queryByRole('navigation', { name: /Secciones de/ })).not.toBeInTheDocument()
  })

  it('lista las secciones del grupo activo al entrar a la página', () => {
    grantPermissions(...FLOTA_COMPLETA)
    renderNavigation('/logistics/vehicles')

    const subnav = screen.getByRole('navigation', { name: 'Secciones de Flota' })
    expect(within(subnav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Vehículos & Flota',
      'Marcas Vehiculares',
      'Modelos Vehiculares',
      'Verificaciones Vehiculares',
    ])
  })

  it('marca una única sección activa y permite saltar entre ellas', async () => {
    const user = userEvent.setup()
    grantPermissions(...FLOTA_COMPLETA)
    renderNavigation('/logistics/vehicles')

    const subnav = screen.getByRole('navigation', { name: 'Secciones de Flota' })
    const activos = within(subnav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(activos).toHaveLength(1)
    expect(activos[0]).toHaveTextContent('Vehículos & Flota')

    await user.click(within(subnav).getByRole('link', { name: 'Modelos Vehiculares' }))
    expect(screen.getByTestId('ruta')).toHaveTextContent('/logistics/vehicle-models')
  })

  it('sigue visible en las subrutas de detalle del módulo', () => {
    grantPermissions(...FLOTA_COMPLETA)
    renderNavigation('/logistics/vehicles/42/documents')

    const subnav = screen.getByRole('navigation', { name: 'Secciones de Flota' })
    expect(
      within(subnav).getByRole('link', { name: 'Vehículos & Flota' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('solo lista las secciones permitidas', () => {
    grantPermissions('logistics.putaway.read', 'logistics.putaway.execute')
    renderNavigation('/logistics/putaway')

    const subnav = screen.getByRole('navigation', { name: 'Secciones de Inventario' })
    const etiquetas = within(subnav).getAllByRole('link').map((link) => link.textContent)

    expect(etiquetas).toContain('Ubicación Dirigida')
    expect(etiquetas).toContain('Ubicación Móvil')
    expect(etiquetas).toContain('Inventario') // legacy siempre permitido
    expect(etiquetas).not.toContain('Libro de Inventario')
  })

  it('no aparece cuando el grupo se aplanó a un solo módulo', () => {
    grantPermissions('logistics.vehicles.verify')
    renderNavigation('/logistics/integrations/vehicle-verifications')

    expect(screen.queryByRole('navigation', { name: /Secciones de/ })).not.toBeInTheDocument()
  })

  it('distingue rutas solapadas: móvil no activa la de escritorio', () => {
    grantPermissions('logistics.putaway.read', 'logistics.putaway.execute')
    renderNavigation('/logistics/putaway/mobile')

    const subnav = screen.getByRole('navigation', { name: 'Secciones de Inventario' })
    const activos = within(subnav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')

    expect(activos).toHaveLength(1)
    expect(activos[0]).toHaveTextContent('Ubicación Móvil')
  })
})
