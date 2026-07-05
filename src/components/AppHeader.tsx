import { ChevronLeft, ChevronRight, Menu, Search, X } from 'lucide-react';
import { currency } from '../lib/utils';
import type { PeriodMode } from '../lib/period';
import { PeriodFilter } from './PeriodFilter';

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#6f6d5a] bg-[#48483f]/50 p-3 lg:p-4">
      <p className="text-[clamp(0.85rem,3.5vw,1rem)] font-bold tracking-wide text-[#fff9bf] lg:text-sm">{label}</p>
      <p className="mt-1 text-[clamp(1.35rem,6vw,1.875rem)] font-semibold text-[#ff8667]">{currency.format(value)}</p>
    </div>
  );
}

export function AppHeader({
  groupName, totalExpense, periodMode, periodLabel, searchOpen, searchTerm, categoryFilter,
  periodFilterOpen, activeGroupId, groups, onGroupChange,
  onPrevPeriod, onNextPeriod, onToggleSearch, onSearchChange, onClearCategoryFilter,
  onPeriodModeChange, onTogglePeriodFilter, onClosePeriodFilter,
  onMenu, showGroupSelect = true, apiConnected = false
}: {
  groupName: string; totalExpense: number; periodMode: PeriodMode; periodLabel: string;
  searchOpen: boolean; searchTerm: string; categoryFilter: string | null; periodFilterOpen: boolean;
  activeGroupId: string; groups: { id: string; name: string }[]; onGroupChange: (id: string) => void;
  onPrevPeriod: () => void; onNextPeriod: () => void; onToggleSearch: () => void;
  onSearchChange: (v: string) => void; onClearCategoryFilter: () => void;
  onPeriodModeChange: (mode: PeriodMode) => void; onTogglePeriodFilter: () => void; onClosePeriodFilter: () => void;
  onMenu: () => void; showGroupSelect?: boolean; apiConnected?: boolean;
}) {
  const modeLabel = periodMode.charAt(0).toUpperCase() + periodMode.slice(1);

  return (
    <header className="bg-[#56564f] px-4 pb-4 pt-5 shadow-lg sm:px-6 sm:pb-5 sm:pt-8 lg:rounded-b-2xl lg:px-8">
      {apiConnected && (
        <p className="mb-3 flex items-center gap-2 text-xs text-[#86d28e] lg:hidden">
          <span className="size-2 rounded-full bg-[#86d28e]" />
          MongoDB connected
        </p>
      )}
      <div className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
        <button className="text-[#f5ff8f] lg:hidden" aria-label="Menu" onClick={onMenu}>
          <Menu size={34} />
        </button>
        <div className="flex flex-1 items-center justify-center gap-3 lg:justify-start">
          <span className="font-serif text-[clamp(1.85rem,8vw,2.5rem)] font-bold italic leading-tight text-[#f5ff8f] lg:hidden">SplitNest</span>
          {showGroupSelect && (
            <select
              className="max-w-36 bg-transparent text-xs text-[#d8d4b4] outline-none sm:max-w-44 sm:text-sm lg:hidden"
              value={activeGroupId}
              onChange={(event) => onGroupChange(event.target.value)}
              aria-label="Group"
            >
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <span className="hidden text-2xl font-semibold text-[#fff9bf] lg:inline">{groupName}</span>
        </div>
        <button className="text-[#fff9bf]" onClick={onToggleSearch} aria-label="Search">
          <Search size={32} />
        </button>
      </div>

      {searchOpen && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border-2 border-[#b8b493] px-3 py-2">
          <Search size={22} />
          <input
            className="min-w-0 flex-1 bg-transparent text-xl outline-none placeholder:text-[#d8d4b4]"
            placeholder="Search records, accounts, notes"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <button onClick={() => onSearchChange('')} aria-label="Clear search"><X size={22} /></button>
        </div>
      )}

      {categoryFilter && (
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-lg border-2 border-[#fff27c] px-3 py-1 text-sm">Filter: {categoryFilter}</span>
          <button className="my-btn px-3 py-1 text-sm" onClick={onClearCategoryFilter}>Clear</button>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="rounded-lg border border-[#6f6d5a] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#b8b493]">
          {modeLabel} view · Mon–Sun weeks
        </span>
      </div>

      <div className="mb-6 grid grid-cols-[36px_1fr_36px_36px] items-center gap-1 text-center sm:grid-cols-[48px_1fr_48px_48px] sm:gap-2 lg:max-w-2xl">
        <button onClick={onPrevPeriod} aria-label="Previous period"><ChevronLeft className="mx-auto text-[#fff9bf]" size={34} /></button>
        <p className="truncate text-[clamp(1.25rem,5.5vw,1.75rem)] font-semibold">{periodLabel}</p>
        <button onClick={onNextPeriod} aria-label="Next period"><ChevronRight className="mx-auto text-[#fff9bf]" size={34} /></button>
        <PeriodFilter
          mode={periodMode}
          onChange={onPeriodModeChange}
          open={periodFilterOpen}
          onToggle={onTogglePeriodFilter}
          onClose={onClosePeriodFilter}
        />
      </div>

      <div className="grid max-w-md grid-cols-1 gap-4 text-center lg:max-w-sm">
        <SummaryMetric label="TOTAL EXPENSE" value={totalExpense} />
      </div>
    </header>
  );
}