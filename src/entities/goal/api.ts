// Goal entity API
import { Goal } from './model';

export const goalApi = {
  // 목표 생성/업데이트
  upsertGoal: async (goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => {
    // Implementation will be added
  },

  // 목표 조회
  getGoal: async (userId: string, month: string) => {
    // Implementation will be added
  },

  // 목표 삭제
  deleteGoal: async (goalId: string) => {
    // Implementation will be added
  }
};