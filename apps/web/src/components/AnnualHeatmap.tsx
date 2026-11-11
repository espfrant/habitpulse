import React, { useState } from 'react';
import { Flame, Trophy, Percent, CheckCircle, Calendar } from 'lucide-react';
import type { HeatmapResponse } from '../api/client';
import { getAccentHex, type Theme } from '../theme/catppuccin';

interface AnnualHeatmapProps {
  heatmapData: HeatmapResponse | null;
  isLoading: boolean;
  theme: Theme;
}

export const AnnualHeatmap: React.FC<AnnualHeatmapProps> = ({
  heatmapData,
  isLoading,
  theme,
}) => {
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    value: number;
    targetValue: number;
    level: number;
  } | null>(null);

  if (isLoading) {
    return (
      <div className="bg-mantle border border-surface0/70 rounded-2xl p-6 shadow-sm animate-pulse">
        <div className="h-6 w-48 bg-surface0 rounded mb-4" />
        <div className="h-32 bg-surface0/40 rounded-xl" />
      </div>
    );
  }

  if (!heatmapData) {
    return (
      <div className="bg-mantle border border-surface0/70 rounded-2xl p-8 text-center text-subtext0">
        <Calendar className="w-8 h-8 mx-auto mb-2 text-surface2" />
        <p className="font-medium text-text">Select a habit above to inspect its annual heatmap.</p>
        <p className="text-xs text-subtext0 mt-1">Track 365 days of consistency and momentum.</p>
      </div>
    );
  }

  const { habit, stats, cells } = heatmapData;
  const accentHex = getAccentHex(habit.color, theme);

  // Group cells into columns of 7 days (Mon..Sun)
  // Determine starting offset of first cell (Monday = 0 ... Sunday = 6)
  const columns: Array<Array<(typeof cells)[0] | null>> = [];
  if (cells.length > 0) {
    let currentWeek: Array<(typeof cells)[0] | null> = [];
    const firstDate = new Date(cells[0].date + 'T00:00:00');
    const firstDayOfWeek = (firstDate.getDay() + 6) % 7; // 0 for Mon..6 for Sun

    // Pad first column with nulls
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }

    for (const cell of cells) {
      currentWeek.push(cell);
      if (currentWeek.length === 7) {
        columns.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      columns.push(currentWeek);
    }
  }

  const getCellColor = (level: number) => {
    switch (level) {
      case 1:
        return `${accentHex}40`; // 25% opacity
      case 2:
        return `${accentHex}80`; // 50% opacity
      case 3:
        return `${accentHex}BF`; // 75% opacity
      case 4:
        return accentHex; // 100% opacity
      default:
        return undefined; // default background
    }
  };

  const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

  return (
    <div className="bg-mantle border border-surface0/70 rounded-2xl p-6 shadow-sm transition-colors">
      {/* Header and habit details */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full shadow-sm"
            style={{ backgroundColor: accentHex }}
          />
          <div>
            <h3 className="text-lg font-bold text-text flex items-center gap-2">
              <span>{habit.name}</span>
              <span className="text-xs font-normal text-subtext0 uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface0">
                Annual Heatmap
              </span>
            </h3>
            <p className="text-xs text-subtext0 mt-0.5">
              Target:{' '}
              {habit.trackingType === 'quantitative'
                ? `${habit.targetValue} ${habit.unit ?? ''}`
                : 'Daily Completion'}
            </p>
          </div>
        </div>

        {/* 4 Stats Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface0/40 rounded-xl px-3 py-2 border border-surface0/60">
            <div className="flex items-center gap-1.5 text-xs text-subtext0">
              <Flame className="w-3.5 h-3.5 text-peach fill-peach" />
              <span>Current</span>
            </div>
            <div className="text-sm font-bold text-text mt-0.5">{stats.currentStreak} days</div>
          </div>

          <div className="bg-surface0/40 rounded-xl px-3 py-2 border border-surface0/60">
            <div className="flex items-center gap-1.5 text-xs text-subtext0">
              <Trophy className="w-3.5 h-3.5 text-yellow" />
              <span>Best</span>
            </div>
            <div className="text-sm font-bold text-text mt-0.5">{stats.bestStreak} days</div>
          </div>

          <div className="bg-surface0/40 rounded-xl px-3 py-2 border border-surface0/60">
            <div className="flex items-center gap-1.5 text-xs text-subtext0">
              <Percent className="w-3.5 h-3.5 text-mauve" />
              <span>30-Day Rate</span>
            </div>
            <div className="text-sm font-bold text-text mt-0.5">{stats.completionRate30d}%</div>
          </div>

          <div className="bg-surface0/40 rounded-xl px-3 py-2 border border-surface0/60">
            <div className="flex items-center gap-1.5 text-xs text-subtext0">
              <CheckCircle className="w-3.5 h-3.5 text-green" />
              <span>Total</span>
            </div>
            <div className="text-sm font-bold text-text mt-0.5">
              {stats.totalCompletions} days
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-2 min-w-full">
          {/* Day of week labels */}
          <div className="flex flex-col justify-between py-1 text-[10px] text-subtext0 font-mono select-none pr-1">
            {dayLabels.map((label, idx) => (
              <span key={idx} className="h-3 leading-3">
                {label}
              </span>
            ))}
          </div>

          {/* Grid columns */}
          <div className="flex gap-1">
            {columns.map((column, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-1">
                {column.map((cell, rowIdx) => {
                  if (!cell) {
                    return <div key={rowIdx} className="w-3 h-3 rounded-sm opacity-0" />;
                  }

                  const cellBg = getCellColor(cell.level);
                  return (
                    <div
                      key={cell.date}
                      onMouseEnter={() => setHoveredCell(cell)}
                      onMouseLeave={() => setHoveredCell(null)}
                      title={`${cell.date}: ${cell.value}/${cell.targetValue} (level ${cell.level})`}
                      className="w-3 h-3 rounded-sm transition-transform hover:scale-125 hover:z-10 cursor-pointer"
                      style={{
                        backgroundColor: cellBg ?? 'var(--ctp-surface0)',
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer: Tooltip info + Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-surface0/50 text-xs text-subtext0">
        <div>
          {hoveredCell ? (
            <span className="text-text font-medium">
              <strong className="text-mauve">{hoveredCell.date}:</strong> {hoveredCell.value} /{' '}
              {hoveredCell.targetValue} {habit.unit ?? ''} (level {hoveredCell.level})
            </span>
          ) : (
            <span>Hover over any cell to see daily progress</span>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2">
          <span>Less</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-surface0" title="Level 0" />
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: `${accentHex}40` }}
              title="Level 1"
            />
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: `${accentHex}80` }}
              title="Level 2"
            />
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: `${accentHex}BF` }}
              title="Level 3"
            />
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: accentHex }}
              title="Level 4"
            />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
