import axios from "axios";

// Use NEXT_PUBLIC_API_URL directly (should be "/api" or "https://domain.com/api")
const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add auth token + fix Content-Type for FormData
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Let Axios set the correct Content-Type for FormData (multipart/form-data with boundary)
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — wipe client-side auth state.
      // Note: we avoid importing the zustand store here to prevent a cyclic
      // module dependency (store -> service -> api -> store). Instead we
      // manually clear the storage keys the store owns; the next mount of
      // useAuthBootstrap will observe the missing token and stay logged out.
      localStorage.removeItem("access_token");
      localStorage.removeItem("auth_user_display");
      localStorage.removeItem("user"); // legacy pre-SEC-03 key
      // Best-effort: dispatch a synthetic event so the auth store can
      // reset its in-memory state (listener wired in useAuthBootstrap /
      // AuthProvider). Avoids a direct store import here which would
      // create a cyclic module dependency (store -> service -> api -> store).
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:cleared"));
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
