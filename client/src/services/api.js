import axios from "axios";
import { storageGet } from "../utils/storage";

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL;
  if (configured && configured !== "auto") return configured;

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
