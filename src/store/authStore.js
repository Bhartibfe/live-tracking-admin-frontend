import { create } from "zustand";
import { loginApi, meApi } from "../api/auth";

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem("token") || "",
  loading: false,
  error: null,

  isAuthenticated: () => !!get().token && !!get().user,
  isAdmin: () => get().user?.role === "admin",

  setToken(token) {
    localStorage.setItem("token", token);
    set({ token });
  },

  async login(email, password) {
    set({ loading: true, error: null });
    try {
      const data = await loginApi(email, password);
      const token = data.token;
      get().setToken(token);

      const me = await meApi();
      set({ user: me, loading: false });
      return true;
    } catch (err) {
      console.error(err);
      set({
        error: err.response?.data?.message || "Login failed",
        loading: false
      });
      return false;
    }
  },

  async loadUser() {
    if (!get().token) return;
    try {
      const me = await meApi();
      set({ user: me });
    } catch (err) {
      console.error("loadUser error", err);
      set({ user: null, token: "" });
      localStorage.removeItem("token");
    }
  },

  logout() {
    localStorage.removeItem("token");
    set({ user: null, token: "" });
  }
}));
