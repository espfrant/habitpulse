import { useState, useEffect } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getDashboard,
  getHabitHeatmap,
  createHabit,
  deleteHabit,
  upsertHabitEntry,
  seedDemoData,
  type CreateHabitInput,
} from './api/client';
import { THEME_STORAGE_KEY, type Theme } from './theme/catppuccin';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { WeeklyHabitMatrix } from './components/WeeklyHabitMatrix';
import { AnnualHeatmap } from './components/AnnualHeatmap';
import { NewHabitModal } from './components/NewHabitModal';

function DashboardContent() {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
    return saved === 'latte' ? 'latte' : 'mocha';
  });

  const [referenceDate, setReferenceDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [isNewHabitModalOpen, setIsNewHabitModalOpen] = useState(false);

  // Sync theme attribute and localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'mocha' ? 'latte' : 'mocha'));
  };

  // Queries
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', referenceDate],
    queryFn: () => getDashboard(referenceDate),
  });

  const activeDate = dashboardQuery.data?.date ?? referenceDate;
  const habits = dashboardQuery.data?.habits ?? [];
  const weekDates = dashboardQuery.data?.weekDates ?? [];
  const summary = dashboardQuery.data?.summary ?? {
    activeDailyStreakSum: 0,
    bestActiveStreak: 0,
    completedTodayCount: 0,
    totalHabitsCount: 0,
    monthlyCompletionRate: 0,
  };

  // Default selected habit
  useEffect(() => {
    if (habits.length > 0) {
      if (!selectedHabitId || !habits.some((h) => h.id === selectedHabitId)) {
        setSelectedHabitId(habits[0].id);
      }
    } else {
      setSelectedHabitId(null);
    }
  }, [habits, selectedHabitId]);

  const heatmapQuery = useQuery({
    queryKey: ['heatmap', selectedHabitId, activeDate],
    queryFn: () => getHabitHeatmap(selectedHabitId!, activeDate, 365),
    enabled: !!selectedHabitId,
  });

  // Mutations
  const createHabitMutation = useMutation({
    mutationFn: (input: CreateHabitInput) => createHabit(input),
    onSuccess: (newHabit) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSelectedHabitId(newHabit.id);
    },
  });

  const deleteHabitMutation = useMutation({
    mutationFn: (id: string) => deleteHabit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['heatmap'] });
    },
  });

  const upsertEntryMutation = useMutation({
    mutationFn: ({ id, date, value }: { id: string; date: string; value: number }) =>
      upsertHabitEntry(id, date, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['heatmap'] });
    },
  });

  const seedDemoMutation = useMutation({
    mutationFn: () => seedDemoData(activeDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['heatmap'] });
    },
  });

  return (
    <div className="min-h-screen bg-base text-text flex flex-col font-sans transition-colors">
      <Header
        currentDate={activeDate}
        onDateChange={setReferenceDate}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenNewHabitModal={() => setIsNewHabitModalOpen(true)}
        onSeedDemoData={() => seedDemoMutation.mutate()}
        isSeeding={seedDemoMutation.isPending}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 space-y-8">
        {/* Summary Metric Cards */}
        <SummaryCards summary={summary} />

        {/* Weekly Habit Matrix */}
        <WeeklyHabitMatrix
          habits={habits}
          weekDates={weekDates}
          referenceDate={activeDate}
          selectedHabitId={selectedHabitId}
          onSelectHabit={setSelectedHabitId}
          onUpsertEntry={(id, date, value) =>
            upsertEntryMutation.mutate({ id, date, value })
          }
          onDeleteHabit={(id) => deleteHabitMutation.mutate(id)}
          theme={theme}
        />

        {/* Annual Consistency Heatmap */}
        <AnnualHeatmap
          heatmapData={heatmapQuery.data ?? null}
          isLoading={heatmapQuery.isLoading}
          theme={theme}
        />
      </main>

      <NewHabitModal
        isOpen={isNewHabitModalOpen}
        onClose={() => setIsNewHabitModalOpen(false)}
        onSubmit={async (input) => {
          await createHabitMutation.mutateAsync(input);
        }}
        theme={theme}
      />
    </div>
  );
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardContent />
    </QueryClientProvider>
  );
}
