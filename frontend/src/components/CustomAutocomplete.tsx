import { useState, useEffect, useRef } from 'react'

type Suggestion = {
  suggestion: string
  category: string
  city_slug?: string
  original?: string
  speciality?: string
  word?: string
}

interface CustomAutocompleteProps {
  label: string
  placeholder: string
  endpoint: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function CustomAutocomplete({
  label,
  placeholder,
  endpoint,
  value,
  onChange,
  disabled = false,
}: CustomAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value !== query) setQuery(value)
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2 || query === value) {
        if (query.length < 2) setSuggestions([])
        return
      }

      setIsLoading(true)
      try {
        const res = await fetch(
          `http://localhost:8000${endpoint}&query=${encodeURIComponent(query)}`
        )
        const data = await res.json()

        if (data.results?.default?.matches) {
          setSuggestions(data.results.default.matches)
          setIsOpen(true)
          setActiveIndex(-1)
        } else {
          setSuggestions([])
        }
      } catch {
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, endpoint, value])

  function handleSelect(sugg: Suggestion) {
    const finalValue =
      sugg.city_slug || sugg.original || sugg.word || sugg.suggestion
    setQuery(sugg.suggestion)
    onChange(finalValue)
    setIsOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <label className="block text-body-sm font-medium text-clay-muted mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={[
            'w-full bg-clay-canvas text-clay-ink text-body-md',
            'rounded-[var(--radius-clay-md)] h-[44px] px-4 pr-10',
            'border border-clay-hairline',
            'transition-all duration-150',
            'placeholder:text-clay-muted-soft',
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-clay-muted-soft',
            isOpen && suggestions.length > 0
              ? 'border-clay-ink'
              : 'focus:border-clay-ink',
          ].join(' ')}
          style={{ outline: 'none' }}
        />

        {/* Loading spinner or search icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <svg
              className="animate-spin h-4 w-4 text-clay-muted"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-clay-muted-soft"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          className={[
            'absolute z-20 w-full mt-1',
            'bg-clay-canvas border border-clay-hairline',
            'rounded-[var(--radius-clay-md)]',
            'shadow-sm max-h-[240px] overflow-auto',
            'animate-slide-down',
            'clay-scrollbar',
          ].join(' ')}
        >
          {suggestions.map((sugg, idx) => (
            <li
              key={idx}
              role="option"
              aria-selected={idx === activeIndex}
              onClick={() => handleSelect(sugg)}
              className={[
                'px-4 py-3 cursor-pointer text-body-md',
                'flex items-center justify-between',
                'transition-colors duration-100',
                idx === activeIndex
                  ? 'bg-clay-surface-card'
                  : 'hover:bg-clay-surface-soft',
              ].join(' ')}
            >
              <span className="text-clay-ink">{sugg.suggestion}</span>
              <span
                className={[
                  'text-caption-uppercase',
                  'bg-clay-surface-card text-clay-muted',
                  'px-2 py-0.5',
                  'rounded-[var(--radius-clay-pill)]',
                ].join(' ')}
              >
                {sugg.category.replace('_', ' ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
