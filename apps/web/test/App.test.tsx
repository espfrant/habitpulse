import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { formatLocalDate } from '../src/App';
import * as apiClient from '../src/api/client';
import type { DashboardResponse, HeatmapResponse, HabitDashboardItem } from '../src/api/client';

vi.mock('../src/api/client', () => ({
  getDashboard: vi.fn(),
  getHabitHeatmap: vi.fn(),
  createHabit: vi.fn(),
  deleteHabit: vi.fn(),
  upsertHabitEntry: vi.fn(),
  seedDemoData: vi.fn(),
}));

const mockHabit1: HabitDashboardItem = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Morning Meditation',
  description: '15 mins mindfulness',
  color: 'mauve',
  trackingType: 'boolean',
  targetValue: 1,
  unit: null,
  frequencyType: 'daily',
  frequencyCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
  currentStreak: 12,
  bestStreak: 25,
  completionRate30d: 90,
  totalCompletions: 120,
  weekEntries: [
    { date: '2026-11-09', value: 1, completed: true },
    { date: '2026-11-10', value: 1, completed: true },
    { date: '2026-11-11', value: 0, completed: false },
    { date: '2026-11-12', value: 0, completed: false },
    { date: '2026-11-13', value: 0, completed: false },
    { date: '2026-11-14', value: 0, completed: false },
    { date: '2026-11-15', value: 0, completed: false },
  ],
};

const mockHabit2: HabitDashboardItem = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Hydration Goal',
  description: 'Daily water intake',
  color: 'blue',
  trackingType: 'quantitative',
  targetValue: 2000,
  unit: 'ml',
  frequencyType: 'daily',
  frequencyCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
  currentStreak: 5,
  bestStreak: 18,
  completionRate30d: 75,
  totalCompletions: 80,
  weekEntries: [
    { date: '2026-11-09', value: 2000, completed: true },
    { date: '2026-11-10', value: 1500, completed: false },
    { date: '2026-11-11', value: 0, completed: false },
    { date: '2026-11-12', value: 0, completed: false },
    { date: '2026-11-13', value: 0, completed: false },
    { date: '2026-11-14', value: 0, completed: false },
    { date: '2026-11-15', value: 0, completed: false },
  ],
};

const mockDashboardResponse: DashboardResponse = {
  date: '2026-11-11',
  weekDates: [
    '2026-11-09',
    '2026-11-10',
    '2026-11-11',
    '2026-11-12',
    '2026-11-13',
    '2026-11-14',
    '2026-11-15',
  ],
  summary: {
    activeDailyStreakSum: 17,
    bestActiveStreak: 25,
    completedTodayCount: 1,
    totalHabitsCount: 2,
    monthlyCompletionRate: 83,
  },
  habits: [mockHabit1, mockHabit2],
};

const mockHeatmapResponse: HeatmapResponse = {
  habit: mockHabit1,
  stats: {
    currentStreak: 12,
    bestStreak: 25,
    completionRate30d: 90,
    totalCompletions: 120,
  },
  cells: [
    { date: '2026-11-10', value: 1, targetValue: 1, level: 4 },
    { date: '2026-11-11', value: 0, targetValue: 1, level: 0 },
  ],
};

describe('HabitPulse Web App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');

    vi.mocked(apiClient.getDashboard).mockResolvedValue(mockDashboardResponse);
    vi.mocked(apiClient.getHabitHeatmap).mockResolvedValue(mockHeatmapResponse);
    vi.mocked(apiClient.createHabit).mockResolvedValue({
      ...mockHabit1,
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Read 20 Pages',
    });
    vi.mocked(apiClient.deleteHabit).mockResolvedValue(undefined);
    vi.mocked(apiClient.upsertHabitEntry).mockResolvedValue({
      ...mockHabit1,
      weekEntries: mockHabit1.weekEntries.map((e) =>
        e.date === '2026-11-11' ? { ...e, value: 1, completed: true } : e,
      ),
    });
    vi.mocked(apiClient.seedDemoData).mockResolvedValue({
      habitsCreated: 5,
      entriesCreated: 50,
      referenceDate: '2026-11-11',
    });
  });

  it('renders dashboard summary metrics, habit rows, and switches between Catppuccin Mocha and Latte themes', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Verify loading or initial render of dashboard
    await waitFor(() => {
      expect(screen.getByText('Morning Meditation')).toBeInTheDocument();
      expect(screen.getByText('Hydration Goal')).toBeInTheDocument();
    });

    // Check summary metrics
    expect(screen.getByText(/Today's Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/Best Active Streak/i)).toBeInTheDocument();
    expect(screen.getByText(/30-Day Consistency/i)).toBeInTheDocument();
    expect(screen.getByText('25 days')).toBeInTheDocument();
    expect(screen.getByText('83%')).toBeInTheDocument();

    // Default theme is Mocha
    expect(document.documentElement.getAttribute('data-theme')).toBe('mocha');
    expect(localStorage.getItem('habitpulse-theme')).toBe('mocha');

    // Toggle theme to Latte
    const themeToggle = screen.getByRole('button', { name: /switch to latte|latte/i });
    await user.click(themeToggle);

    expect(document.documentElement.getAttribute('data-theme')).toBe('latte');
    expect(localStorage.getItem('habitpulse-theme')).toBe('latte');

    // Toggle theme back to Mocha
    const mochaToggle = screen.getByRole('button', { name: /switch to mocha|mocha/i });
    await user.click(mochaToggle);

    expect(document.documentElement.getAttribute('data-theme')).toBe('mocha');
    expect(localStorage.getItem('habitpulse-theme')).toBe('mocha');
  });

  it('opens the "New Habit" modal, validates inputs, and triggers createHabit', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Morning Meditation')).toBeInTheDocument();
    });

    // Open modal
    const newHabitButton = screen.getByRole('button', { name: /^New Habit$/i });
    await user.click(newHabitButton);

    // Modal dialog title should appear
    expect(screen.getByRole('heading', { name: /create new habit/i })).toBeInTheDocument();

    // Fill form
    const nameInput = screen.getByLabelText(/habit name/i);
    await user.type(nameInput, 'Read Philosophy');

    const descInput = screen.getByLabelText(/description/i);
    await user.type(descInput, 'Meditations by Marcus Aurelius');

    // Choose quantitative
    const quantitativeRadio = screen.getByLabelText(/quantitative/i);
    await user.click(quantitativeRadio);

    const targetInput = screen.getByLabelText(/target value/i);
    await user.clear(targetInput);
    await user.type(targetInput, '20');

    const unitInput = screen.getByLabelText(/unit/i);
    await user.type(unitInput, 'pages');

    // Choose weekly frequency
    const weeklyRadio = screen.getByLabelText(/weekly/i);
    await user.click(weeklyRadio);

    const freqInput = screen.getByLabelText(/times per week/i);
    await user.clear(freqInput);
    await user.type(freqInput, '5');

    // Select Catppuccin color (e.g. peach)
    const peachColorBtn = screen.getByRole('button', { name: /peach/i });
    await user.click(peachColorBtn);

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /create habit/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.createHabit).toHaveBeenCalledWith({
        name: 'Read Philosophy',
        description: 'Meditations by Marcus Aurelius',
        color: 'peach',
        trackingType: 'quantitative',
        targetValue: 20,
        unit: 'pages',
        frequencyType: 'weekly',
        frequencyCount: 5,
      });
    });
  });

  it('clicking a day cell in the weekly habit matrix calls upsertHabitEntry and clicking delete calls deleteHabit', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Morning Meditation')).toBeInTheDocument();
    });

    // Day cell for 2026-11-11 on Morning Meditation (id: mockHabit1.id)
    const dayCell = screen.getByTestId(`cell-${mockHabit1.id}-2026-11-11`);
    await user.click(dayCell);

    await waitFor(() => {
      expect(apiClient.upsertHabitEntry).toHaveBeenCalledWith(
        mockHabit1.id,
        '2026-11-11',
        1,
      );
    });

    // Delete button for Morning Meditation
    const deleteBtn = screen.getByTestId(`delete-${mockHabit1.id}`);
    await user.click(deleteBtn);

    // Confirm deletion dialog or direct confirm
    const confirmBtn = await screen.findByRole('button', { name: /confirm delete|delete habit/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(apiClient.deleteHabit).toHaveBeenCalledWith(mockHabit1.id);
    });
  });

  it('formats local calendar dates without UTC timestamp conversion shifts', () => {
    // Nov 11, 2026 late night (23:45) - in timezones ahead of UTC, toISOString would produce Nov 12
    const lateNightDate = new Date(2026, 10, 11, 23, 45, 0);
    expect(formatLocalDate(lateNightDate)).toBe('2026-11-11');

    // Nov 11, 2026 early morning (00:15) - in timezones behind UTC, toISOString would produce Nov 10
    const earlyMorningDate = new Date(2026, 10, 11, 0, 15, 0);
    expect(formatLocalDate(earlyMorningDate)).toBe('2026-11-11');
  });

  it('displays weeks unit in heatmap stats chips and weekly progress in matrix for weekly habits', async () => {
    vi.mocked(apiClient.getDashboard).mockResolvedValue({
      ...mockDashboardResponse,
      habits: [
        {
          ...mockHabit1,
          frequencyType: 'weekly',
          frequencyCount: 4,
          currentStreak: 4,
        },
        mockHabit2,
      ],
    });
    vi.mocked(apiClient.getHabitHeatmap).mockResolvedValue({
      ...mockHeatmapResponse,
      habit: {
        ...mockHabit1,
        frequencyType: 'weekly',
      },
      stats: {
        currentStreak: 3,
        bestStreak: 7,
        completionRate30d: 85,
        totalCompletions: 42,
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('4 wks (2/4)')).toBeInTheDocument();
      expect(screen.getByText('3 weeks')).toBeInTheDocument();
      expect(screen.getByText('7 weeks')).toBeInTheDocument();
    });
  });
});
