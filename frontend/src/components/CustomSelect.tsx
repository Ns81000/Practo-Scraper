import { useState, useRef, useEffect } from 'react'

interface SelectOption {
  label: string
  value: number | string
}

interface CustomSelectProps {
  label: string
  options: SelectOption[]
  value: number | string
  onChange: (value: number | string) => void
  disabled?: boolean
}

export function CustomSelect({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(!isOpen)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const currentIndex = options.findIndex((o) => o.value === value)
      const nextIndex =
        e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, options.length - 1)
          : Math.max(currentIndex - 1, 0)
      onChange(options[nextIndex].value)
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <label className="block text-body-sm font-medium text-clay-muted mb-2">
        {label}
      </label>
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={[
          'w-full bg-clay-canvas text-clay-ink text-body-md',
          'rounded-[var(--radius-clay-md)] h-[44px] px-4',
          'border border-clay-hairline',
          'flex items-center justify-between',
          'transition-all duration-150',
          'cursor-pointer',
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-clay-muted-soft',
          isOpen ? 'border-clay-ink' : '',
        ].join(' ')}
      >
        <span>{selectedOption?.label || 'Select...'}</span>
        <svg
          className={[
            'w-4 h-4 text-clay-muted transition-transform duration-150',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className={[
            'absolute z-20 w-full mt-1',
            'bg-clay-canvas border border-clay-hairline',
            'rounded-[var(--radius-clay-md)]',
            'shadow-sm',
            'animate-slide-down',
            'overflow-hidden',
          ].join(' ')}
        >
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={[
                'px-4 py-3 cursor-pointer text-body-md',
                'transition-colors duration-100',
                option.value === value
                  ? 'bg-clay-surface-card text-clay-ink font-medium'
                  : 'text-clay-body hover:bg-clay-surface-soft',
              ].join(' ')}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
