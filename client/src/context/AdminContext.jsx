import { createContext, useContext, useEffect, useMemo, useState } from "react";
import adminApi from "../services/adminApi";

const AdminContext = createContext(null);

function storedAdmin() {
  try { return JSON.parse(sessionStorage.getItem("smartFarmAdminUser") || "null"); } catch { return null; }
}

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(storedAdmin);
  const [loading, setLoading] = useState(Boolean(sessionStorage.getItem("smartFarmAdminToken")));

  useEffect(() => {
    if (!sessionStorage.getItem("smartFarmAdminToken")) return;
    adminApi.get("/admin/me")
      .then(({ data }) => {
        setAdmin(data.admin);
        sessionStorage.setItem("smartFarmAdminUser", JSON.stringify(data.admin));
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    const { data } = await adminApi.post("/admin/auth/login", credentials);
    sessionStorage.setItem("smartFarmAdminToken", data.token);
    sessionStorage.setItem("smartFarmAdminUser", JSON.stringify(data.admin));
    setAdmin(data.admin);
    return data.admin;
  }

  function logout() {
    sessionStorage.removeItem("smartFarmAdminToken");
    sessionStorage.removeItem("smartFarmAdminUser");
    setAdmin(null);
  }

  const value = useMemo(() => ({ admin, loading, login, logout }), [admin, loading]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  return useContext(AdminContext);
}
