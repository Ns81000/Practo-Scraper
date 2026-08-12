import { useState, useEffect, useRef } from 'react';

type AutocompleteProps = {
  label: string;
  placeholder: string;
  endpoint: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

type Suggestion = {
  suggestion: string;
  category: string;
  city_slug?: string;
  original?: string;
  speciality?: string;
  word?: string;
};

export function Autocomplete({ label, placeholder, endpoint, value, onChange, disabled }: AutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (like initial state)
  useEffect(() => {
    if (value !== query) {
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }
      
      // Don't fetch if the query exactly matches the selected value
      if (query === value) {
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`http://localhost:8000${endpoint}&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data.results && data.results.default && data.results.default.matches) {
          setSuggestions(data.results.default.matches);
          setIsOpen(true);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error("Failed to fetch autocomplete", err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, endpoint, value]);

  const handleSelect = (sugg: Suggestion) => {
    // For location, Practo usually relies on city_slug or the suggestion itself
    // For specialty, it uses word or suggestion
    const finalValue = sugg.city_slug || sugg.original || sugg.word || sugg.suggestion;
    setQuery(sugg.suggestion); // show the pretty name in input
    onChange(finalValue); // pass the slug/system name to the parent
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <label className="block text-sm font-medium text-slate-400 mb-2">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
          placeholder={placeholder}
          disabled={disabled}
        />
        {isLoading && (
          <div className="absolute right-3 top-3">
            <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((sugg, idx) => (
            <li
              key={idx}
              onClick={() => handleSelect(sugg)}
              className="px-4 py-2 hover:bg-slate-700 cursor-pointer text-slate-200 flex justify-between items-center group transition-colors"
            >
              <span>{sugg.suggestion}</span>
              <span className="text-xs text-slate-500 group-hover:text-slate-400 uppercase tracking-wider">
                {sugg.category.replace('_', ' ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
