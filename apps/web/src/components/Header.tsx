import React from 'react';
import { Sun, Moon, Plus, Sparkles, Flame, Calendar as CalendarIcon } from 'lucide-react';
import type { Theme } from '../theme/catppuccin';

interface HeaderProps {
  currentDate: string;
  onDateChange?: (date: string) => void;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenNewHabitModal: () => void;
  onSeedDemoData: () => void;
  isSeeding?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  theme,
  onToggleTheme,
  onOpenNewHabitModal,
  onSeedDemoData,
  isSeeding = false,
}) => {
  const formattedDate = new Date(currentDate + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className="border-b border-surface0/60 bg-mantle/80 backdrop-blur sticky top-0 z-30 px-4 lg:px-8 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-mauve/20 text-mauve flex items-center justify-center shadow-sm">
            <Flame className="w-5 h-5 fill-mauve" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-xl text-text">HabitPulse</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface0 text-subtext0 font-mono">
                v0.1
              </span>
            </div>
            <p className="text-xs text-subtext0 hidden sm:block">Minimalist Habit Architecture</p>
          </div>
        </div>

        {/* Date Display */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface0/50 text-subtext0 text-sm">
          <CalendarIcon className="w-4 h-4 text-mauve" />
          <span className="font-medium text-text">{formattedDate}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Seed Demo Data Button */}
          <button
            type="button"
            onClick={onSeedDemoData}
            disabled={isSeeding}
            title="Seed 5 demo habits with 365 days of history"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface0 hover:bg-surface1 text-text text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 text-peach ${isSeeding ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Seed Demo</span>
          </button>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'mocha' ? 'Switch to Latte' : 'Switch to Mocha'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface0 hover:bg-surface1 text-text text-sm font-medium transition-colors"
          >
            {theme === 'mocha' ? (
              <>
                <Sun className="w-4 h-4 text-yellow" />
                <span className="hidden sm:inline">Latte</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-mauve" />
                <span className="hidden sm:inline">Mocha</span>
              </>
            )}
          </button>

          {/* New Habit Button */}
          <button
            type="button"
            onClick={onOpenNewHabitModal}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-mauve hover:opacity-90 text-crust text-sm font-semibold shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ New Habit</span>
          </button>
        </div>
      </div>
    </header>
  );
};
