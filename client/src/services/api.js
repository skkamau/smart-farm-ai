import axios from "axios";
import { storageGet } from "../utils/storage";

const productionApiUrl = "https://smart-farm-ai-api.onrender.com/api";

export function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL;
  if (configured && configured !== "auto") return configured;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    const isLocalNetwork = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
    if (!isLocalHost && !isLocalNetwork) return productionApiUrl;
  }

  return "/api";
}

const api = axios.create({
  baseURL: resolveApiBaseUrl()
});

api.interceptors.request.use((config) => {
  const token = storageGet("smartFarmToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && String(error.response?.data?.message || "").startsWith("Account suspended")) {
      storageRemove("smartFarmToken");
      storageRemove("smartFarmUser");
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) window.location.assign("/login?status=suspended");
    }
    return Promise.reject(error);
  }
);

export default api;
