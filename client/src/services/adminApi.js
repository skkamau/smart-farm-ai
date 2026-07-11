import axios from "axios";
import { resolveApiBaseUrl } from "./api";

const adminApi = axios.create({ baseURL: resolveApiBaseUrl() });

adminApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("smartFarmAdminToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = String(error.response?.data?.message || "");
    if (error.response?.status === 401 || message === "Account suspended" || message === "Admin access required") {
      sessionStorage.removeItem("smartFarmAdminToken");
      sessionStorage.removeItem("smartFarmAdminUser");
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) window.location.assign("/admin/login");
    }
    return Promise.reject(error);
  }
);

export default adminApi;
