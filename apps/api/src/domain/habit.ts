export const CATPPUCCIN_COLORS = [
  'rosewater',
  'flamingo',
  'pink',
  'mauve',
  'red',
  'maroon',
  'peach',
  'yellow',
  'green',
  'teal',
  'sky',
  'sapphire',
  'blue',
  'lavender',
] as const;

export type CatppuccinColor = (typeof CATPPUCCIN_COLORS)[number];

export type TrackingType = 'boolean' | 'quantitative';

export type FrequencyType = 'daily' | 'weekly';

export interface HabitProps {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: CatppuccinColor;
  trackingType: TrackingType;
  targetValue: number;
  unit: string | null;
  frequencyType: FrequencyType;
  frequencyCount: number;
  createdAt: Date;
}

export interface HabitEntryRecord {
  entryDate: string;
  value: number;
}

export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';
