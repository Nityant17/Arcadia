export type UserSession = {
  user_id: string;
  name: string;
  email: string;
  token: string;
};

export type ArcadiaDocument = {
  id: string;
  filename: string;
  original_name: string;
  subject: string;
  topic: string;
  chunk_count: number;
  extracted_text_preview: string;
  created_at: string;
};

export type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
  tier: number;
};

export type Flashcard = {
  front: string;
  back: string;
};

export type SupportedLanguages = Record<string, string>;

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

function jsonHeaders(token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function login(email: string, password: string): Promise<UserSession> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function register(name: string, email: string, password: string): Promise<UserSession> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ name, email, password }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function getDocuments(token: string): Promise<ArcadiaDocument[]> {
  const response = await fetch(`${API_BASE}/documents`, { headers: jsonHeaders(token) });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.documents ?? [];
}

export async function uploadDocument(
  token: string,
  payload: { file: File; subject: string; topic?: string },
): Promise<ArcadiaDocument> {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("subject", payload.subject || "General");
  form.append("topic", payload.topic || "");

  const response = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function deleteDocument(token: string, documentId: string) {
  const response = await fetch(`${API_BASE}/documents/${documentId}`, {
    method: "DELETE",
    headers: jsonHeaders(token),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function chat(token: string, payload: { document_id: string; message: string; topic?: string; document_ids?: string[]; user_id?: string; language?: string; }) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function getChatHistory(token: string, documentId: string) {
  const response = await fetch(`${API_BASE}/chat/history/${documentId}`, { headers: jsonHeaders(token) });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function getDashboard(token: string) {
  const response = await fetch(`${API_BASE}/dashboard/stats`, { headers: jsonHeaders(token) });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function resetProgress(token: string) {
  const response = await fetch(`${API_BASE}/dashboard/reset`, {
    method: "DELETE",
    headers: jsonHeaders(token),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function getSupportedLanguages(token: string): Promise<SupportedLanguages> {
  const response = await fetch(`${API_BASE}/languages`, { headers: jsonHeaders(token) });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function textToSpeech(token: string, payload: { text: string; language?: string }) {
  const response = await fetch(`${API_BASE}/tts`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ text: payload.text, language: payload.language ?? "en" }),
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json() as { audio_url: string; language: string };
  const normalizedUrl = data.audio_url.startsWith("http")
    ? data.audio_url
    : `${window.location.origin}${data.audio_url}`;
  return { ...data, audio_url: normalizedUrl };
}

export async function translateText(
  token: string,
  payload: { text: string; target_language: string; source_language?: string },
) {
  const response = await fetch(`${API_BASE}/translate`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({
      text: payload.text,
      target_language: payload.target_language,
      source_language: payload.source_language ?? "en",
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{ translated_text: string }>;
}

export async function getPlanTasks(token: string, userId: string) {
  const response = await fetch(`${API_BASE}/planner/tasks?user_id=${encodeURIComponent(userId)}`, {
    headers: jsonHeaders(token),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function completeTask(token: string, taskId: string) {
  const response = await fetch(`${API_BASE}/planner/tasks/${taskId}/complete`, {
    method: "POST",
    headers: jsonHeaders(token),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function extractTopics(token: string, documentId: string) {
  const response = await fetch(`${API_BASE}/documents/${documentId}/topics`, {
    method: "POST",
    headers: jsonHeaders(token),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function generateQuiz(
  token: string,
  payload: { document_id: string; tier: number; num_questions: number; language?: string; focus_topic?: string },
) {
  const response = await fetch(`${API_BASE}/quiz/generate`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function submitQuiz(
  token: string,
  payload: { quiz_id: string; document_id: string; answers: Array<{ question_id: number; selected_option: number }>; user_id?: string },
) {
  const response = await fetch(`${API_BASE}/quiz/submit`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function generateCheatsheet(
  token: string,
  payload: { document_id: string; language?: string; focus_topic?: string },
) {
  const response = await fetch(`${API_BASE}/generate/cheatsheet`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function generateFlashcards(
  token: string,
  payload: { document_id: string; language?: string; focus_topic?: string },
) {
  const response = await fetch(`${API_BASE}/generate/flashcards`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function generateDiagram(token: string, payload: { document_id: string }) {
  const response = await fetch(`${API_BASE}/generate/diagram`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function createPlan(
  token: string,
  payload: { user_id: string; title: string; subjects: Array<{ subject: string; exam_date: string; weekly_hours: number }> },
) {
  const response = await fetch(`${API_BASE}/planner/create`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function createChallengeRoom(
  token: string,
  payload: { document_id: string; tier: number; num_questions: number; language?: string; focus_topic?: string },
) {
  const response = await fetch(`${API_BASE}/challenge/create`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function joinChallengeRoom(token: string, code: string) {
  const response = await fetch(`${API_BASE}/challenge/join`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function getChallengeRoom(token: string, code: string) {
  const response = await fetch(`${API_BASE}/challenge/${code}`, {
    headers: jsonHeaders(token),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function startChallengeRoom(token: string, code: string) {
  const response = await fetch(`${API_BASE}/challenge/${code}/start`, {
    method: "POST",
    headers: jsonHeaders(token),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function submitChallenge(
  token: string,
  code: string,
  answers: Array<{ question_id: number; selected_option: number }>,
) {
  const response = await fetch(`${API_BASE}/challenge/${code}/submit`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function whiteboardHint(
  token: string,
  payload: { image_base64: string; question: string; topic?: string },
) {
  const response = await fetch(`${API_BASE}/whiteboard/hint`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
