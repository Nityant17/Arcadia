import { api } from "@/services/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  originalContent?: string;
  isTranslating?: boolean;
}

export function useChatMessages(initialMessages: ChatMessage[] = []) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages.map((message) => ({
      ...message,
      originalContent: message.originalContent ?? message.content,
      isTranslating: false,
    })),
  );

  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((previous) => [
      ...previous,
      {
        ...message,
        originalContent: message.originalContent ?? message.content,
        isTranslating: false,
      },
    ]);
  }, []);

  const retranslateAll = useCallback(async (targetLanguage: string) => {
    const snapshot = messagesRef.current;
    if (snapshot.length === 0) {
      return;
    }

    if (!targetLanguage || targetLanguage === "en") {
      setMessages((previous) =>
        previous.map((message) => ({
          ...message,
          content: message.originalContent ?? message.content,
          isTranslating: false,
        })),
      );
      return;
    }

    setMessages((previous) =>
      previous.map((message) => ({ ...message, isTranslating: true })),
    );

    const translatedById: Record<string, string> = {};

    for (const message of snapshot) {
      const sourceText = message.originalContent ?? message.content;

      try {
        const response = await api.tts.translate({
          text: sourceText,
          target_language: targetLanguage,
        });

        translatedById[message.id] =
          response.data?.translated_text ?? sourceText;
      } catch {
        translatedById[message.id] = sourceText;
      }
    }

    setMessages((previous) =>
      previous.map((message) => ({
        ...message,
        content: translatedById[message.id] ?? message.content,
        isTranslating: false,
      })),
    );
  }, []);

  const resetMessages = useCallback((nextMessages: ChatMessage[] = []) => {
    setMessages(
      nextMessages.map((message) => ({
        ...message,
        originalContent: message.originalContent ?? message.content,
        isTranslating: false,
      })),
    );
  }, []);

  const handleTranslationError = useCallback(() => {
    toast.error("Failed to translate messages");
  }, []);

  return {
    messages,
    addMessage,
    setMessages,
    resetMessages,
    retranslateAll,
    handleTranslationError,
  };
}
