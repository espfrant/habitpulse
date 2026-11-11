import React, { useState } from 'react';
import { Flame, Trash2, Check, BarChart2, Plus, Minus, AlertCircle } from 'lucide-react';
import type { HabitDashboardItem } from '../api/client';
import { getAccentHex, type Theme } from '../theme/catppuccin';

interface WeeklyHabitMatrixProps {
  habits: HabitDashboardItem[];
  weekDates: string[];
  referenceDate: string;
  selectedHabitId: string | null;
  onSelectHabit: (id: string) => void;
  onUpsertEntry: (id: string, date: string, value: number) => void;
  onDeleteHabit: (id: string) => void;
  theme: Theme;
}

export const WeeklyHabitMatrix: React.FC<WeeklyHabitMatrixProps> = ({
  habits,
  weekDates,
  referenceDate,
  selectedHabitId,
  onSelectHabit,
  onUpsertEntry,
  onDeleteHabit,
  theme,
}) => {
  const [habitToDelete, setHabitToDelete] = useState<HabitDashboardItem | null>(null);

  const formatDayHeader = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
    const monthDay = d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    const isToday = dateStr === referenceDate;
    return { dayName, monthDay, isToday };
  };

  const handleCellClick = (habit: HabitDashboardItem, date: string) => {
    const entry = habit.weekEntries.find((e) => e.date === date);
    const currentValue = entry?.value ?? 0;

    let nextValue: number;
    if (habit.trackingType === 'boolean') {
      nextValue = currentValue > 0 ? 0 : 1;
    } else {
      // Quantitative: toggle between 0 and targetValue when clicking cell
      nextValue = currentValue >= habit.targetValue ? 0 : habit.targetValue;
    }

    onUpsertEntry(habit.id, date, nextValue);
  };

  const getStepForTarget = (target: number): number => {
    if (target >= 100) return Math.max(1, Math.round(target / 5));
    if (target >= 10) return Math.max(1, Math.round(target / 4));
    return 1;
  };

  const handleAdjustValue = (
    e: React.MouseEvent,
    habit: HabitDashboardItem,
    date: string,
    direction: -1 | 1,
  ) => {
    e.stopPropagation();
    const entry = habit.weekEntries.find((e) => e.date === date);
    const currentValue = entry?.value ?? 0;
    const step = getStepForTarget(habit.targetValue);
    const nextValue = Math.max(0, currentValue + direction * step);
    onUpsertEntry(habit.id, date, nextValue);
  };

  return (
    <div className="bg-mantle border border-surface0/70 rounded-2xl overflow-hidden shadow-sm transition-colors">
      <div className="p-5 border-b border-surface0/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text tracking-tight">Weekly Habits</h2>
          <p className="text-xs text-subtext0 mt-0.5">
            Click cells to log progress. Select a habit to inspect its 365-day heatmap.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-surface0/50 bg-surface0/20 text-xs font-semibold text-subtext0">
              <th className="py-3 px-4 w-[280px]">Habit</th>
              {weekDates.map((date) => {
                const { dayName, monthDay, isToday } = formatDayHeader(date);
                return (
                  <th
                    key={date}
                    className={`py-3 px-2 text-center w-[60px] ${
                      isToday ? 'text-mauve font-bold' : ''
                    }`}
                  >
                    <div className="uppercase tracking-wider">{dayName}</div>
                    <div
                      className={`text-[11px] ${
                        isToday ? 'text-mauve font-bold' : 'text-subtext0/70'
                      }`}
                    >
                      {monthDay}
                    </div>
                  </th>
                );
              })}
              <th className="py-3 px-3 text-center w-[100px]">Streak</th>
              <th className="py-3 px-3 text-center w-[80px]">30d Rate</th>
              <th className="py-3 px-3 text-right w-[90px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface0/40 text-sm">
            {habits.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-subtext0">
                  <p className="font-medium">No habits tracked yet.</p>
                  <p className="text-xs mt-1">
                    Click <strong>New Habit</strong> or <strong>Seed Demo</strong> to get started.
                  </p>
                </td>
              </tr>
            ) : (
              habits.map((habit) => {
                const accentColorHex = getAccentHex(habit.color, theme);
                const isSelected = selectedHabitId === habit.id;

                return (
                  <tr
                    key={habit.id}
                    onClick={() => onSelectHabit(habit.id)}
                    className={`cursor-pointer transition-colors group ${
                      isSelected ? 'bg-surface0/40' : 'hover:bg-surface0/20'
                    }`}
                  >
                    {/* Habit Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {/* Color Pill */}
                        <div
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: accentColorHex }}
                          title={habit.color}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-text truncate group-hover:text-text">
                              {habit.name}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-surface1 text-text">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-subtext0 truncate flex items-center gap-1.5 mt-0.5">
                            <span className="capitalize">{habit.frequencyType}</span>
                            <span>•</span>
                            {habit.trackingType === 'quantitative' ? (
                              <span>
                                Goal: {habit.targetValue} {habit.unit ?? ''}
                              </span>
                            ) : (
                              <span>Completion</span>
                            )}
                            {habit.frequencyType === 'weekly' && (
                              <span>({habit.frequencyCount}x/wk)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Weekday cells */}
                    {weekDates.map((date) => {
                      const entry = habit.weekEntries.find((e) => e.date === date);
                      const isCompleted = entry?.completed ?? false;
                      const value = entry?.value ?? 0;
                      const isToday = date === referenceDate;

                      return (
                        <td
                          key={date}
                          className={`py-2 px-1 text-center align-middle ${
                            isToday ? 'bg-surface0/30' : ''
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center gap-1">
                            <button
                              type="button"
                              data-testid={`cell-${habit.id}-${date}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCellClick(habit, date);
                              }}
                              title={`${date}: ${value} / ${habit.targetValue} ${
                                habit.unit ?? ''
                              } (${isCompleted ? 'Completed' : 'Incomplete'})`}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all transform active:scale-90 border ${
                                isCompleted
                                  ? 'border-transparent text-crust font-bold shadow-sm'
                                  : 'border-surface0/80 bg-surface0/20 text-subtext0/60 hover:border-surface1 hover:text-text'
                              }`}
                              style={
                                isCompleted
                                  ? {
                                      backgroundColor: accentColorHex,
                                      color:
                                        theme === 'latte' &&
                                        ['yellow', 'rosewater'].includes(habit.color)
                                          ? '#1e1e2e'
                                          : '#11111b',
                                    }
                                  : undefined
                              }
                            >
                              {habit.trackingType === 'boolean' ? (
                                isCompleted ? (
                                  <Check className="w-5 h-5 stroke-[3]" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-surface1" />
                                )
                              ) : (
                                <span className="text-xs font-semibold leading-none">
                                  {value > 0 ? value : '—'}
                                </span>
                              )}
                            </button>

                            {/* Quantitative quick adjust buttons */}
                            {habit.trackingType === 'quantitative' && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => handleAdjustValue(e, habit, date, -1)}
                                  disabled={value <= 0}
                                  title="Decrement 1"
                                  className="w-4 h-4 rounded text-[10px] bg-surface0 hover:bg-surface1 text-subtext0 flex items-center justify-center disabled:opacity-20"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleAdjustValue(e, habit, date, 1)}
                                  title="Increment 1"
                                  className="w-4 h-4 rounded text-[10px] bg-surface0 hover:bg-surface1 text-subtext0 flex items-center justify-center"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Current Streak */}
                    <td className="py-3 px-3 text-center align-middle whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-peach/10 text-peach text-xs font-bold">
                        <Flame className="w-3.5 h-3.5 fill-peach" />
                        <span>
                          {habit.frequencyType === 'daily'
                            ? `${habit.currentStreak} days`
                            : `${habit.currentStreak} wks (${habit.weekEntries.filter((e) => e.completed).length}/${habit.frequencyCount})`}
                        </span>
                      </div>
                    </td>

                    {/* 30-Day Completion Rate */}
                    <td className="py-3 px-3 text-center align-middle whitespace-nowrap">
                      <span className="font-semibold text-text text-xs">
                        {habit.completionRate30d}%
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right align-middle whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectHabit(habit.id);
                          }}
                          title="Inspect 365-day Heatmap"
                          className="p-1.5 rounded-lg hover:bg-surface0 text-subtext0 hover:text-mauve transition-colors"
                        >
                          <BarChart2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          data-testid={`delete-${habit.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHabitToDelete(habit);
                          }}
                          title="Remove habit"
                          aria-label="Remove habit"
                          className="p-1.5 rounded-lg hover:bg-red/10 text-subtext0 hover:text-red transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {habitToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-crust/70 backdrop-blur-sm p-4">
          <div className="bg-base border border-surface0 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-red/15 text-red flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-text mb-2">Delete Habit?</h3>
            <p className="text-sm text-subtext0 mb-6 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-text font-semibold">"{habitToDelete.name}"</strong>? This will
              permanently erase all historical entries and streaks.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setHabitToDelete(null)}
                className="px-4 py-2 rounded-xl bg-surface0 hover:bg-surface1 text-text text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteHabit(habitToDelete.id);
                  setHabitToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-red hover:bg-red/90 text-crust text-sm font-semibold transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
