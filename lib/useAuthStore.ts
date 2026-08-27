import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

const secureStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};

type UserInfo = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  roleId: string | null;
  roleLabel: string;
  mustChangePassword?: boolean;
  permissions: Array<{
    menu: string;
    label: string;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>;
};

type AuthStore = {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  signIn: (token: string, user: UserInfo) => void;
  signOut: () => void;
  updateUser: (patch: Partial<UserInfo>) => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      signIn: (token, user) => set({ token, user, isAuthenticated: true }),
      signOut: () => set({ token: null, user: null, isAuthenticated: false }),
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
    }),
    {
      name: "line-auth",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
