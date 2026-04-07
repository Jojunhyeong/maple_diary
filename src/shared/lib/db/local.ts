import { Record, Goal } from "@/shared/types";

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
    request.onsuccess = () => resolve(request.result as string);
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
    request.onsuccess = () => resolve(request.result as string);
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
    request.onsuccess = () => resolve(request.result as string);
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