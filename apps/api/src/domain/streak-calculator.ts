import type { FrequencyType, HabitProps, HabitEntryRecord, TrackingType } from './habit.js';
import {
  addDays,
  diffDays,
  getDateRangeEndingAt,
  getIsoWeekDates,
  getIsoWeekMonday,
} from './date-utils.js';

export { getIsoWeekDates } from './date-utils.js';

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  completionRate30d: number;
  totalCompletions: number;
}

export interface HeatmapCell {
  date: string;
  value: number;
  targetValue: number;
  level: 0 | 1 | 2 | 3 | 4;
}

function isEntryCompleted(value: number, targetValue: number): boolean {
  if (value <= 0) return false;
  return targetValue <= 0 ? value > 0 : value >= targetValue;
}

function computeDailyStats(
  targetValue: number,
  entryMap: Map<string, number>,
  referenceDate: string,
): { currentStreak: number; bestStreak: number } {
  // Current streak calculation
  let currentStreak = 0;
  const isTodayCompleted = isEntryCompleted(entryMap.get(referenceDate) ?? 0, targetValue);
  const yesterday = addDays(referenceDate, -1);
  const isYesterdayCompleted = isEntryCompleted(entryMap.get(yesterday) ?? 0, targetValue);

  if (isTodayCompleted) {
    let cursor = referenceDate;
    while (isEntryCompleted(entryMap.get(cursor) ?? 0, targetValue)) {
      currentStreak++;
      cursor = addDays(cursor, -1);
    }
  } else if (isYesterdayCompleted) {
    // Preserved active daily streak when today is still in progress
    let cursor = yesterday;
    while (isEntryCompleted(entryMap.get(cursor) ?? 0, targetValue)) {
      currentStreak++;
      cursor = addDays(cursor, -1);
    }
  }

  // Best streak calculation across all completed dates up to referenceDate
  const completedDates: string[] = [];
  for (const [date, val] of entryMap.entries()) {
    if (date <= referenceDate && isEntryCompleted(val, targetValue)) {
      completedDates.push(date);
    }
  }
  completedDates.sort();

  let maxStreak = 0;
  let tempStreak = 0;
  let prevDate: string | null = null;

  for (const date of completedDates) {
    if (prevDate === null) {
      tempStreak = 1;
    } else if (addDays(prevDate, 1) === date) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }
    if (tempStreak > maxStreak) {
      maxStreak = tempStreak;
    }
    prevDate = date;
  }

  const bestStreak = Math.max(maxStreak, currentStreak);
  return { currentStreak, bestStreak };
}

function countCompletedInWeek(
  weekMonday: string,
  targetValue: number,
  entryMap: Map<string, number>,
): number {
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekMonday, i);
    const val = entryMap.get(d) ?? 0;
    if (isEntryCompleted(val, targetValue)) {
      count++;
    }
  }
  return count;
}

function computeWeeklyStats(
  targetValue: number,
  frequencyCount: number,
  entryMap: Map<string, number>,
  referenceDate: string,
): { currentStreak: number; bestStreak: number } {
  const reqCount = Math.max(1, frequencyCount);
  const currentWeekMonday = getIsoWeekMonday(referenceDate);
  const currentWeekSunday = addDays(currentWeekMonday, 6);

  // Count completions in current week up to referenceDate
  let completionsSoFar = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(currentWeekMonday, i);
    if (d <= referenceDate && isEntryCompleted(entryMap.get(d) ?? 0, targetValue)) {
      completionsSoFar++;
    }
  }

  // Check if current week is already met
  let currentStreak = 0;
  if (completionsSoFar >= reqCount) {
    let weekMon = currentWeekMonday;
    while (countCompletedInWeek(weekMon, targetValue, entryMap) >= reqCount) {
      currentStreak++;
      weekMon = addDays(weekMon, -7);
    }
  } else {
    // Current week is in progress. Check if it's still achievable:
    // Any remaining days in the week >= referenceDate that do not yet have completed entries
    let potentialDays = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(currentWeekMonday, i);
      if (d >= referenceDate && !isEntryCompleted(entryMap.get(d) ?? 0, targetValue)) {
        potentialDays++;
      }
    }

    const isAchievable = (completionsSoFar + potentialDays) >= reqCount;
    if (isAchievable && referenceDate <= currentWeekSunday) {
      // Preserve active weekly streak from immediately preceding ISO week
      let weekMon = addDays(currentWeekMonday, -7);
      while (countCompletedInWeek(weekMon, targetValue, entryMap) >= reqCount) {
        currentStreak++;
        weekMon = addDays(weekMon, -7);
      }
    }
  }

  // Best streak: maximum consecutive completed ISO weeks across history
  const completedWeekMondays = new Set<string>();
  for (const [date, val] of entryMap.entries()) {
    if (date <= referenceDate && isEntryCompleted(val, targetValue)) {
      const weekMon = getIsoWeekMonday(date);
      if (countCompletedInWeek(weekMon, targetValue, entryMap) >= reqCount) {
        completedWeekMondays.add(weekMon);
      }
    }
  }

  const sortedWeekMondays = Array.from(completedWeekMondays).sort();
  let maxStreak = 0;
  let tempStreak = 0;
  let prevWeek: string | null = null;

  for (const week of sortedWeekMondays) {
    if (prevWeek === null) {
      tempStreak = 1;
    } else if (addDays(prevWeek, 7) === week) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }
    if (tempStreak > maxStreak) {
      maxStreak = tempStreak;
    }
    prevWeek = week;
  }

  const bestStreak = Math.max(maxStreak, currentStreak);
  return { currentStreak, bestStreak };
}

export function calculateHabitStats(
  habit: Pick<HabitProps, 'trackingType' | 'targetValue' | 'frequencyType' | 'frequencyCount'>,
  entries: HabitEntryRecord[],
  referenceDate: string,
): HabitStats {
  const entryMap = new Map<string, number>();
  for (const entry of entries) {
    entryMap.set(entry.entryDate, entry.value);
  }

  let totalCompletions = 0;
  for (const [date, val] of entryMap.entries()) {
    if (date <= referenceDate && isEntryCompleted(val, habit.targetValue)) {
      totalCompletions++;
    }
  }

  let currentStreak = 0;
  let bestStreak = 0;
  let completionRate30d = 0;

  if (habit.frequencyType === 'daily') {
    const daily = computeDailyStats(habit.targetValue, entryMap, referenceDate);
    currentStreak = daily.currentStreak;
    bestStreak = daily.bestStreak;

    // 30-day window ending on referenceDate
    const last30Days = getDateRangeEndingAt(referenceDate, 30);
    let completedIn30Days = 0;
    for (const d of last30Days) {
      if (isEntryCompleted(entryMap.get(d) ?? 0, habit.targetValue)) {
        completedIn30Days++;
      }
    }
    completionRate30d = Math.min(100, Math.max(0, Math.round((completedIn30Days / 30) * 100)));
  } else {
    const weekly = computeWeeklyStats(
      habit.targetValue,
      habit.frequencyCount,
      entryMap,
      referenceDate,
    );
    currentStreak = weekly.currentStreak;
    bestStreak = weekly.bestStreak;

    // Last 4 ISO weeks ending with the week of referenceDate
    const currentWeekMonday = getIsoWeekMonday(referenceDate);
    const targetTotal = 4 * habit.frequencyCount;
    let completedIn4Weeks = 0;

    for (let w = 0; w < 4; w++) {
      const weekMon = addDays(currentWeekMonday, -w * 7);
      const count = countCompletedInWeek(weekMon, habit.targetValue, entryMap);
      completedIn4Weeks += Math.min(count, habit.frequencyCount);
    }

    completionRate30d = targetTotal > 0
      ? Math.min(100, Math.max(0, Math.round((completedIn4Weeks / targetTotal) * 100)))
      : 0;
  }

  return {
    currentStreak,
    bestStreak,
    completionRate30d,
    totalCompletions,
  };
}

export function buildHeatmapGrid(
  habit: Pick<HabitProps, 'targetValue'>,
  entries: HabitEntryRecord[],
  endDate: string,
  days = 365,
): HeatmapCell[] {
  const entryMap = new Map<string, number>();
  for (const entry of entries) {
    entryMap.set(entry.entryDate, entry.value);
  }

  const dates = getDateRangeEndingAt(endDate, days);
  const target = habit.targetValue;

  return dates.map((date) => {
    const value = entryMap.get(date) ?? 0;
    let level: 0 | 1 | 2 | 3 | 4 = 0;

    if (value <= 0) {
      level = 0;
    } else if (target <= 0) {
      level = 3;
    } else {
      const ratio = value / target;
      if (ratio < 0.5) {
        level = 1;
      } else if (ratio < 1) {
        level = 2;
      } else if (ratio === 1) {
        level = 3;
      } else {
        level = 4;
      }
    }

    return {
      date,
      value,
      targetValue: target,
      level,
    };
  });
}
