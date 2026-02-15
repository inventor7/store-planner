import axios from "axios";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "request-type": "json",
  },
});

let accessToken: string | null = null;

export const setAccessToken = (token: string) => {
  accessToken = token;
};

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers["access-token"] = accessToken;
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    // Handle JSON-RPC response format
    // If the response has a "result" field, unwrap it
    if (response.data && typeof response.data === "object" && "result" in response.data) {
      response.data = response.data.result;
    }
    return response;
  },
  (error) => {
    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  },
);

export { http };
