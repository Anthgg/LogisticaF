import { useEffect, useRef, useState, useId, type KeyboardEvent } from 'react'
import { LogisticsIcon } from '../common/LogisticsIcon'

export interface ComboboxOption {
  value: string
  label: string
  description?: string
  code?: string
}

export interface SearchableComboboxProps {
  value: string | null | undefined
  options: ComboboxOption[]
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  isLoading?: boolean
  error?: string | null
  label?: string
  id?: string
  required?: boolean
  className?: string
  emptyMessage?: string
  allowClear?: boolean
}

export function SearchableCombobox({
  value,
  options,
  onChange,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  disabled = false,
  isLoading = false,
  error = null,
  label,
  id,
  required = false,
  className = '',
  emptyMessage = 'No se encontraron resultados',
  allowClear = false,
}: SearchableComboboxProps) {
  const generatedId = useId()
  const comboboxId = id || generatedId
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  const filteredOptions = options.filter((opt) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return (
      opt.label.toLowerCase().includes(term) ||
      (opt.code && opt.code.toLowerCase().includes(term)) ||
      (opt.description && opt.description.toLowerCase().includes(term))
    )
  })

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setSearch('')
    }
  }, [isOpen])

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll('li')
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled || isLoading) return

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev,
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  const handleSelect = (val: string) => {
    onChange(val)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div
      ref={containerRef}
      className={`field relative flex flex-col ${className}`.trim()}
    >
      {label && (
        <label
          id={`${comboboxId}-label`}
          htmlFor={comboboxId}
          className="field__label"
        >
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Accessible native select companion */}
      <select
        id={comboboxId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || isLoading}
        required={required}
        tabIndex={-1}
        className="sr-only"
      >
        <option value="" />
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="relative">
        <button
          type="button"
          id={`${comboboxId}-button`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={disabled || isLoading}
          onClick={() => setIsOpen((prev) => !prev)}
          onKeyDown={handleKeyDown}
          className={`flex h-9 w-full items-center justify-between rounded-lg border bg-white px-3 py-1.5 text-xs text-left transition-colors shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
            error
              ? 'border-rose-300 text-rose-900 focus-visible:border-rose-500 focus-visible:ring-rose-200'
              : 'border-slate-300 text-slate-800 hover:border-slate-400'
          }`}
        >
          <span className="truncate block flex-1 mr-1">
            {selectedOption ? (
              <span className="font-medium text-slate-900">
                {selectedOption.label}
                {selectedOption.code && (
                  <span className="ml-1.5 font-mono text-[10px] text-slate-400">
                    ({selectedOption.code})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-slate-400">
                {isLoading ? 'Cargando…' : placeholder}
              </span>
            )}
          </span>

          <div className="flex items-center gap-1 shrink-0 text-slate-400">
            {allowClear && selectedOption && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Limpiar selección"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    onChange('')
                  }
                }}
                className="p-0.5 rounded hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <LogisticsIcon name="x" size={12} />
              </span>
            )}
            <LogisticsIcon
              name="chevron"
              size={14}
              className={`transition-transform duration-150 ${isOpen ? 'rotate-180 text-primary' : ''}`}
              aria-hidden="true"
            />
          </div>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[220px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
            <div className="relative mb-1.5 flex items-center border-b border-slate-100 pb-1.5 px-1">
              <LogisticsIcon
                name="search"
                size={13}
                className="text-slate-400 mr-1.5 shrink-0"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setHighlightedIndex(0)
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    inputRef.current?.focus()
                  }}
                  className="p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  aria-label="Borrar búsqueda"
                >
                  <LogisticsIcon name="x" size={12} />
                </button>
              )}
            </div>

            <ul
              ref={listRef}
              role="listbox"
              id={`${comboboxId}-listbox`}
              className="max-h-56 overflow-y-auto scrollbar-thin py-0.5 text-xs focus:outline-none"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-2.5 py-3 text-center text-xs text-slate-400">
                  {emptyMessage}
                </li>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === value
                  const isHighlighted = idx === highlightedIndex

                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`relative flex cursor-pointer select-none items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${
                        isHighlighted
                          ? 'bg-slate-100 text-slate-900'
                          : isSelected
                            ? 'bg-slate-50 text-primary font-medium'
                            : 'text-slate-700'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-4">
                        <span className="truncate">
                          {opt.label}
                          {opt.code && (
                            <span className="ml-1.5 font-mono text-[10px] text-slate-400">
                              ({opt.code})
                            </span>
                          )}
                        </span>
                        {opt.description && (
                          <span className="text-[10px] text-slate-400 truncate">
                            {opt.description}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <LogisticsIcon
                          name="check"
                          size={13}
                          className="text-primary shrink-0 ml-1"
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        )}
      </div>

      {error && <p className="field__help field__help--error mt-1">{error}</p>}
    </div>
  )
}
