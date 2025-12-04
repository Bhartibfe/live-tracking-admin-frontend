import axios from "axios";
import { API_BASE_URL } from "../config";
import { useAuthStore } from "../store/authStore";

const http = axios.create({
  baseURL: API_BASE_URL
});

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default http;
