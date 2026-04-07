// User entity API
import { User, UserSettings } from './model';

export const userApi = {
  // 사용자 정보 조회
  getUser: async (userId: string) => {
    // Implementation will be added
  },

  // 사용자 정보 업데이트
  updateUser: async (userId: string, data: Partial<User>) => {
    // Implementation will be added
  },

  // 사용자 설정 조회
  getUserSettings: async (userId: string) => {
    // Implementation will be added
  },

  // 사용자 설정 업데이트
  updateUserSettings: async (userId: string, settings: UserSettings) => {
    // Implementation will be added
  }
};