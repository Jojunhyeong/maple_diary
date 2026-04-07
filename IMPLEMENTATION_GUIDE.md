# 메이플 재획 대시보드 - 구현 가이드

---

## ID 관계 명확화

**Supabase Auth와 앱 내부 ID의 관계:**
- `auth.users.id`: Supabase Auth가 관리하는 인증용 ID (절대 변경되지 않음)
- `public.users.id`: 앱 내부에서 사용하는 사용자 PK (UUID)
- `public.users.auth_id`: `auth.users.id`와 연결되는 FK
- `records.user_id`: `public.users.id`를 참조 (앱 내부 사용자 ID)

**API에서 사용자 식별 순서:**
1. `auth.uid()`로 현재 로그인한 Supabase Auth ID 획득
2. `SELECT id FROM users WHERE auth_id = auth.uid()`로 앱 내부 사용자 ID 조회
3. 해당 ID로 records/goals/settings 테이블 접근

---

## Part 1. 타입 정의 (TypeScript)

### types/index.ts

```typescript
// ===== 기본 사용자 관련 타입 =====

export interface LocalOwner {
  local_owner_id: string;  // UUID
  created_at: string;      // ISO 8601
}

export interface UserProfile {
  character_name: string;
  character_ocid?: string;
  class: string;
  level: number;
  image_url?: string;
  profile_set_at: string;
}

export interface UserSettings {
  shard_price: number;
  shard_price_updated_at: string;
  timezone: string;
  currency: string;
}

export interface UserGoals {
  current_month: string;  // "2026-04"
  meso_goal?: number;
  shard_goal?: number;
  time_goal_minutes?: number;
}

// ===== 기록 관련 타입 =====

export type SyncStatus = "local" | "pending" | "synced" | "error";

export interface Record {
  id: string;  // UUID
  local_owner_id?: string;
  user_id?: string;  // 서버 저장 시
  date: string;      // YYYY-MM-DD
  time_minutes: number;
  meso: number;
  shard_count: number;
  material_cost: number;
  memo?: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  local_id?: string;  // 마이그레이션용
}

export interface RecordWithCalculations extends Record {
  shard_value: number;
  total_revenue: number;
  net_revenue: number;
  meso_per_hour: number;
  net_per_hour: number;
  shard_per_hour: number;
}

// ===== 분석 관련 타입 =====

export interface DailyStats {
  date: string;
  record_count: number;
  total_revenue: number;
  average_revenue: number;
  total_time_minutes: number;
  total_shards: number;
}

export interface PeriodStats {
  period: "week" | "month" | "all";
  total_revenue: number;
  average_revenue: number;
  record_count: number;
  total_time_minutes: number;
  total_shards: number;
  max_record: number;
  min_record: number;
}

export interface TrendData {
  date: string;
  revenue: number;
  time_minutes: number;
  shard_count: number;
}

// ===== 목표 관련 타입 =====

export interface Goal {
  id: string;
  user_id?: string;
  local_owner_id?: string;
  month: string;     // "2026-04"
  meso_goal?: number;
  shard_goal?: number;
  time_goal_minutes?: number;
  created_at: string;
}

export interface GoalProgress {
  goal: Goal;
  meso_progress?: {
    current: number;
    goal: number;
    percentage: number;
    remaining: number;
    expected_date?: string;
  };
  shard_progress?: {
    current: number;
    goal: number;
    percentage: number;
    remaining: number;
    expected_date?: string;
  };
  time_progress?: {
    current: number;  // minutes
    goal: number;
    percentage: number;
    remaining: number;
    expected_date?: string;
  };
}

// ===== 인증 관련 타입 =====

export interface AuthUser {
  id: string;
  email: string;
  provider: string;
  created_at: string;
}

export interface MigrationOption {
  local_owner_id: string;
  option: "transfer" | "server_only" | "merge";
  local_records_count: number;
  server_records_count?: number;
}

// ===== API 응답 타입 =====

export interface MapleCharacterResponse {
  character_id: string;
  character_name: string;
  world_name: string;
  character_class: string;
  character_level: number;
  character_exp: number;
  character_image: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  success: boolean;
}
```

---

## Part 2. 계산 유틸리티

### lib/utils/calculations.ts

```typescript
import { Record, RecordWithCalculations, GoalProgress } from "@/types";

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
```

---

## Part 3. 포매팅 유틸리티

### lib/utils/formatters.ts

```typescript
/**
 * 메소를 "123.5M" 형식으로 포맷
 */
export const formatMeso = (meso: number): string => {
  if (meso >= 1_000_000_000) {
    return `${(meso / 1_000_000_000).toFixed(1)}B`;
  }
  if (meso >= 1_000_000) {
    return `${(meso / 1_000_000).toFixed(1)}M`;
  }
  if (meso >= 1_000) {
    return `${(meso / 1_000).toFixed(1)}K`;
  }
  return meso.toString();
};

/**
 * 정수를 포맷 (쉼표 추가)
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString("en-US");
};

/**
 * 분을 "2시간 30분" 형식으로 포맷
 */
export const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
};

/**
 * 날짜를 "2026-04-06" 형식으로
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * 날짜를 "4월 6일 (일)" 형식으로
 */
export const formatDateKorean = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = dayNames[d.getDay()];
  return `${month}월 ${day}일 (${dayName})`;
};

/**
 * 시간과 분을 입력값으로 (예: 2:30 → 150분)
 */
export const parseTimeInput = (
  hours: number,
  minutes: number
): number => {
  return hours * 60 + minutes;
};

/**
 * 백분율 포맷 (소수점 1자리)
 */
export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * 예상 달성일을 "4월 15일" 형식으로
 */
export const formatExpectedDate = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일`;
};
```

---

## Part 4. IndexedDB 유틸리티

### lib/db/local.ts

```typescript
import { Record, Goal, UserProfile, UserSettings } from "@/types";

const DB_NAME = "maple_diary";
const DB_VERSION = 1;

const STORES = {
  RECORDS: "records",
  GOALS: "goals",
  SESSIONS: "sessions",
  BACKUPS: "backups",
};

/**
 * 데이터베이스 초기화
 */
export const initDB = async (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Records 스토어
      if (!db.objectStoreNames.contains(STORES.RECORDS)) {
        const recordStore = db.createObjectStore(STORES.RECORDS, {
          keyPath: "id",
        });
        recordStore.createIndex("local_owner_id", "local_owner_id");
        recordStore.createIndex("date", "date");
        recordStore.createIndex("created_at", "created_at");
      }

      // Goals 스토어
      if (!db.objectStoreNames.contains(STORES.GOALS)) {
        const goalStore = db.createObjectStore(STORES.GOALS, {
          keyPath: "id",
        });
        goalStore.createIndex("local_owner_id", "local_owner_id");
        goalStore.createIndex("month", "month");
      }

      // Sessions 스토어
      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        const sessionStore = db.createObjectStore(STORES.SESSIONS, {
          keyPath: "id",
        });
        sessionStore.createIndex("local_owner_id", "local_owner_id");
        sessionStore.createIndex("start_time", "start_time");
      }

      // Backups 스토어
      if (!db.objectStoreNames.contains(STORES.BACKUPS)) {
        const backupStore = db.createObjectStore(STORES.BACKUPS, {
          keyPath: "id",
        });
        backupStore.createIndex("local_owner_id", "local_owner_id");
        backupStore.createIndex("created_at", "created_at");
      }
    };
  });
};

/**
 * 기록 추가/업데이트
 */
export const saveRecord = async (
  record: Record,
  localOwnerId: string
): Promise<string> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.RECORDS], "readwrite");
    const store = tx.objectStore(STORES.RECORDS);

    const recordWithOwner = {
      ...record,
      local_owner_id: localOwnerId,
    };

    const request = store.put(recordWithOwner);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * 특정 로컬 오너의 모든 기록 조회
 */
export const getRecordsByOwner = async (
  localOwnerId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<Record[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.RECORDS], "readonly");
    const store = tx.objectStore(STORES.RECORDS);
    const index = store.index("local_owner_id");

    const request = index.getAll(localOwnerId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      let records = request.result;

      // 날짜 범위 필터링
      if (options?.startDate || options?.endDate) {
        records = records.filter((r) => {
          if (options.startDate && r.date < options.startDate) return false;
          if (options.endDate && r.date > options.endDate) return false;
          return true;
        });
      }

      // 역순 정렬 (최신순)
      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // limit 적용
      if (options?.limit) {
        records = records.slice(0, options.limit);
      }

      resolve(records);
    };
  });
};

/**
 * 기록 삭제
 */
export const deleteRecord = async (recordId: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.RECORDS], "readwrite");
    const store = tx.objectStore(STORES.RECORDS);
    const request = store.delete(recordId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

/**
 * 목표 저장
 */
export const saveGoal = async (
  goal: Goal,
  localOwnerId: string
): Promise<string> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.GOALS], "readwrite");
    const store = tx.objectStore(STORES.GOALS);

    const goalWithOwner = {
      ...goal,
      local_owner_id: localOwnerId,
    };

    const request = store.put(goalWithOwner);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * 특정 월의 목표 조회
 */
export const getGoalByMonth = async (
  localOwnerId: string,
  month: string  // "2026-04"
): Promise<Goal | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.GOALS], "readonly");
    const store = tx.objectStore(STORES.GOALS);
    const index = store.index("local_owner_id");

    const request = index.getAll(localOwnerId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const goals = request.result.filter((g) => g.month === month);
      resolve(goals.length > 0 ? goals[0] : null);
    };
  });
};

/**
 * 백업 생성
 */
export const createBackup = async (
  localOwnerId: string,
  data: unknown,
  backupCode: string
): Promise<string> => {
  const db = await initDB();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90일

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.BACKUPS], "readwrite");
    const store = tx.objectStore(STORES.BACKUPS);

    const backup = {
      id: crypto.randomUUID(),
      local_owner_id: localOwnerId,
      backup_code: backupCode,
      data: JSON.stringify(data),
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    const request = store.add(backup);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * 백업 코드로 데이터 복구
 */
export const restoreFromBackup = async (
  backupCode: string
): Promise<unknown> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.BACKUPS], "readonly");
    const store = tx.objectStore(STORES.BACKUPS);
    const index = store.index("backup_code");

    const request = index.get(backupCode);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const backup = request.result;
      if (!backup) {
        reject(new Error("Backup code not found"));
        return;
      }

      const expiresAt = new Date(backup.expires_at);
      if (expiresAt < new Date()) {
        reject(new Error("Backup has expired"));
        return;
      }

      resolve(JSON.parse(backup.data));
    };
  });
};

/**
 * 모든 데이터 삭제 (로컬 오너 기준)
 */
export const clearAllData = async (
  localOwnerId: string
): Promise<void> => {
  const db = await initDB();
  const stores = [STORES.RECORDS, STORES.GOALS, STORES.SESSIONS];

  for (const storeName of stores) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([storeName], "readwrite");
      const store = tx.objectStore(storeName);
      const index = store.index("local_owner_id");

      const request = index.getAll(localOwnerId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const records = request.result;
        records.forEach((record) => {
          store.delete(record.id);
        });
        resolve();
      };
    });
  }
};
```

---

## Part 5. 상태 관리 (Zustand 상세 구현)

### stores/useAuthStore.ts

```typescript
import { create } from "zustand";
import { AuthUser, LocalOwner } from "@/types";

interface AuthStore {
  // State
  localOwnerId: string | null;
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initializeLocal: () => void;
  setLocalOwnerId: (id: string) => void;
  loginWithKakao: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial State
  localOwnerId: null,
  authUser: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Actions
  initializeLocal: () => {
    const stored = localStorage.getItem("maple_diary:local_owner_id");
    if (!stored) {
      const newId = crypto.randomUUID();
      localStorage.setItem("maple_diary:local_owner_id", newId);
      set({ localOwnerId: newId });
    } else {
      set({ localOwnerId: stored });
    }
  },

  setLocalOwnerId: (id: string) => {
    localStorage.setItem("maple_diary:local_owner_id", id);
    set({ localOwnerId: id });
  },

  loginWithKakao: async (code: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch("/api/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const { user, token } = await response.json();

      localStorage.setItem("auth_token", token);
      set({
        authUser: user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      });
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.removeItem("auth_token");
      set({
        authUser: null,
        isAuthenticated: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Logout failed",
      });
    }
  },

  clearError: () => set({ error: null }),
}));
```

### stores/useRecordStore.ts

```typescript
import { create } from "zustand";
import { Record, RecordWithCalculations } from "@/types";
import { saveRecord, getRecordsByOwner, deleteRecord } from "@/lib/db/local";
import { enrichRecordWithCalculations } from "@/lib/utils/calculations";

interface RecordStore {
  // State
  records: RecordWithCalculations[];
  loading: boolean;
  error: string | null;
  lastSyncTime: Date | null;

  // Actions
  loadRecords: (
    localOwnerId: string,
    options?: { startDate?: string; endDate?: string }
  ) => Promise<void>;
  addRecord: (
    record: Omit<Record, "id" | "created_at" | "updated_at">,
    localOwnerId: string,
    shardPrice: number
  ) => Promise<void>;
  updateRecord: (
    id: string,
    updates: Partial<Record>,
    shardPrice: number
  ) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  syncLocalToServer: (localOwnerId: string) => Promise<void>;
  clearError: () => void;
}

export const useRecordStore = create<RecordStore>((set, get) => ({
  // Initial State
  records: [],
  loading: false,
  error: null,
  lastSyncTime: null,

  // Actions
  loadRecords: async (localOwnerId, options) => {
    set({ loading: true });
    try {
      const rawRecords = await getRecordsByOwner(localOwnerId, options);
      const shardPrice =
        JSON.parse(localStorage.getItem("maple_diary:settings") || "{}").shard_price || 107653;

      const enrichedRecords = rawRecords.map((r) =>
        enrichRecordWithCalculations(r, shardPrice)
      );

      set({
        records: enrichedRecords,
        loading: false,
        error: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load records",
        loading: false,
      });
    }
  },

  addRecord: async (record, localOwnerId, shardPrice) => {
    try {
      const newRecord: Record = {
        id: crypto.randomUUID(),
        ...record,
        local_owner_id: localOwnerId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: "local",
      };

      await saveRecord(newRecord, localOwnerId);

      const enriched = enrichRecordWithCalculations(newRecord, shardPrice);
      set((state) => ({
        records: [enriched, ...state.records],
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to save record",
      });
    }
  },

  updateRecord: async (id, updates, shardPrice) => {
    try {
      const record = get().records.find((r) => r.id === id);
      if (!record) throw new Error("Record not found");

      const updated: Record = {
        ...record,
        ...updates,
        updated_at: new Date().toISOString(),
        sync_status: "pending",
      };

      await saveRecord(updated, record.local_owner_id!);

      const enriched = enrichRecordWithCalculations(updated, shardPrice);
      set((state) => ({
        records: state.records.map((r) => (r.id === id ? enriched : r)),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to update record",
      });
    }
  },

  deleteRecord: async (id: string) => {
    try {
      await deleteRecord(id);
      set((state) => ({
        records: state.records.filter((r) => r.id !== id),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to delete record",
      });
    }
  },

  syncLocalToServer: async (localOwnerId: string) => {
    try {
      const pendingRecords = get().records.filter(
        (r) => r.sync_status === "pending" || r.sync_status === "local"
      );

      for (const record of pendingRecords) {
        await fetch("/api/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
        });
      }

      set({ lastSyncTime: new Date() });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }
  },

  clearError: () => set({ error: null }),
}));
```

### stores/useDashboardStore.ts

```typescript
import { create } from "zustand";
import { RecordWithCalculations } from "@/types";
import {
  calculateAverages,
  sumRecords,
  calculateTrend,
  findExtremes,
} from "@/lib/utils/calculations";

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
    const last7 = records.slice(0, 7);
    const byDate = new Map<string, number>();

    last7.forEach((r) => {
      byDate.set(r.date, (byDate.get(r.date) || 0) + r.net_revenue);
    });

    const data = Array.from(byDate.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));

    const average = calculateAverages(last7)?.average_revenue || 0;

    return { data, average };
  },

  thirtyDayStats: (records) => {
    const last30 = records.slice(0, 30);
    const average = calculateAverages(last30)?.average_revenue || 0;
    const trend = calculateTrend(last30);

    return { average, trend };
  },
}));
```

---

비슷하게 `useUserStore`, `useGoalStore`도 구현할 수 있습니다.

