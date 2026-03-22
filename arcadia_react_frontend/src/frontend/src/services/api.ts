import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

function readTokenFromLocalStorage(): string | null {
  const directToken = localStorage.getItem("authToken");
  if (directToken) {
    return directToken;
  }

  try {
    const persistedState = localStorage.getItem("arcadia-app-store");
    if (!persistedState) {
      return null;
    }

    const parsed = JSON.parse(persistedState);
    return parsed?.state?.authToken ?? null;
  } catch {
    return null;
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = readTokenFromLocalStorage();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const api = {
  auth: {
    login: (payload: { email: string; password: string }) =>
      apiClient.post("/auth/login", payload),
    register: (payload: { name: string; email: string; password: string }) =>
      apiClient.post("/auth/register", payload),
    me: () => apiClient.get("/auth/me"),
  },

  notes: {
    upload: (file: File, subject: string) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subject", subject);

      return apiClient.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
  },

  chat: {
    query: (payload: {
      message: string;
      document_id?: string;
      document_ids?: string[];
      topic?: string;
      language?: string;
    }) => apiClient.post("/chat", payload),
  },

  quiz: {
    generate: (payload: {
      document_id: string;
      tier?: number;
      num_questions?: number;
      language?: string;
    }) => apiClient.post("/quiz/generate", payload),
  },

  planner: {
    get: () => apiClient.get("/planner/tasks"),
    create: (payload: {
      user_id?: string;
      title?: string;
      subjects: Array<{
        subject: string;
        exam_date: string;
        weekly_hours?: number;
      }>;
    }) => apiClient.post("/planner/create", payload),
  },

  languages: {
    list: () => apiClient.get("/languages"),
  },

  tts: {
    synthesize: (payload: { text: string; language: string }) =>
      apiClient.post("/tts", payload),
    translate: (payload: {
      text: string;
      target_language: string;
      source_language?: string;
    }) => apiClient.post("/translate", payload),
  },

  dashboard: {
    stats: () => apiClient.get("/dashboard/stats"),
    mastery: () => apiClient.get("/dashboard/mastery"),
    recentQuizzes: () => apiClient.get("/dashboard/recent-quizzes"),
    reset: () => apiClient.delete("/dashboard/reset"),
  },
};
