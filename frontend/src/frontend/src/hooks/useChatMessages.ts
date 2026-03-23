import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  originalContent: string;
  language: string;
  isTranslating?: boolean;
  sources?: string[];
}

export function useChatMessages(initial: ChatMessage[] = []) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const syncVersionRef = useRef(0);
  const messagesRef = useRef<ChatMessage[]>(initial);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const setAllMessages = useCallback((next: ChatMessage[]) => {
    setMessages(next);
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const replaceMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, ...patch } : msg)));
  }, []);

  const retranslateAll = useCallback(async (targetLanguage: string) => {
    const version = Date.now();
    syncVersionRef.current = version;

    const snapshot = [...messagesRef.current];
    const pending = snapshot.filter(
      (msg) =>
        msg.role === "assistant" &&
        msg.content.trim().length > 0 &&
        msg.language !== targetLanguage,
    );

    if (pending.length === 0) {
      return;
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.role === "assistant" && msg.language !== targetLanguage
          ? { ...msg, isTranslating: true }
          : msg,
      ),
    );

    for (const item of pending) {
      if (syncVersionRef.current !== version) {
        return;
      }

      const sourceLanguage = item.language || "en";

      try {
        const response = await apiClient.translate({
          text: item.content,
          source_language: sourceLanguage,
          target_language: targetLanguage,
        });

        if (syncVersionRef.current !== version) {
          return;
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === item.id
              ? {
                  ...msg,
                  content: response.data.translated_text,
                  language: targetLanguage,
                  isTranslating: false,
                }
              : msg,
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === item.id ? { ...msg, isTranslating: false } : msg,
          ),
        );
      }
    }
  }, []);

  return {
    messages,
    setAllMessages,
    addMessage,
    replaceMessage,
    retranslateAll,
  };
}
