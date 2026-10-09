import type { ReactNode } from 'react';
import { emptyFilters, isFiltered } from '../core/filters';
import type { Filters } from '../core/types';
import { MultiSelect } from './MultiSelect';
import { ResetIcon, SearchIcon, XIcon } from './icons';

export type Zoom = 'day' | 'week' | 'month';

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  architects: string[];
  crews: string[];
  statuses: string[];
  colorFor: (architect: string) => string | undefined;
  visibleCount: number;
  totalCount: number;
  zoom: Zoom;
  onZoom: (z: Zoom) => void;
  compact: boolean;
  onCompact: (v: boolean) => void;
  onResetOrder: () => void;
  leftSlot?: ReactNode;
  showArchitects?: boolean;
}

export function FilterBar(p: Props) {
  const { filters, onChange } = p;
  return (
    <div className="filterbar" role="search">
      {p.leftSlot}
      <div className="search">
        <SearchIcon className="search__icon" />
        <input
          className="input search__input"
          type="search"
          placeholder="Search summary or key"
          aria-label="Search summary"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
      {p.showArchitects !== false && (
        <MultiSelect
          label="Architects"
          options={p.architects}
          selected={filters.architects}
          onChange={(architects) => onChange({ ...filters, architects })}
          colorFor={p.colorFor}
        />
      )}
      <MultiSelect
        label="Crews"
        options={p.crews}
        selected={filters.crews}
        onChange={(crews) => onChange({ ...filters, crews })}
      />
      <MultiSelect
        label="Status"
        options={p.statuses}
        selected={filters.statuses}
        onChange={(statuses) => onChange({ ...filters, statuses })}
      />
      {isFiltered(filters) && (
        <button type="button" className="btn btn--ghost" onClick={() => onChange(emptyFilters)}>
          <XIcon /> Clear filters
        </button>
      )}
      <span className="filterbar__count" aria-live="polite">
        {p.visibleCount === p.totalCount
          ? `${p.totalCount} items`
          : `${p.visibleCount} of ${p.totalCount} items`}
      </span>
      <div className="filterbar__spacer" />
      <label className="check check--inline">
        <input
          type="checkbox"
          checked={p.compact}
          onChange={(e) => p.onCompact(e.target.checked)}
        />
        <span>Compact</span>
      </label>
      <div className="segmented" role="group" aria-label="Timeline zoom">
        {(['day', 'week', 'month'] as Zoom[]).map((z) => (
          <button
            key={z}
            type="button"
            className={p.zoom === z ? 'is-active' : ''}
            aria-pressed={p.zoom === z}
            onClick={() => p.onZoom(z)}
          >
            {z[0]!.toUpperCase() + z.slice(1)}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={p.onResetOrder}
        title="Restore the original Jira rank order"
      >
        <ResetIcon /> Reset to Jira rank
      </button>
    </div>
  );
}
