import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { storageGet, storageRemove, storageSet } from "../utils/storage";

const AuthContext = createContext(null);

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

  const value = useMemo(() => ({ user, loading, login, signup, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
