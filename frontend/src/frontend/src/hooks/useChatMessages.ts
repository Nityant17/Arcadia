import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  originalContent: string;
  language: string;
  originalLanguage?: string;
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
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, message];
      messagesRef.current = next;
      return next;
    });
  }, []);

  const replaceMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => {
      const next = prev.map((msg) => (msg.id === id ? { ...msg, ...patch } : msg));
      messagesRef.current = next;
      return next;
    });
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

    setMessages((prev) => {
      let changed = false;
      const next = prev.map((msg) => {
        if (msg.role === "assistant" && msg.language !== targetLanguage && !msg.isTranslating) {
          changed = true;
          return { ...msg, isTranslating: true };
        }
        return msg;
      });

      if (!changed) {
        return prev;
      }

      messagesRef.current = next;
      return next;
    });

    for (const item of pending) {
      if (syncVersionRef.current !== version) {
        return;
      }

      const sourceText = item.originalContent?.trim().length
        ? item.originalContent
        : item.content;
      const sourceLanguage = item.originalLanguage || "en";

      if (sourceLanguage === targetLanguage) {
        setMessages((prev) => {
          const next = prev.map((msg) =>
            msg.id === item.id
              ? {
                  ...msg,
                  content: sourceText,
                  language: sourceLanguage,
                  isTranslating: false,
                }
              : msg,
          );
          messagesRef.current = next;
          return next;
        });
        continue;
      }

      try {
        const response = await apiClient.translate({
          text: sourceText,
          source_language: sourceLanguage,
          target_language: targetLanguage,
        });

        if (syncVersionRef.current !== version) {
          return;
        }

        setMessages((prev) => {
          const next = prev.map((msg) =>
            msg.id === item.id
              ? {
                  ...msg,
                  content: response.data.translated_text,
                  language: targetLanguage,
                  isTranslating: false,
                }
              : msg,
          );
          messagesRef.current = next;
          return next;
        });
      } catch {
        setMessages((prev) => {
          const next = prev.map((msg) =>
            msg.id === item.id ? { ...msg, isTranslating: false } : msg,
          );
          messagesRef.current = next;
          return next;
        });
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
