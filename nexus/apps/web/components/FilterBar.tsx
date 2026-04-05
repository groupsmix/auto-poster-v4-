/**
 * Reusable filter bar wrapper.
 *
 * Provides the consistent card-style container used on Products, History,
 * and Content pages. Pass filter controls as children.
 *
 * Usage:
 *   <FilterBar>
 *     <FilterBar.Search value={q} onChange={setQ} placeholder="Search..." />
 *     <FilterBar.Select value={v} onChange={setV} options={opts} />
 *   </FilterBar>
 */

import { SearchIcon } from "@/components/icons/Icons";

interface FilterBarProps {
  children: React.ReactNode;
}

function FilterBar({ children }: FilterBarProps) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-center">{children}</div>
    </div>
  );
}

/* ── Sub-components ── */

interface SearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

function FilterSearch({ value, onChange, placeholder = "Search...", className = "w-48" }: SearchProps) {
  return (
    <div className="relative">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`pl-9 pr-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent ${className}`}
      />
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
}

function FilterSelect({ value, onChange, options }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground focus:outline-none focus:border-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

FilterBar.Search = FilterSearch;
FilterBar.Select = FilterSelect;

export default FilterBar;
