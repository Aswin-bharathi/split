export type PeriodMode = 'daily' | 'weekly' | 'monthly';

export const PERIOD_MODES: { mode: PeriodMode; label: string }[] = [
  { mode: 'daily', label: 'Daily' },
  { mode: 'weekly', label: 'Weekly' },
  { mode: 'monthly', label: 'Monthly' }
];

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** Week starts Monday, ends Sunday */
export const startOfWeek = (date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
};

export const endOfWeek = (date = new Date()) => {
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const startOfMonth = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return start;
};

export const endOfMonth = (date = new Date()) => {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const startOfDay = (date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

export const endOfDay = (date = new Date()) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const getPeriodRange = (mode: PeriodMode, anchor: Date) => {
  if (mode === 'daily') {
    return { start: startOfDay(anchor), end: endOfDay(anchor) };
  }
  if (mode === 'monthly') {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
  return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
};

export const getDefaultAnchor = (mode: PeriodMode) => {
  const today = new Date();
  if (mode === 'daily') return startOfDay(today);
  if (mode === 'monthly') return startOfMonth(today);
  return startOfWeek(today);
};

export const shiftPeriod = (mode: PeriodMode, anchor: Date, direction: -1 | 1) => {
  const next = new Date(anchor);
  if (mode === 'daily') {
    next.setDate(next.getDate() + direction);
    return startOfDay(next);
  }
  if (mode === 'monthly') {
    next.setMonth(next.getMonth() + direction);
    return startOfMonth(next);
  }
  next.setDate(next.getDate() + direction * 7);
  return startOfWeek(next);
};

export const formatPeriodLabel = (mode: PeriodMode, anchor: Date) => {
  const { start, end } = getPeriodRange(mode, anchor);
  if (mode === 'daily') {
    return start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  if (mode === 'monthly') {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  const startText = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endText = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startText} – ${endText}`;
};

export const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getPeriodKey = (mode: PeriodMode, start: Date, end: Date) =>
  `${mode}:${formatDateKey(start)}:${formatDateKey(end)}`;

export const isDateInPeriod = (dateStr: string, start: Date, end: Date) => {
  const expenseDate = new Date(`${dateStr}T12:00:00`);
  return expenseDate >= start && expenseDate <= end;
};
