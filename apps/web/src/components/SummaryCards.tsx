import React from 'react';
import { CheckCircle2, Flame, TrendingUp } from 'lucide-react';
import type { DashboardSummary } from '../api/client';

interface SummaryCardsProps {
  summary: DashboardSummary;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  const todayProgressPercent =
    summary.totalHabitsCount > 0
      ? Math.round((summary.completedTodayCount / summary.totalHabitsCount) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Today's Progress Card */}
      <div className="bg-mantle border border-surface0/70 rounded-2xl p-5 flex items-center justify-between shadow-sm transition-colors">
        <div>
          <p className="text-xs font-semibold text-subtext0 uppercase tracking-wider mb-1">
            Today's Progress
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-text">
              {summary.completedTodayCount}/{summary.totalHabitsCount}
            </span>
            <span className="text-xs font-medium text-subtext0">
              habits ({todayProgressPercent}%)
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-36 h-1.5 bg-surface0 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-green rounded-full transition-all duration-500 ease-out"
              style={{ width: `${todayProgressPercent}%` }}
            />
          </div>
        </div>
        <div className="w-12 h-12 rounded-xl bg-green/15 text-green flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6" />
        </div>
      </div>

      {/* Best Active Streak Card */}
      <div className="bg-mantle border border-surface0/70 rounded-2xl p-5 flex items-center justify-between shadow-sm transition-colors">
        <div>
          <p className="text-xs font-semibold text-subtext0 uppercase tracking-wider mb-1">
            Best Active Streak
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-peach">
              {summary.bestActiveStreak} days
            </span>
          </div>
          <p className="text-xs text-subtext0 mt-3">
            Across {summary.totalHabitsCount} tracked habits
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-peach/15 text-peach flex items-center justify-center">
          <Flame className="w-6 h-6 fill-peach" />
        </div>
      </div>

      {/* 30-Day Consistency Card */}
      <div className="bg-mantle border border-surface0/70 rounded-2xl p-5 flex items-center justify-between shadow-sm transition-colors">
        <div>
          <p className="text-xs font-semibold text-subtext0 uppercase tracking-wider mb-1">
            30-Day Consistency
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-mauve">
              {summary.monthlyCompletionRate}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-36 h-1.5 bg-surface0 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-mauve rounded-full transition-all duration-500 ease-out"
              style={{ width: `${summary.monthlyCompletionRate}%` }}
            />
          </div>
        </div>
        <div className="w-12 h-12 rounded-xl bg-mauve/15 text-mauve flex items-center justify-center">
          <TrendingUp className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
