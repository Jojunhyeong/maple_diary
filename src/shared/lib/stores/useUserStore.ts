import { create } from "zustand";
import { UserProfile, UserSettings } from "@/shared/types";

interface UserStore {
  // State
  profile: UserProfile | null;
  settings: UserSettings;
  loading: boolean;
  error: string | null;

  // Actions
  loadProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  clearError: () => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  // Initial State
  profile: null,
  settings: {
    shard_price: 7_000_000,  // 700만 (만 단위 기본값)
  },
  loading: false,
  error: null,

  // Actions
  loadProfile: async (userId: string) => {
    set({ loading: true });
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) throw new Error("Failed to load profile");

      const profile = await response.json();
      set({
        profile,
        loading: false,
        error: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load profile",
        loading: false,
      });
    }
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    try {
      const currentProfile = get().profile;
      if (!currentProfile) throw new Error("No profile loaded");

      const response = await fetch(`/api/users/${currentProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error("Failed to update profile");

      const updatedProfile = await response.json();
      set({
        profile: updatedProfile,
        error: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to update profile",
      });
    }
  },

  updateSettings: async (updates: Partial<UserSettings>) => {
    try {
      const newSettings = { ...get().settings, ...updates };

      // 로컬 스토리지에 설정 저장
      localStorage.setItem("maple_diary:settings", JSON.stringify(newSettings));

      set({ settings: newSettings });

      // 로그인된 경우 서버에도 저장
      const authToken = localStorage.getItem("auth_token");
      if (authToken) {
        await fetch("/api/settings", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(newSettings),
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to update settings",
      });
    }
  },

  clearError: () => set({ error: null }),
}));