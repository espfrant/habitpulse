import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { CreateHabitInput } from '../api/client';
import {
  CATPPUCCIN_COLORS,
  getAccentHex,
  type CatppuccinColor,
  type Theme,
} from '../theme/catppuccin';

interface NewHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateHabitInput) => Promise<void>;
  theme: Theme;
}

export const NewHabitModal: React.FC<NewHabitModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  theme,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<CatppuccinColor>('mauve');
  const [trackingType, setTrackingType] = useState<'boolean' | 'quantitative'>('boolean');
  const [targetValue, setTargetValue] = useState<number>(1);
  const [unit, setUnit] = useState('');
  const [frequencyType, setFrequencyType] = useState<'daily' | 'weekly'>('daily');
  const [frequencyCount, setFrequencyCount] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please provide a habit name');
      return;
    }

    if (trackingType === 'quantitative' && (!targetValue || targetValue <= 0)) {
      setError('Target value must be at least 1');
      return;
    }

    if (frequencyType === 'weekly' && (!frequencyCount || frequencyCount < 1 || frequencyCount > 7)) {
      setError('Weekly frequency count must be between 1 and 7');
      return;
    }

    const payload: CreateHabitInput = {
      name: trimmedName,
      description: description.trim() ? description.trim() : null,
      color,
      trackingType,
      targetValue: trackingType === 'boolean' ? 1 : Number(targetValue),
      unit: trackingType === 'quantitative' && unit.trim() ? unit.trim() : null,
      frequencyType,
      frequencyCount: frequencyType === 'daily' ? 1 : Number(frequencyCount),
    };

    try {
      setIsSubmitting(true);
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create habit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-crust/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-mantle border border-surface0 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-surface0/60 mb-5">
          <div>
            <h2 className="text-xl font-bold text-text">Create New Habit</h2>
            <p className="text-xs text-subtext0 mt-0.5">Define your daily or weekly commitment.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-subtext0 hover:text-text hover:bg-surface0 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red/15 border border-red/30 text-red text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="habit-name" className="block text-xs font-semibold text-subtext0 mb-1">
              Habit Name *
            </label>
            <input
              id="habit-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read Philosophy, Deep Work, Run 5k"
              className="w-full px-3.5 py-2 rounded-xl bg-surface0/50 border border-surface0 focus:border-mauve focus:ring-1 focus:ring-mauve outline-none text-text text-sm transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="habit-description" className="block text-xs font-semibold text-subtext0 mb-1">
              Description (Optional)
            </label>
            <textarea
              id="habit-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context or notes about this habit..."
              className="w-full px-3.5 py-2 rounded-xl bg-surface0/50 border border-surface0 focus:border-mauve focus:ring-1 focus:ring-mauve outline-none text-text text-sm transition-colors resize-none"
            />
          </div>

          {/* Tracking Type */}
          <div>
            <span className="block text-xs font-semibold text-subtext0 mb-1.5">
              Tracking Type
            </span>
            <div className="grid grid-cols-2 gap-3">
              <label
                htmlFor="tracking-boolean"
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  trackingType === 'boolean'
                    ? 'border-mauve bg-mauve/10 text-text font-semibold'
                    : 'border-surface0 bg-surface0/30 text-subtext0 hover:bg-surface0/50'
                }`}
              >
                <input
                  id="tracking-boolean"
                  type="radio"
                  name="trackingType"
                  value="boolean"
                  checked={trackingType === 'boolean'}
                  onChange={() => setTrackingType('boolean')}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    trackingType === 'boolean' ? 'border-mauve' : 'border-surface1'
                  }`}
                >
                  {trackingType === 'boolean' && (
                    <div className="w-2 h-2 rounded-full bg-mauve" />
                  )}
                </div>
                <div>
                  <span className="text-sm block">Boolean</span>
                  <span className="text-[11px] text-subtext0 font-normal">Yes / No completed</span>
                </div>
              </label>

              <label
                htmlFor="tracking-quantitative"
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  trackingType === 'quantitative'
                    ? 'border-mauve bg-mauve/10 text-text font-semibold'
                    : 'border-surface0 bg-surface0/30 text-subtext0 hover:bg-surface0/50'
                }`}
              >
                <input
                  id="tracking-quantitative"
                  type="radio"
                  name="trackingType"
                  value="quantitative"
                  checked={trackingType === 'quantitative'}
                  onChange={() => setTrackingType('quantitative')}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    trackingType === 'quantitative' ? 'border-mauve' : 'border-surface1'
                  }`}
                >
                  {trackingType === 'quantitative' && (
                    <div className="w-2 h-2 rounded-full bg-mauve" />
                  )}
                </div>
                <div>
                  <span className="text-sm block">Quantitative</span>
                  <span className="text-[11px] text-subtext0 font-normal">Target amount & scale</span>
                </div>
              </label>
            </div>
          </div>

          {/* Quantitative inputs */}
          {trackingType === 'quantitative' && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface0/30 border border-surface0/50">
              <div>
                <label htmlFor="habit-target-value" className="block text-xs font-semibold text-subtext0 mb-1">
                  Target Value *
                </label>
                <input
                  id="habit-target-value"
                  type="number"
                  min="1"
                  required
                  value={targetValue}
                  onChange={(e) => setTargetValue(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-base border border-surface0 focus:border-mauve focus:ring-1 focus:ring-mauve outline-none text-text text-sm"
                />
              </div>
              <div>
                <label htmlFor="habit-unit" className="block text-xs font-semibold text-subtext0 mb-1">
                  Unit (Optional)
                </label>
                <input
                  id="habit-unit"
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. pages, ml, mins"
                  className="w-full px-3 py-1.5 rounded-lg bg-base border border-surface0 focus:border-mauve focus:ring-1 focus:ring-mauve outline-none text-text text-sm"
                />
              </div>
            </div>
          )}

          {/* Frequency Type */}
          <div>
            <span className="block text-xs font-semibold text-subtext0 mb-1.5">
              Frequency
            </span>
            <div className="grid grid-cols-2 gap-3">
              <label
                htmlFor="frequency-daily"
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  frequencyType === 'daily'
                    ? 'border-mauve bg-mauve/10 text-text font-semibold'
                    : 'border-surface0 bg-surface0/30 text-subtext0 hover:bg-surface0/50'
                }`}
              >
                <input
                  id="frequency-daily"
                  type="radio"
                  name="frequencyType"
                  value="daily"
                  checked={frequencyType === 'daily'}
                  onChange={() => setFrequencyType('daily')}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    frequencyType === 'daily' ? 'border-mauve' : 'border-surface1'
                  }`}
                >
                  {frequencyType === 'daily' && (
                    <div className="w-2 h-2 rounded-full bg-mauve" />
                  )}
                </div>
                <div>
                  <span className="text-sm block">Daily</span>
                  <span className="text-[11px] text-subtext0 font-normal">Every single day</span>
                </div>
              </label>

              <label
                htmlFor="frequency-weekly"
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  frequencyType === 'weekly'
                    ? 'border-mauve bg-mauve/10 text-text font-semibold'
                    : 'border-surface0 bg-surface0/30 text-subtext0 hover:bg-surface0/50'
                }`}
              >
                <input
                  id="frequency-weekly"
                  type="radio"
                  name="frequencyType"
                  value="weekly"
                  checked={frequencyType === 'weekly'}
                  onChange={() => setFrequencyType('weekly')}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    frequencyType === 'weekly' ? 'border-mauve' : 'border-surface1'
                  }`}
                >
                  {frequencyType === 'weekly' && (
                    <div className="w-2 h-2 rounded-full bg-mauve" />
                  )}
                </div>
                <div>
                  <span className="text-sm block">Weekly</span>
                  <span className="text-[11px] text-subtext0 font-normal">Multiple days per week</span>
                </div>
              </label>
            </div>
          </div>

          {/* Weekly frequency input */}
          {frequencyType === 'weekly' && (
            <div className="p-3 rounded-xl bg-surface0/30 border border-surface0/50">
              <label htmlFor="habit-frequency-count" className="block text-xs font-semibold text-subtext0 mb-1">
                Times Per Week (1–7) *
              </label>
              <input
                id="habit-frequency-count"
                type="number"
                min="1"
                max="7"
                required
                value={frequencyCount}
                onChange={(e) => setFrequencyCount(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-base border border-surface0 focus:border-mauve focus:ring-1 focus:ring-mauve outline-none text-text text-sm"
              />
            </div>
          )}

          {/* Catppuccin Accent Color Selector */}
          <div>
            <span className="block text-xs font-semibold text-subtext0 mb-2">
              Accent Color: <strong className="text-text capitalize">{color}</strong>
            </span>
            <div className="grid grid-cols-7 gap-2">
              {CATPPUCCIN_COLORS.map((c) => {
                const hex = getAccentHex(c, theme);
                const isSelected = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setColor(c)}
                    title={c}
                    className={`h-8 rounded-lg flex items-center justify-center transition-all ${
                      isSelected
                        ? 'ring-2 ring-text scale-110 shadow-md'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: hex }}
                  >
                    {isSelected && (
                      <Check className="w-4 h-4 text-crust stroke-[3]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface0/60 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-surface0 hover:bg-surface1 text-text text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-mauve hover:opacity-90 text-crust text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
