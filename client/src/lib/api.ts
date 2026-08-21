import axios from "axios";
import { getAccessToken } from "./authToken";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

api.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = String(error?.config?.url ?? "");
    if (error?.response?.status === 401 && !url.includes("/auth/login") && !url.includes("/auth/refresh") && !url.includes("/auth/logout")) {
      const code = error?.response?.data?.error?.details?.code;
      window.dispatchEvent(new CustomEvent("auth:unauthorized", { detail: { code } }));
    }
    return Promise.reject(error);
  },
);

export default api;
