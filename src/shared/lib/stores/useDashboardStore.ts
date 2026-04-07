import { create } from "zustand";
import { RecordWithCalculations } from "@/shared/types";
import {
  calculateAverages,
  sumRecords,
  calculateTrend,
} from "@/shared/lib/utils/calculations";

interface DashboardStore {
  // Computed getters
  todayRevenue: (records: RecordWithCalculations[]) => number;
  weeklyRevenue: (records: RecordWithCalculations[]) => number;
  monthlyRevenue: (records: RecordWithCalculations[]) => number;
  recentRecords: (
    records: RecordWithCalculations[],
    limit?: number
  ) => RecordWithCalculations[];
  sevenDayStats: (records: RecordWithCalculations[]) => {
    data: { date: string; revenue: number }[];
    average: number;
  };
  thirtyDayStats: (records: RecordWithCalculations[]) => {
    average: number;
    trend: number;
  };
}

export const useDashboardStore = create<DashboardStore>(() => ({
  todayRevenue: (records) => {
    const today = new Date().toISOString().split("T")[0];
    return sumRecords(
      records.filter((r) => r.date === today)
    ).total_revenue;
  },

  weeklyRevenue: (records) => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);

    const monday_str = monday.toISOString().split("T")[0];
    const today_str = today.toISOString().split("T")[0];

    return sumRecords(
      records.filter((r) => r.date >= monday_str && r.date <= today_str)
    ).total_revenue;
  },

  monthlyRevenue: (records) => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const firstDay_str = firstDay.toISOString().split("T")[0];
    const today_str = today.toISOString().split("T")[0];

    return sumRecords(
      records.filter((r) => r.date >= firstDay_str && r.date <= today_str)
    ).total_revenue;
  },

  recentRecords: (records, limit = 3) => {
    return records.slice(0, limit);
  },

  sevenDayStats: (records) => {
    const today = new Date();
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    const start = dates[0];
    const end = dates[6];

    const inRange = records.filter((r) => r.date >= start && r.date <= end);

    const byDate = new Map<string, number>();
    dates.forEach((d) => byDate.set(d, 0));
    inRange.forEach((r) => {
      byDate.set(r.date, (byDate.get(r.date) || 0) + r.net_revenue);
    });

    const data = dates.map((date) => ({ date, revenue: byDate.get(date) || 0 }));
    const daysWithRecord = data.filter((d) => d.revenue > 0);
    const average = daysWithRecord.length > 0
      ? daysWithRecord.reduce((s, d) => s + d.revenue, 0) / daysWithRecord.length
      : 0;

    return { data, average };
  },

  thirtyDayStats: (records) => {
    const last30 = records.slice(0, 30);
    const average = calculateAverages(last30)?.average_revenue || 0;
    const trend = calculateTrend(last30);

    return { average, trend };
  },
}));