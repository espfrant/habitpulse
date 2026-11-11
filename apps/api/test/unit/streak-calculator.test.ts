import { describe, expect, it } from 'vitest';
import {
  buildHeatmapGrid,
  calculateHabitStats,
  getIsoWeekDates,
} from '../../src/domain/streak-calculator.js';

describe('streak-calculator domain logic', () => {
  it('computes daily streak when today is completed', () => {
    const stats = calculateHabitStats(
      { trackingType: 'boolean', targetValue: 1, frequencyType: 'daily', frequencyCount: 1 },
      [
        { entryDate: '2026-11-09', value: 1 },
        { entryDate: '2026-11-10', value: 1 },
        { entryDate: '2026-11-11', value: 1 },
      ],
      '2026-11-11',
    );
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
    expect(stats.totalCompletions).toBe(3);
  });

  it('preserves active daily streak in the morning when yesterday was completed but today has no entry yet', () => {
    const stats = calculateHabitStats(
      { trackingType: 'quantitative', targetValue: 20, frequencyType: 'daily', frequencyCount: 1 },
      [
        { entryDate: '2026-11-09', value: 20 },
        { entryDate: '2026-11-10', value: 25 },
      ],
      '2026-11-11',
    );
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestStreak).toBe(2);
  });

  it('ignores entries with value = 0 or below targetValue when computing streaks', () => {
    const stats = calculateHabitStats(
      { trackingType: 'quantitative', targetValue: 20, frequencyType: 'daily', frequencyCount: 1 },
      [
        { entryDate: '2026-11-09', value: 20 },
        { entryDate: '2026-11-10', value: 0 },
        { entryDate: '2026-11-11', value: 15 },
      ],
      '2026-11-11',
    );
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(1);
    expect(stats.totalCompletions).toBe(1);
  });

  it('computes weekly streak across year boundaries (Dec–Jan ISO weeks)', () => {
    // 2025-12-22..2025-12-28 (Week 1: 3 completions)
    // 2025-12-29..2026-01-04 (Week 2 crossing New Year: 3 completions)
    // 2026-01-05..2026-01-11 (Current week on 2026-01-07: 1 completion so far, still in progress)
    const stats = calculateHabitStats(
      { trackingType: 'boolean', targetValue: 1, frequencyType: 'weekly', frequencyCount: 3 },
      [
        { entryDate: '2025-12-22', value: 1 },
        { entryDate: '2025-12-24', value: 1 },
        { entryDate: '2025-12-26', value: 1 },
        { entryDate: '2025-12-29', value: 1 },
        { entryDate: '2025-12-31', value: 1 },
        { entryDate: '2026-01-02', value: 1 },
        { entryDate: '2026-01-05', value: 1 },
      ],
      '2026-01-07',
    );
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestStreak).toBe(2);
  });

  it('maps heatmap intensity levels 0..4 accurately', () => {
    const grid = buildHeatmapGrid(
      { targetValue: 20 },
      [
        { entryDate: '2026-11-08', value: 0 },
        { entryDate: '2026-11-09', value: 5 },   // 25% -> level 1
        { entryDate: '2026-11-10', value: 10 },  // 50% -> level 2
        { entryDate: '2026-11-11', value: 20 },  // 100% -> level 3
        { entryDate: '2026-11-12', value: 30 },  // 150% -> level 4
      ],
      '2026-11-12',
      5,
    );
    expect(grid.map((c) => c.level)).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns Monday..Sunday dates for getIsoWeekDates', () => {
    expect(getIsoWeekDates('2026-11-11')).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ]);
  });

  it('handles empty entries gracefully', () => {
    const stats = calculateHabitStats(
      { trackingType: 'boolean', targetValue: 1, frequencyType: 'daily', frequencyCount: 1 },
      [],
      '2026-11-11',
    );
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(0);
    expect(stats.totalCompletions).toBe(0);
    expect(stats.completionRate30d).toBe(0);
  });

  it('computes 30-day completion rate accurately for daily habits', () => {
    // 15 completions in the 30-day window ending 2026-11-11 (2026-10-13 to 2026-11-11)
    const entries = Array.from({ length: 15 }, (_, i) => ({
      entryDate: `2026-11-${String(i + 1).padStart(2, '0')}`,
      value: 1,
    }));
    const stats = calculateHabitStats(
      { trackingType: 'boolean', targetValue: 1, frequencyType: 'daily', frequencyCount: 1 },
      entries,
      '2026-11-15',
    );
    // 15 days completed out of 30 = 50%
    expect(stats.completionRate30d).toBe(50);
  });

  it('resets weekly currentStreak to 0 when current week has expired without achieving target', () => {
    // Current week Sunday 2026-01-11, frequencyCount is 3, but only 1 entry logged
    const stats = calculateHabitStats(
      { trackingType: 'boolean', targetValue: 1, frequencyType: 'weekly', frequencyCount: 3 },
      [
        { entryDate: '2025-12-29', value: 1 },
        { entryDate: '2025-12-31', value: 1 },
        { entryDate: '2026-01-02', value: 1 },
        { entryDate: '2026-01-05', value: 1 },
      ],
      '2026-01-11', // Sunday, 0 remaining potential days to hit 3
    );
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(1); // Previous week was completed
  });

  it('builds 365 cells by default in buildHeatmapGrid', () => {
    const grid = buildHeatmapGrid({ targetValue: 1 }, [], '2026-11-11');
    expect(grid).toHaveLength(365);
    expect(grid[grid.length - 1]?.date).toBe('2026-11-11');
    expect(grid[0]?.date).toBe('2025-11-12');
  });

  it('ignores future entries past referenceDate in weekly streak and completion rate', () => {
    // Current week Mon 2026-11-09..Sun 2026-11-15
    // referenceDate is Wednesday 2026-11-11
    // Entries on 2026-11-09 (value 1), and future entries on 2026-11-12 (value 1), 2026-11-13 (value 1)
    // frequencyCount: 3
    // At referenceDate (Wed), only 1 completion has occurred. The future completions must NOT count as completed yet.
    const stats = calculateHabitStats(
      { trackingType: 'boolean', targetValue: 1, frequencyType: 'weekly', frequencyCount: 3 },
      [
        { entryDate: '2026-11-09', value: 1 },
        { entryDate: '2026-11-12', value: 1 }, // future
        { entryDate: '2026-11-13', value: 1 }, // future
      ],
      '2026-11-11',
    );
    // Since only 1 entry is <= referenceDate, current week is not completed yet (1 < 3)
    expect(stats.totalCompletions).toBe(1);
    expect(stats.currentStreak).toBe(0); // no previous completed week
  });

  it('coerces boolean targetValue to 1 and daily frequencyCount to 1', () => {
    const stats = calculateHabitStats(
      { trackingType: 'boolean', targetValue: 50, frequencyType: 'daily', frequencyCount: 5 },
      [
        { entryDate: '2026-11-11', value: 1 },
      ],
      '2026-11-11',
    );
    // If targetValue is coerced to 1, value: 1 is completed.
    expect(stats.totalCompletions).toBe(1);
    expect(stats.currentStreak).toBe(1);
  });
});
