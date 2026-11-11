import {
  type CatppuccinColor,
  type FrequencyType,
  type HabitEntryRecord,
  type TrackingType,
} from '../../domain/habit.js';
import { getDateRangeEndingAt, getIsoDayOfWeek } from '../../domain/date-utils.js';

export interface DemoHabitDefinition {
  id?: string;
  name: string;
  description: string | null;
  color: CatppuccinColor;
  trackingType: TrackingType;
  targetValue: number;
  unit: string | null;
  frequencyType: FrequencyType;
  frequencyCount: number;
  entries: HabitEntryRecord[];
}

export interface DemoDataset {
  habits: DemoHabitDefinition[];
}

function createSeededPrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

export function generateDemoDataset(referenceDate: string): DemoDataset {
  const dates = getDateRangeEndingAt(referenceDate, 365);
  const baseSeed = hashString(referenceDate);

  const habitBlueprints: Array<{
    name: string;
    description: string;
    color: CatppuccinColor;
    trackingType: TrackingType;
    targetValue: number;
    unit: string | null;
    frequencyType: FrequencyType;
    frequencyCount: number;
    generateValue: (prng: () => number, isoDay: number, isRecent: boolean) => number;
  }> = [
    {
      name: 'Deep Work Architecture',
      description: 'Uninterrupted deep work blocks on high-leverage systems',
      color: 'mauve',
      trackingType: 'quantitative',
      targetValue: 4,
      unit: 'hours',
      frequencyType: 'daily',
      frequencyCount: 1,
      generateValue: (prng, isoDay, isRecent) => {
        if (isRecent) return 4;
        const isWeekday = isoDay <= 5;
        const chance = isWeekday ? 0.78 : 0.25;
        if (prng() < chance) {
          const rand = prng();
          if (rand < 0.2) return 2;
          if (rand < 0.6) return 4;
          if (rand < 0.85) return 5;
          return 6;
        }
        return 0;
      },
    },
    {
      name: 'Read 20 Technical Pages',
      description: 'Focused reading of engineering papers, books, or documentation',
      color: 'sapphire',
      trackingType: 'quantitative',
      targetValue: 20,
      unit: 'pages',
      frequencyType: 'daily',
      frequencyCount: 1,
      generateValue: (prng, _isoDay, isRecent) => {
        if (isRecent) return 25;
        if (prng() < 0.72) {
          return 15 + Math.floor(prng() * 20); // 15..34
        }
        return 0;
      },
    },
    {
      name: 'Strength Training',
      description: 'Barbell compound lifts or bodyweight strength workouts',
      color: 'peach',
      trackingType: 'boolean',
      targetValue: 1,
      unit: null,
      frequencyType: 'weekly',
      frequencyCount: 4,
      generateValue: (prng, isoDay, isRecent) => {
        // Mon, Wed, Fri, Sat
        const workoutDay = [1, 3, 5, 6].includes(isoDay);
        if (isRecent && workoutDay) return 1;
        const chance = workoutDay ? 0.85 : 0.15;
        return prng() < chance ? 1 : 0;
      },
    },
    {
      name: 'Mindfulness Meditation',
      description: 'Daily morning mindfulness meditation or breathwork session',
      color: 'teal',
      trackingType: 'boolean',
      targetValue: 1,
      unit: null,
      frequencyType: 'daily',
      frequencyCount: 1,
      generateValue: (prng, _isoDay, isRecent) => {
        if (isRecent) return 1;
        return prng() < 0.82 ? 1 : 0;
      },
    },
    {
      name: 'Hydration (ml)',
      description: 'Drink at least 2500ml of water throughout the day',
      color: 'sky',
      trackingType: 'quantitative',
      targetValue: 2500,
      unit: 'ml',
      frequencyType: 'daily',
      frequencyCount: 1,
      generateValue: (prng, _isoDay, isRecent) => {
        if (isRecent) return 2750;
        if (prng() < 0.85) {
          return 2000 + Math.floor(prng() * 1200); // 2000..3199
        }
        return 0;
      },
    },
  ];

  const habits: DemoHabitDefinition[] = habitBlueprints.map((bp, idx) => {
    const prng = createSeededPrng(baseSeed ^ (idx * 0x9e3779b9));
    const entries: HabitEntryRecord[] = [];

    for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
      const dateStr = dates[dayIdx]!;
      const isoDay = getIsoDayOfWeek(dateStr);
      // Give the last 5 days guaranteed completion for active streak
      const isRecent = dayIdx >= dates.length - 5;
      const val = bp.generateValue(prng, isoDay, isRecent);
      if (val > 0) {
        entries.push({
          entryDate: dateStr,
          value: val,
        });
      }
    }

    return {
      name: bp.name,
      description: bp.description,
      color: bp.color,
      trackingType: bp.trackingType,
      targetValue: bp.targetValue,
      unit: bp.unit,
      frequencyType: bp.frequencyType,
      frequencyCount: bp.frequencyCount,
      entries,
    };
  });

  return { habits };
}
