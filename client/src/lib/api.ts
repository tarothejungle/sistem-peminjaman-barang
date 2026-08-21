import axios from "axios";

const AUTH_STORAGE_KEY = "auth-storage";

interface PersistedAuthStorage {
  state?: {
    accessToken?: string | null;
  };
}

function getStoredAccessToken(): string | null {
  try {
    const value = localStorage.getItem(AUTH_STORAGE_KEY);

    if (!value) {
      return null;
    }

    const storage = JSON.parse(value) as PersistedAuthStorage;
    return storage.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const accessToken = getStoredAccessToken();

  if (accessToken && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return config;
});

export default api;
