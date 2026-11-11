import type { CatppuccinColor } from '../theme/catppuccin';

export interface WeekEntry {
  date: string;
  value: number;
  completed: boolean;
}

export interface HabitDashboardItem {
  id: string;
  userId?: string;
  name: string;
  description: string | null;
  color: CatppuccinColor;
  trackingType: 'boolean' | 'quantitative';
  targetValue: number;
  unit: string | null;
  frequencyType: 'daily' | 'weekly';
  frequencyCount: number;
  createdAt: string;
  currentStreak: number;
  bestStreak: number;
  completionRate30d: number;
  totalCompletions: number;
  weekEntries: WeekEntry[];
}

export interface DashboardSummary {
  activeDailyStreakSum: number;
  bestActiveStreak: number;
  completedTodayCount: number;
  totalHabitsCount: number;
  monthlyCompletionRate: number;
}

export interface DashboardResponse {
  date: string;
  weekDates: string[];
  summary: DashboardSummary;
  habits: HabitDashboardItem[];
}

export interface HeatmapCell {
  date: string;
  value: number;
  targetValue: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapResponse {
  habit: {
    id: string;
    name: string;
    color: CatppuccinColor;
    trackingType: 'boolean' | 'quantitative';
    targetValue: number;
    unit: string | null;
  };
  stats: {
    currentStreak: number;
    bestStreak: number;
    completionRate30d: number;
    totalCompletions: number;
  };
  cells: HeatmapCell[];
}

export interface CreateHabitInput {
  name: string;
  description?: string | null;
  color: CatppuccinColor;
  trackingType: 'boolean' | 'quantitative';
  targetValue?: number;
  unit?: string | null;
  frequencyType: 'daily' | 'weekly';
  frequencyCount?: number;
}

export interface SeedResponse {
  habitsCreated: number;
  entriesCreated: number;
  referenceDate: string;
}

const BASE_URL = '';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.message) {
        errMsg = data.message;
      }
    } catch {
      // ignore json parse failure
    }
    throw new Error(errMsg);
  }
  if (res.status === 204) {
    return undefined as unknown as T;
  }
  return res.json() as Promise<T>;
}

export async function getDashboard(date?: string): Promise<DashboardResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`${BASE_URL}/api/v1/dashboard${query}`);
  return handleResponse<DashboardResponse>(res);
}

export async function createHabit(input: CreateHabitInput): Promise<HabitDashboardItem> {
  const res = await fetch(`${BASE_URL}/api/v1/habits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<HabitDashboardItem>(res);
}

export async function deleteHabit(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/habits/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return handleResponse<void>(res);
}

export async function upsertHabitEntry(
  id: string,
  date: string,
  value: number,
  referenceDate?: string,
): Promise<HabitDashboardItem> {
  const query = referenceDate ? `?referenceDate=${encodeURIComponent(referenceDate)}` : '';
  const res = await fetch(
    `${BASE_URL}/api/v1/habits/${encodeURIComponent(id)}/entries/${encodeURIComponent(date)}${query}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    },
  );
  return handleResponse<HabitDashboardItem>(res);
}

export async function getHabitHeatmap(
  id: string,
  endDate?: string,
  days: number = 365,
): Promise<HeatmapResponse> {
  const params = new URLSearchParams();
  if (endDate) params.set('endDate', endDate);
  if (days) params.set('days', days.toString());
  const query = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(
    `${BASE_URL}/api/v1/habits/${encodeURIComponent(id)}/heatmap${query}`,
  );
  return handleResponse<HeatmapResponse>(res);
}

export async function seedDemoData(referenceDate?: string): Promise<SeedResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/demo/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(referenceDate ? { referenceDate } : {}),
  });
  return handleResponse<SeedResponse>(res);
}
