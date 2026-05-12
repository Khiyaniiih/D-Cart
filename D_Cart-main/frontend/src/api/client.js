import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api"
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("dcart_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Auto-handle expired or invalid tokens
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Dispatch a custom event so AuthContext can auto-logout
      window.dispatchEvent(new CustomEvent("dcart:unauthorized"));
    }

    return Promise.reject(error);
  }
);

export default client;

