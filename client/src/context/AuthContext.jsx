import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { storageGet, storageRemove, storageSet } from "../utils/storage";

const AuthContext = createContext(null);

function applyTheme(theme) {
  if (typeof window === "undefined") return;
  const selected = theme || storageGet("smartFarmTheme") || "system";
  storageSet("smartFarmTheme", selected);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  const useDark = selected === "dark" || (selected === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", Boolean(useDark));
  document.documentElement.dataset.theme = selected;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = storageGet("smartFarmUser");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      storageRemove("smartFarmUser");
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    applyTheme(user?.preferences?.theme);
  }, [user?.preferences?.theme]);

  useEffect(() => {
    applyTheme();
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((storageGet("smartFarmTheme") || "system") === "system") applyTheme("system");
    };
    media?.addEventListener?.("change", onChange);
    return () => media?.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const token = storageGet("smartFarmToken");
    if (!token) return;

    setLoading(true);
    api
      .get("/auth/me")
      .then(({ data }) => {
        setUser(data.user);
        storageSet("smartFarmUser", JSON.stringify(data.user));
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []);

  async function login(payload) {
    const { data } = await api.post("/auth/login", payload);
    storageSet("smartFarmToken", data.token);
    storageSet("smartFarmUser", JSON.stringify(data.user));
    setUser(data.user);
  }

  async function signup(payload) {
    const { data } = await api.post("/auth/register", payload);
    storageSet("smartFarmToken", data.token);
    storageSet("smartFarmUser", JSON.stringify(data.user));
    setUser(data.user);
  }

  function logout() {
    storageRemove("smartFarmToken");
    storageRemove("smartFarmUser");
    setUser(null);
  }

  async function updateProfile(payload) {
    const { data } = await api.put("/auth/me", payload);
    storageSet("smartFarmUser", JSON.stringify(data.user));
    setUser(data.user);
    applyTheme(data.user?.preferences?.theme);
    return data.user;
  }

  const value = useMemo(() => ({ user, loading, login, signup, logout, updateProfile, applyTheme }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
