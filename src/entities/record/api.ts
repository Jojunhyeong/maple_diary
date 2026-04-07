// Record entity API
import { Record, RecordWithCalculations } from './model';

export const recordApi = {
  // 기록 생성
  createRecord: async (record: Omit<Record, 'id' | 'created_at' | 'updated_at'>) => {
    // Implementation will be added
  },

  // 기록 조회
  getRecords: async (userId: string, filters?: any) => {
    // Implementation will be added
  },

  // 기록 업데이트
  updateRecord: async (recordId: string, data: Partial<Record>) => {
    // Implementation will be added
  },

  // 기록 삭제
  deleteRecord: async (recordId: string) => {
    // Implementation will be added
  }
};