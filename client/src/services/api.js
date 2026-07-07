import axios from "axios";
import { storageGet } from "../utils/storage";

const productionApiUrl = "https://smart-farm-ai-api.onrender.com/api";

function resolveApiBaseUrl() {
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

export default api;
