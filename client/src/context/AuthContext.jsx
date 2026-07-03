import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("smartFarmUser");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("smartFarmToken");
    if (!token) return;

    setLoading(true);
    api
      .get("/auth/me")
      .then(({ data }) => {
        setUser(data.user);
        localStorage.setItem("smartFarmUser", JSON.stringify(data.user));
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []);

  async function login(payload) {
    const { data } = await api.post("/auth/login", payload);
    localStorage.setItem("smartFarmToken", data.token);
    localStorage.setItem("smartFarmUser", JSON.stringify(data.user));
    setUser(data.user);
  }

  async function signup(payload) {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("smartFarmToken", data.token);
    localStorage.setItem("smartFarmUser", JSON.stringify(data.user));
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("smartFarmToken");
    localStorage.removeItem("smartFarmUser");
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, login, signup, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
