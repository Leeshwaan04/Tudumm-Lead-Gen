import axios from "axios";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.tudumm.io/v1";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("tudumm_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      typeof window !== "undefined"
    ) {
      localStorage.removeItem("tudumm_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Query key factories
export const queryKeys = {
  runs: {
    all: ["runs"] as const,
    list: (params?: Record<string, unknown>) => ["runs", "list", params] as const,
    detail: (id: string) => ["runs", "detail", id] as const,
  },
  actors: {
    all: ["actors"] as const,
    list: (params?: Record<string, unknown>) => ["actors", "list", params] as const,
    detail: (id: string) => ["actors", "detail", id] as const,
    store: (params?: Record<string, unknown>) => ["actors", "store", params] as const,
  },
  phantoms: {
    all: ["phantoms"] as const,
    list: (params?: Record<string, unknown>) => ["phantoms", "list", params] as const,
    detail: (id: string) => ["phantoms", "detail", id] as const,
  },
  workflows: {
    all: ["workflows"] as const,
    list: () => ["workflows", "list"] as const,
    detail: (id: string) => ["workflows", "detail", id] as const,
  },
  datasets: {
    all: ["datasets"] as const,
    list: () => ["datasets", "list"] as const,
    detail: (id: string) => ["datasets", "detail", id] as const,
    items: (id: string, page: number) => ["datasets", "items", id, page] as const,
  },
  schedules: {
    all: ["schedules"] as const,
    list: () => ["schedules", "list"] as const,
  },
  billing: {
    all: ["billing"] as const,
    credits: () => ["billing", "credits"] as const,
    invoices: () => ["billing", "invoices"] as const,
  },
  proxy: {
    all: ["proxy"] as const,
    usage: () => ["proxy", "usage"] as const,
    configs: () => ["proxy", "configs"] as const,
  },
  workspace: {
    all: ["workspace"] as const,
    current: () => ["workspace", "current"] as const,
    apiKeys: () => ["workspace", "apiKeys"] as const,
  },
  usage: {
    all: ["usage"] as const,
    timeSeries: (range: string) => ["usage", "timeSeries", range] as const,
  },
};
