import axios from "axios";
import { useAppStore } from "@/store/useAppStore";

function extractErrorDetail(payload: unknown): string {
  if (!payload) return "";

  if (typeof payload === "string") {
    return payload.trim();
  }

  if (Array.isArray(payload)) {
    const parts = payload
      .map((item) => extractErrorDetail(item))
      .filter((item) => Boolean(item));
    return parts.join("; ");
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    const direct =
      extractErrorDetail(record.detail) ||
      extractErrorDetail(record.message) ||
      extractErrorDetail(record.error);
    if (direct) return direct;

    if (Array.isArray(record.errors)) {
      const message = record.errors
        .map((item) => extractErrorDetail(item))
        .filter((item) => Boolean(item))
        .join("; ");
      if (message) return message;
    }

    if (typeof record.msg === "string") {
      const loc = Array.isArray(record.loc)
        ? record.loc.filter((entry) => typeof entry === "string" || typeof entry === "number").join(".")
        : "";
      return loc ? `${loc}: ${record.msg}` : record.msg;
    }
  }

  return "";
}

function statusFallback(status: number): string {
  if (status === 401) return "Your session expired. Please sign in again.";
  if (status === 403) return "You do not have permission for this action.";
  if (status === 404) return "Requested resource was not found.";
  if (status === 409) return "This action conflicts with existing data. Please review and retry.";
  if (status === 422) return "Invalid input. Please review the form and try again.";
  if (status >= 500) return "Server error. Please try again shortly.";
  return "Request failed. Please try again.";
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = extractErrorDetail(error.response?.data);
    if (detail) return `${fallback}: ${detail}`;

    if (!error.response) {
      return `${fallback}: Unable to reach the server. Please check your connection and backend status.`;
    }

    return `${fallback}: ${statusFallback(error.response.status)}`;
  }

  if (error instanceof Error && error.message.trim()) {
    return `${fallback}: ${error.message.trim()}`;
  }

  return fallback;
}

export interface AuthResponse {
  user_id: string;
  name: string;
  email: string;
  token: string;
}

export interface DocumentItem {
  id: string;
  note_id: string;
  note_title?: string;
  filename: string;
  original_name: string;
  subject: string;
  topic: string;
  is_starred: boolean;
  created_at: string;
  extracted_text_preview?: string;
}

export interface PinnedItem {
  id: string;
  label: string;
  to: string;
}

export interface TopicItem {
  title: string;
  summary: string;
}

export interface NoteUpdateResponse {
  note: {
    id: string;
    title: string;
    subject: string;
    document_count: number;
    created_at: string;
    updated_at: string;
  };
  documents: DocumentItem[];
}

export interface PlannerTask {
  id: string;
  subject: string;
  task_type: string;
  focus_topic: string;
  due_date: string;
  start_time: string;
  end_time: string;
  estimated_minutes: number;
  status: "pending" | "completed";
}

export interface PlannerSubjectStat {
  subject: string;
  documents: number;
  chunks: number;
  topics: string[];
}

export interface ChatRequest {
  document_id?: string;
  document_ids?: string[];
  note_id?: string;
  topic?: string;
  message: string;
  language: string;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
  language: string;
}

export interface TranslateResponse {
  original_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
}

export interface StoredStudyMaterialsResponse {
  document_id: string;
  language: string;
  focus_topic: string;
  cheatsheet?: {
    document_id: string;
    title: string;
    content: string;
    language: string;
  } | null;
  flashcards?: {
    document_id: string;
    cards: Array<{ front: string; back: string }>;
    language: string;
  } | null;
  diagram?: {
    document_id: string;
    title: string;
    mermaid_code: string;
  } | null;
}

export interface CodeRunResponse {
  language: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = useAppStore.getState().authToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const detail = extractErrorDetail(error.response?.data);
      if (detail) {
        error.message = detail;
      } else if (!error.response) {
        error.message = "Unable to reach the server. Please check your connection and backend status.";
      } else {
        error.message = statusFallback(error.response.status);
      }
    }

    return Promise.reject(error);
  },
);

export const apiClient = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { email, password }),

  register: (name: string, email: string, password: string) =>
    api.post<AuthResponse>("/auth/register", { name, email, password }),

  me: () => api.get<{ user_id: string; name: string; email: string }>("/auth/me"),

  getLanguages: () => api.get<Record<string, string>>("/languages"),

  uploadDocument: (
    formData: FormData,
    onUploadProgress?: (progress: number) => void,
  ) =>
    api.post<DocumentItem>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!event.total || !onUploadProgress) return;
        const percent = Math.round((event.loaded * 100) / event.total);
        onUploadProgress(percent);
      },
    }),

  listDocuments: () =>
    api.get<{ documents: DocumentItem[]; total: number }>("/documents"),

  listPinnedDocuments: () => api.get<PinnedItem[]>("/documents/pinned"),

  getDocument: (docId: string) => api.get<DocumentItem>(`/documents/${docId}`),

  setDocumentStar: (docId: string, starred: boolean) =>
    api.patch<{ id: string; is_starred: boolean }>(`/documents/${docId}/star`, {
      starred,
    }),

  setNoteStar: (noteId: string, starred: boolean) =>
    api.patch<{ note_id: string; is_starred: boolean }>(`/notes/${noteId}/star`, {
      starred,
    }),

  updateDocument: (
    docId: string,
    payload: { filename?: string; subject?: string; topic?: string }
  ) => api.patch<DocumentItem>(`/documents/${docId}`, payload),

  updateNote: (
    noteId: string,
    payload: { title?: string; subject?: string; topic?: string }
  ) => api.patch<NoteUpdateResponse>(`/notes/${noteId}`, payload),

  deleteDocument: (docId: string) => api.delete(`/documents/${docId}`),

  extractTopics: (docId: string, force = false) =>
    api.post<{ document_id: string; topics: TopicItem[]; summary: string }>(
      `/documents/${docId}/topics${force ? "?force=true" : ""}`,
    ),

  chat: (payload: ChatRequest) => api.post<ChatResponse>("/chat", payload),

  getChatHistory: (documentId: string) =>
    api.get<Array<{ role: "user" | "assistant"; content: string; created_at: string }>>(
      `/chat/history/${documentId}`,
    ),

  clearChatHistory: (documentId: string) =>
    api.delete<{ status: string; document_id: string; deleted: number }>(
      `/chat/history/${documentId}`,
    ),

  translate: (payload: {
    text: string;
    source_language?: string;
    target_language: string;
  }) => api.post<TranslateResponse>("/translate", payload),

  tts: (text: string, language: string) =>
    api.post<{ audio_url: string; language: string }>("/tts", { text, language }),

  getDashboardStats: () =>
    api.get<{
      stats: {
        total_documents: number;
        total_quizzes_taken: number;
        average_score: number;
        topics_mastered: number;
        study_streak: number;
      };
      mastery: Array<{
        document_id: string;
        topic: string;
        mastery_score: number;
        tier_unlocked: number;
        total_attempts: number;
      }>;
    }>("/dashboard/stats"),

  resetDashboard: () => api.delete("/dashboard/reset"),

  generateQuiz: (payload: {
    document_id: string;
    note_id?: string;
    tier: number;
    num_questions: number;
    language: string;
    focus_topic: string;
  }) =>
    api.post<{
      quiz_id: string;
      document_id: string;
      note_id?: string;
      tier: number;
      questions: Array<{
        id: number;
        question: string;
        options: string[];
        tier: number;
      }>;
    }>("/quiz/generate", payload),

  submitQuiz: (payload: {
    quiz_id: string;
    document_id: string;
    note_id?: string;
    answers: Array<{ question_id: number; selected_option: number }>;
  }) =>
    api.post<{
      quiz_id: string;
      tier: number;
      total_questions: number;
      correct_answers: number;
      score: number;
      results: Array<{
        question_id: number;
        question: string;
        selected_option: number;
        correct_option: number;
        is_correct: boolean;
        explanation: string;
      }>;
      next_tier_unlocked: boolean;
      mastery_score: number;
    }>("/quiz/submit", payload),

  getStoredStudyMaterials: (payload: {
    document_id: string;
    note_id?: string;
    language: string;
    focus_topic: string;
  }) =>
    api.get<StoredStudyMaterialsResponse>(
      `/generate/stored/${payload.document_id}?note_id=${encodeURIComponent(payload.note_id || "")}&language=${encodeURIComponent(payload.language)}&focus_topic=${encodeURIComponent(payload.focus_topic || "")}`,
    ),

  generateCheatsheet: (
    payload: {
      document_id: string;
      note_id?: string;
      language: string;
      focus_topic: string;
    },
    force = false,
  ) =>
    api.post<{ title: string; content: string }>(
      `/generate/cheatsheet${force ? "?force=true" : ""}`,
      payload,
    ),

  generateFlashcards: (
    payload: {
      document_id: string;
      note_id?: string;
      language: string;
      focus_topic: string;
    },
    force = false,
  ) =>
    api.post<{ cards: Array<{ front: string; back: string }> }>(
      `/generate/flashcards${force ? "?force=true" : ""}`,
      payload,
    ),

  generateDiagram: (
    payload: {
      document_id: string;
      note_id?: string;
      language: string;
      focus_topic: string;
    },
    force = false,
  ) =>
    api.post<{ title: string; mermaid_code: string }>(
      `/generate/diagram${force ? "?force=true" : ""}`,
      payload,
    ),

  createChallengeRoom: (payload: {
    document_id: string;
    note_id?: string;
    tier: number;
    num_questions: number;
    language: string;
    focus_topic: string;
  }) =>
    api.post<{ code: string; room_id: string; status: string }>(
      "/challenge/create",
      payload,
    ),

  joinChallengeRoom: (code: string) =>
    api.post<{ code: string; room_id: string; status: string }>("/challenge/join", {
      code,
    }),

  getChallengeRoom: (code: string) =>
    api.get<{
      code: string;
      status: "waiting" | "active" | "finished";
      tier: number;
      num_questions: number;
      participants: Array<{ name: string; score: number; submitted: boolean }>;
      questions: Array<{ id: number; question: string; options: string[]; tier: number }>;
    }>(`/challenge/${code}`),

  startChallengeRoom: (code: string) => api.post(`/challenge/${code}/start`),

  getChallengeLeaderboard: (code: string) =>
    api.get<{
      leaderboard: Array<{ name: string; score: number; submitted: boolean }>;
      status: string;
    }>(`/challenge/${code}/leaderboard`),

  getPlannerTasks: () =>
    api.get<{
      tasks: PlannerTask[];
      available_subjects: PlannerSubjectStat[];
      weak_topics: Array<{
        topic: string;
        document_id: string;
        weakness_score: number;
        wrong_attempts: number;
      }>;
      activity_heatmap: Array<{ date: string; count: number }>;
    }>("/planner/tasks"),

  createPlannerPlan: (payload: {
    user_id?: string;
    title?: string;
    subjects: Array<{ subject: string; exam_date: string; weekly_hours: number }>;
  }) => api.post<{ plan_id: string; status: string }>("/planner/create", payload),

  completePlannerTask: (taskId: string) =>
    api.post<{ status: string; task_id: string }>(`/planner/tasks/${taskId}/complete`),

  clearPlannerTasks: (includeCompleted = true) =>
    api.delete<{ status: string; deleted_tasks: number; deleted_plans: number }>(
      `/planner/tasks?include_completed=${includeCompleted ? "true" : "false"}`,
    ),

  // --- NEW ROUTE: Save Custom Planner Task ---
  saveCustomPlannerTask: (payload: { due_date: string; label: string }) =>
    api.post<{ status: string }>("/planner/tasks/custom", payload),

  getWhiteboardHint: (payload: {
    image_base64?: string;
    question?: string;
    topic?: string;
    rough_work_text?: string;
  }) => api.post<{ hint: string; ocr_text: string }>("/whiteboard/hint", payload),

  runCode: (payload: { language: "python" | "javascript" | "c" | "cpp" | "java"; code: string; stdin?: string }) =>
    api.post<CodeRunResponse>("/code/run", payload),
};
