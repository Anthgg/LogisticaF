import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SearchableCombobox, type ComboboxOption } from './SearchableCombobox'

describe('SearchableCombobox', () => {
  const options: ComboboxOption[] = [
    { value: 'PE', label: 'Perú', code: 'PE' },
    { value: 'CL', label: 'Chile', code: 'CL' },
    { value: 'CO', label: 'Colombia', code: 'CO' },
  ]

  it('renders with placeholder when no value is selected', () => {
    render(
      <SearchableCombobox
        label="País"
        value={null}
        options={options}
        placeholder="Elige un país"
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('País')).toBeInTheDocument()
    expect(screen.getByText('Elige un país')).toBeInTheDocument()
  })

  it('renders selected option label', () => {
    render(
      <SearchableCombobox
        label="País"
        value="PE"
        options={options}
        onChange={vi.fn()}
      />,
    )

    const matches = screen.getAllByText('Perú')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('opens options list on click and allows selection', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <SearchableCombobox
        label="País"
        value={null}
        options={options}
        placeholder="Elige un país"
        onChange={handleChange}
      />,
    )

    const trigger = screen.getByRole('button')
    await user.click(trigger)

    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument()
    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()

    const chileOption = within(listbox).getByRole('option', { name: /Chile/i })
    await user.click(chileOption)

    expect(handleChange).toHaveBeenCalledWith('CL')
  })

  it('filters options by search term', async () => {
    const user = userEvent.setup()

    render(
      <SearchableCombobox
        label="País"
        value={null}
        options={options}
        onChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button'))

    const searchInput = screen.getByPlaceholderText('Buscar...')
    await user.type(searchInput, 'Col')

    const listbox = screen.getByRole('listbox')
    expect(listbox).toHaveTextContent('Colombia')
    expect(listbox).not.toHaveTextContent('Perú')
    expect(listbox).not.toHaveTextContent('Chile')
  })

  it('supports keyboard navigation', async () => {
    const handleChange = vi.fn()

    render(
      <SearchableCombobox
        label="País"
        value={null}
        options={options}
        onChange={handleChange}
      />,
    )

    const trigger = screen.getByRole('button')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const searchInput = screen.getByPlaceholderText('Buscar...')
    expect(searchInput).toBeInTheDocument()

    fireEvent.keyDown(searchInput, { key: 'ArrowDown' })
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    expect(handleChange).toHaveBeenCalledWith('CL')
  })

  it('shows empty message when filter has no matches', async () => {
    const user = userEvent.setup()

    render(
      <SearchableCombobox
        label="País"
        value={null}
        options={options}
        emptyMessage="Sin resultados encontrados"
        onChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button'))
    const searchInput = screen.getByPlaceholderText('Buscar...')
    await user.type(searchInput, 'XYZ')

    expect(screen.getByText('Sin resultados encontrados')).toBeInTheDocument()
  })
})
