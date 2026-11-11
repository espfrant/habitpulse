export function parseDateToUtcNoon(dateStr: string): Date {
  const parts = dateStr.split('-');
  const y = Number.parseInt(parts[0] ?? '1970', 10);
  const m = Number.parseInt(parts[1] ?? '1', 10);
  const d = Number.parseInt(parts[2] ?? '1', 10);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

export function formatDateToIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateToUtcNoon(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateToIso(d);
}

export function diffDays(dateA: string, dateB: string): number {
  const tA = parseDateToUtcNoon(dateA).getTime();
  const tB = parseDateToUtcNoon(dateB).getTime();
  return Math.round((tA - tB) / (1000 * 60 * 60 * 24));
}

export function getIsoDayOfWeek(dateStr: string): number {
  const day = parseDateToUtcNoon(dateStr).getUTCDay();
  return day === 0 ? 7 : day;
}

export function getIsoWeekMonday(dateStr: string): string {
  const day = getIsoDayOfWeek(dateStr);
  return addDays(dateStr, -(day - 1));
}

export function getIsoWeekDates(referenceDate: string): string[] {
  const monday = getIsoWeekMonday(referenceDate);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function getDateRangeEndingAt(endDate: string, days: number): string[] {
  const result: string[] = [];
  const startOffset = days - 1;
  for (let i = startOffset; i >= 0; i--) {
    result.push(addDays(endDate, -i));
  }
  return result;
}
