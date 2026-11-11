import {
  DEFAULT_USER_ID,
  type CatppuccinColor,
  type FrequencyType,
  type HabitProps,
  type TrackingType,
} from '../domain/habit.js';
import { getIsoWeekDates } from '../domain/date-utils.js';
import {
  calculateHabitStats,
  buildHeatmapGrid,
  type HabitStats,
  type HeatmapCell,
} from '../domain/streak-calculator.js';
import type {
  CreateHabitInput,
  HabitRepository,
} from '../infrastructure/repositories/habit-repository.js';

export class NotFoundError extends Error {
  statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export interface HabitWeekEntry {
  date: string;
  value: number;
  completed: boolean;
}

export interface HabitDashboardItem {
  id: string;
  name: string;
  description: string | null;
  color: CatppuccinColor;
  trackingType: TrackingType;
  targetValue: number;
  unit: string | null;
  frequencyType: FrequencyType;
  frequencyCount: number;
  createdAt: string;
  currentStreak: number;
  bestStreak: number;
  completionRate30d: number;
  totalCompletions: number;
  weekEntries: HabitWeekEntry[];
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

export interface UpsertEntryResponse extends HabitDashboardItem {
  entry: HabitWeekEntry;
}

export interface HabitHeatmapResponse {
  habit: {
    id: string;
    name: string;
    description: string | null;
    color: CatppuccinColor;
    trackingType: TrackingType;
    targetValue: number;
    unit: string | null;
    frequencyType: FrequencyType;
    frequencyCount: number;
    createdAt: string;
  };
  stats: HabitStats;
  cells: HeatmapCell[];
}

export class HabitService {
  constructor(
    private repository: HabitRepository,
    private defaultUserId: string = DEFAULT_USER_ID,
  ) {}

  async listHabits(userId: string = this.defaultUserId): Promise<HabitProps[]> {
    return this.repository.listHabits(userId);
  }

  async getDashboard(
    referenceDate: string,
    userId: string = this.defaultUserId,
  ): Promise<DashboardResponse> {
    const habits = await this.repository.listHabits(userId);
    const weekDates = getIsoWeekDates(referenceDate);

    if (habits.length === 0) {
      return {
        date: referenceDate,
        weekDates,
        summary: {
          activeDailyStreakSum: 0,
          bestActiveStreak: 0,
          completedTodayCount: 0,
          totalHabitsCount: 0,
          monthlyCompletionRate: 0,
        },
        habits: [],
      };
    }

    const habitIds = habits.map((h) => h.id);
    const entriesMap = await this.repository.getEntriesForHabits(habitIds);

    const dashboardHabits: HabitDashboardItem[] = habits.map((habit) => {
      const entries = entriesMap.get(habit.id) ?? [];
      const stats = calculateHabitStats(habit, entries, referenceDate);
      const entryMap = new Map(entries.map((e) => [e.entryDate, e.value]));
      const target = habit.trackingType === 'boolean' ? 1 : habit.targetValue;

      const weekEntries: HabitWeekEntry[] = weekDates.map((date) => {
        const val = entryMap.get(date) ?? 0;
        const completed =
          val > 0 && (habit.trackingType === 'boolean' ? val >= 1 : val >= target);
        return {
          date,
          value: val,
          completed,
        };
      });

      return {
        id: habit.id,
        name: habit.name,
        description: habit.description,
        color: habit.color,
        trackingType: habit.trackingType,
        targetValue: target,
        unit: habit.unit,
        frequencyType: habit.frequencyType,
        frequencyCount: habit.frequencyCount,
        createdAt: habit.createdAt.toISOString(),
        currentStreak: stats.currentStreak,
        bestStreak: stats.bestStreak,
        completionRate30d: stats.completionRate30d,
        totalCompletions: stats.totalCompletions,
        weekEntries,
      };
    });

    const dailyHabits = dashboardHabits.filter((h) => h.frequencyType === 'daily');
    const activeDailyStreakSum = dailyHabits.reduce(
      (sum, h) => sum + h.currentStreak,
      0,
    );

    const bestActiveStreak =
      dashboardHabits.length > 0
        ? Math.max(...dashboardHabits.map((h) => h.currentStreak))
        : 0;

    const completedTodayCount = dashboardHabits.filter((h) => {
      const todayEntry = h.weekEntries.find((e) => e.date === referenceDate);
      return todayEntry?.completed ?? false;
    }).length;

    const totalHabitsCount = dashboardHabits.length;

    const monthlyCompletionRate =
      dashboardHabits.length > 0
        ? Math.round(
            dashboardHabits.reduce((acc, h) => acc + h.completionRate30d, 0) /
              dashboardHabits.length,
          )
        : 0;

    return {
      date: referenceDate,
      weekDates,
      summary: {
        activeDailyStreakSum,
        bestActiveStreak,
        completedTodayCount,
        totalHabitsCount,
        monthlyCompletionRate,
      },
      habits: dashboardHabits,
    };
  }

  async createHabit(
    input: CreateHabitInput,
    userId: string = this.defaultUserId,
  ): Promise<HabitProps> {
    return this.repository.createHabit({
      ...input,
      userId: input.userId ?? userId,
    });
  }

  async deleteHabit(
    habitId: string,
    userId: string = this.defaultUserId,
  ): Promise<void> {
    const deleted = await this.repository.deleteHabit(habitId, userId);
    if (!deleted) {
      throw new NotFoundError(`Habit with ID '${habitId}' not found`);
    }
  }

  async upsertHabitEntry(
    habitId: string,
    date: string,
    value: number,
    referenceDate?: string,
    userId: string = this.defaultUserId,
  ): Promise<UpsertEntryResponse> {
    const habit = await this.repository.getHabitById(habitId, userId);
    if (!habit) {
      throw new NotFoundError(`Habit with ID '${habitId}' not found`);
    }

    await this.repository.upsertEntry(habitId, date, value);

    const refDate = referenceDate ?? date;
    const entriesMap = await this.repository.getEntriesForHabits([habitId]);
    const entries = entriesMap.get(habitId) ?? [];
    const stats = calculateHabitStats(habit, entries, refDate);

    const weekDates = getIsoWeekDates(refDate);
    const entryMap = new Map(entries.map((e) => [e.entryDate, e.value]));
    const target = habit.trackingType === 'boolean' ? 1 : habit.targetValue;

    const weekEntries: HabitWeekEntry[] = weekDates.map((d) => {
      const val = entryMap.get(d) ?? 0;
      const completed =
        val > 0 && (habit.trackingType === 'boolean' ? val >= 1 : val >= target);
      return {
        date: d,
        value: val,
        completed,
      };
    });

    const entryVal = entryMap.get(date) ?? 0;
    const completed =
      entryVal > 0 && (habit.trackingType === 'boolean' ? entryVal >= 1 : entryVal >= target);

    return {
      id: habit.id,
      name: habit.name,
      description: habit.description,
      color: habit.color,
      trackingType: habit.trackingType,
      targetValue: target,
      unit: habit.unit,
      frequencyType: habit.frequencyType,
      frequencyCount: habit.frequencyCount,
      createdAt: habit.createdAt.toISOString(),
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      completionRate30d: stats.completionRate30d,
      totalCompletions: stats.totalCompletions,
      weekEntries,
      entry: {
        date,
        value: entryVal,
        completed,
      },
    };
  }

  async getHabitHeatmap(
    habitId: string,
    endDate: string,
    days: number = 365,
    userId: string = this.defaultUserId,
  ): Promise<HabitHeatmapResponse> {
    const habit = await this.repository.getHabitById(habitId, userId);
    if (!habit) {
      throw new NotFoundError(`Habit with ID '${habitId}' not found`);
    }

    const entriesMap = await this.repository.getEntriesForHabits([habitId]);
    const entries = entriesMap.get(habitId) ?? [];
    const stats = calculateHabitStats(habit, entries, endDate);
    const cells = buildHeatmapGrid(habit, entries, endDate, days);

    return {
      habit: {
        id: habit.id,
        name: habit.name,
        description: habit.description,
        color: habit.color,
        trackingType: habit.trackingType,
        targetValue: habit.trackingType === 'boolean' ? 1 : habit.targetValue,
        unit: habit.unit,
        frequencyType: habit.frequencyType,
        frequencyCount: habit.frequencyCount,
        createdAt: habit.createdAt.toISOString(),
      },
      stats,
      cells,
    };
  }

  async seedDemoData(
    referenceDate: string,
    userId: string = this.defaultUserId,
  ): Promise<{ habitsCreated: number; entriesCreated: number; referenceDate: string }> {
    const result = await this.repository.replaceAllWithDemoData(userId, referenceDate);
    return {
      ...result,
      referenceDate,
    };
  }
}
