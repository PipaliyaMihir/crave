import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// --- 1. REQUEST INTERCEPTOR (Attach Token) ---
api.interceptors.request.use(
  (config) => {
    // Check both Local Storage and Session Storage
    let token = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (token) {
      // Remove any extra quotes that might have been saved by JSON.stringify
      token = token.replace(/^"|"$/g, '');

      // Attach the token to the header
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- 2. RESPONSE INTERCEPTOR (Handle Errors) ---
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the token is invalid or expired (401 Unauthorized)
    // 1. Check if the error is a 401 (Unauthorized)
    if (error.response && error.response.status === 401) {
      console.warn("Session expired or invalid token.");

      // Clear all storage to prevent loop
      
      // 2. CHECK: Is this error coming from the login request itself?
      // We check if the request URL includes '/login'
      const isLoginRequest = error.config.url.includes('/login');

      // 3. Only trigger the logout/reload if it is NOT a login request
      if (!isLoginRequest) {
        sessionStorage.clear();
      localStorage.clear();

      // Redirect to login only if not already there
      if (window.location.pathname !== "/login") {
          // window.location.reload(); // Or redirect to auth
        window.location.href = '/auth';
      }
      }
    }
    
    // 4. Always reject the error so your AuthPage catch block receives it
    return Promise.reject(error);
  }
);

export default api;