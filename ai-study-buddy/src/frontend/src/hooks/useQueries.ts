import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  chat,
  completeTask,
  getChatHistory,
  getDashboard,
  getDocuments,
  getPlanTasks,
} from "../lib/api";

export function useGetDocuments(token?: string) {
  return useQuery({
    queryKey: ["documents", token],
    queryFn: async () => {
      if (!token) return [];
      return getDocuments(token);
    },
    enabled: !!token,
  });
}

export function useGetMessages(token?: string, documentId?: string) {
  return useQuery({
    queryKey: ["messages", token, documentId],
    queryFn: async () => {
      if (!token || !documentId) return [];
      return getChatHistory(token, documentId);
    },
    enabled: !!token && !!documentId,
  });
}

export function useGetStudyProgress(token?: string) {
  return useQuery({
    queryKey: ["studyProgress"],
    queryFn: async () => {
      if (!token) return null;
      return getDashboard(token);
    },
    enabled: !!token,
  });
}

export function useGetPlanTasks(token?: string, userId?: string) {
  return useQuery({
    queryKey: ["planTasks", token, userId],
    queryFn: async () => {
      if (!token || !userId) return { tasks: [] };
      return getPlanTasks(token, userId);
    },
    enabled: !!token && !!userId,
  });
}

export function useAskQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      token,
      question,
      documentId,
      userId,
      language,
      documentIds,
      topic,
    }: {
      token: string;
      question: string;
      documentId: string;
      userId: string;
      language?: string;
      documentIds?: string[];
      topic?: string;
    }) => {
      return chat(token, {
        document_id: documentId,
        document_ids: documentIds,
        topic,
        message: question,
        user_id: userId,
        language: language ?? "en",
      });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["messages", vars.token, vars.documentId] });
      queryClient.invalidateQueries({ queryKey: ["studyProgress"] });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ token, taskId }: { token: string; taskId: string }) => completeTask(token, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planTasks"] });
    },
  });
}
