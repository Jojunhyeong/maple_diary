import { create } from "zustand";
import { AuthUser } from "@/shared/types";

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