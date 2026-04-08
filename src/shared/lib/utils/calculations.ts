import { Record, RecordWithCalculations, GoalProgress } from "@/shared/types";
import { formatDate } from "@/shared/lib/utils/formatters";

/**
 * 조각 환산 가치 계산
 */
export const calculateShardValue = (
  shardCount: number,
  shardPrice: number
): number => {
  return shardCount * shardPrice;
};

/**
 * 총 수익 계산 (메소 + 조각 환산)
 */
export const calculateTotalRevenue = (
  meso: number,
  shardValue: number
): number => {
  return Math.floor(meso + shardValue);
};

/**
 * 순수익 계산 (총 수익 - 소재비)
 */
export const calculateNetRevenue = (
  totalRevenue: number,
  materialCost: number
): number => {
  return Math.floor(totalRevenue - materialCost);
};

/**
 * 시간당 메소
 */
export const calculateMesoPerHour = (
  meso: number,
  timeMinutes: number
): number => {
  const hours = timeMinutes / 60;
  return Math.floor(meso / hours);
};

/**
 * 시간당 순수익
 */
export const calculateNetPerHour = (
  netRevenue: number,
  timeMinutes: number
): number => {
  const hours = timeMinutes / 60;
  return Math.floor(netRevenue / hours);
};

/**
 * 시간당 조각
 */
export const calculateShardPerHour = (
  shardCount: number,
  timeMinutes: number
): number => {
  const hours = timeMinutes / 60;
  return Math.floor(shardCount / hours);
};

/**
 * 기록에 계산값 추가
 */
export const enrichRecordWithCalculations = (
  record: Record,
  shardPrice: number
): RecordWithCalculations => {
  const shard_value = calculateShardValue(record.shard_count, shardPrice);
  const total_revenue = calculateTotalRevenue(record.meso, shard_value);
  const net_revenue = calculateNetRevenue(total_revenue, record.material_cost);
  const meso_per_hour = calculateMesoPerHour(record.meso, record.time_minutes);
  const net_per_hour = calculateNetPerHour(net_revenue, record.time_minutes);
  const shard_per_hour = calculateShardPerHour(
    record.shard_count,
    record.time_minutes
  );

  return {
    ...record,
    shard_value,
    total_revenue,
    net_revenue,
    meso_per_hour,
    net_per_hour,
    shard_per_hour,
  };
};

/**
 * 여러 기록의 합계 계산
 */
export const sumRecords = (records: RecordWithCalculations[]) => {
  return {
    total_revenue: records.reduce((sum, r) => sum + r.net_revenue, 0),
    total_meso: records.reduce((sum, r) => sum + r.meso, 0),
    total_shards: records.reduce((sum, r) => sum + r.shard_count, 0),
    total_time_minutes: records.reduce((sum, r) => sum + r.time_minutes, 0),
    total_material_cost: records.reduce((sum, r) => sum + r.material_cost, 0),
    count: records.length,
  };
};

/**
 * 평균값 계산
 */
export const calculateAverages = (records: RecordWithCalculations[]) => {
  const sums = sumRecords(records);
  if (sums.count === 0) return null;

  return {
    average_revenue: Math.floor(sums.total_revenue / sums.count),
    average_time_minutes: Math.floor(sums.total_time_minutes / sums.count),
    average_shards: Math.floor(sums.total_shards / sums.count),
    average_meso_per_hour: Math.floor(
      sums.total_meso / (sums.total_time_minutes / 60)
    ),
  };
};

/**
 * 최고/최저 기록
 */
export const findExtremes = (records: RecordWithCalculations[]) => {
  if (records.length === 0) return null;

  const sorted = [...records].sort((a, b) => b.net_revenue - a.net_revenue);

  return {
    max_record: sorted[0],
    min_record: sorted[sorted.length - 1],
    variance: sorted[0].net_revenue - sorted[sorted.length - 1].net_revenue,
    variance_percent: Math.floor(
      (
        ((sorted[0].net_revenue - sorted[sorted.length - 1].net_revenue) /
          sorted[sorted.length - 1].net_revenue) *
        100
      )
    ),
  };
};

/**
 * 목표 달성률 계산
 */
export const calculateGoalProgress = (
  current: number,
  goal: number,
  totalDaysInMonth: number = 30,
  daysPassed: number,
  allRecords: RecordWithCalculations[]
): GoalProgress["meso_progress"] => {
  const percentage = (current / goal) * 100;
  const remaining = goal - current;

  // 현재 페이스 기반 예상 달성일
  const currentPace = (current / daysPassed) * totalDaysInMonth;
  const isOnTrack = currentPace >= goal;
  let expected_date: string | undefined;

  if (!isOnTrack && allRecords.length > 0) {
    const avgDaily = current / daysPassed;
    const daysNeeded = remaining / avgDaily;
    const today = new Date();
    const expectedDate = new Date(
      today.getTime() + daysNeeded * 24 * 60 * 60 * 1000
    );
    expected_date = expectedDate.toISOString().split("T")[0];
  }

  return {
    current,
    goal,
    percentage: Math.min(percentage, 100),
    remaining: Math.max(remaining, 0),
    expected_date,
  };
};

/**
 * 주간 통계 계산 (월~일 기준)
 */
export interface WeekStats {
  weekLabel: string;   // '이번 주' | '저번 주' | '2주 전' ...
  startDate: string;
  endDate: string;
  count: number;       // 세션 수
  activeDays: number;
  totalNetRevenue: number;
  avgDailyNetRevenue: number; // 날짜당 순수익
  avgNetPerHour: number;    // 시간당 순수익
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const calculateWeeklyStats = (
  records: RecordWithCalculations[],
  weeksBack: number = 4
): WeekStats[] => {
  const today = new Date();
  const result: WeekStats[] = [];

  for (let i = 0; i < weeksBack; i++) {
    const anchor = new Date(today);
    anchor.setDate(today.getDate() - i * 7);
    const monday = getMondayOf(anchor);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startDate = formatDate(monday);
    const endDate = formatDate(sunday);
    const todayStr = formatDate(today);

    const clampedEnd = endDate > todayStr ? todayStr : endDate;
    const wr = records.filter((r) => r.date >= startDate && r.date <= clampedEnd);

    const count = wr.length;
    const totalNetRevenue = wr.reduce((s, r) => s + r.net_revenue, 0);
    const totalTime = wr.reduce((s, r) => s + r.time_minutes, 0);
    const activeDays = new Set(wr.map((r) => r.date)).size;

    const avgDailyNetRevenue = activeDays > 0 ? Math.floor(totalNetRevenue / activeDays) : 0;
    const avgNetPerHour = totalTime > 0 ? Math.floor((totalNetRevenue / totalTime) * 60) : 0;

    const weekLabel = i === 0 ? '이번 주' : i === 1 ? '저번 주' : `${i}주 전`;

    result.push({
      weekLabel,
      startDate,
      endDate: clampedEnd,
      count,
      activeDays,
      totalNetRevenue,
      avgDailyNetRevenue,
      avgNetPerHour,
    });
  }

  return result;
};

/**
 * 추이 계산 (백분율)
 */
export const calculateTrend = (
  records: RecordWithCalculations[]
): number => {
  if (records.length < 2) return 0;

  const mid = Math.floor(records.length / 2);
  const previousHalf = records.slice(0, mid);
  const currentHalf = records.slice(mid);

  const prevAvg = calculateAverages(previousHalf)?.average_revenue || 0;
  const currAvg = calculateAverages(currentHalf)?.average_revenue || 0;

  if (prevAvg === 0) return 0;

  return Math.floor(((currAvg - prevAvg) / prevAvg) * 100);
};
