import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { type ChatMessage, useChatMessages } from "@/hooks/useChatMessages";
import { apiClient, type DocumentItem } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import {
  Loader2,
  MessageSquare,
  Send,
  StopCircle,
  Volume2,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function ChatPage() {
  const { currentLanguage } = useAppStore();
  const { messages, setAllMessages, addMessage, retranslateAll } = useChatMessages([]);
  const { play, stop, isPlaying, playingId, loadingId } = useAudioPlayer();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLangRef = useRef(currentLanguage?.id ?? "en");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await apiClient.listDocuments();
        setDocuments(response.data.documents);
        if (response.data.documents.length > 0) {
          setActiveDocumentId(response.data.documents[0].id);
        }
      } catch {
        toast.error("Failed to load documents for chat");
      }
    };

    loadDocuments();
  }, []);

  useEffect(() => {
    if (!activeDocumentId) {
      setAllMessages([]);
      return;
    }

    let isMounted = true;

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const response = await apiClient.getChatHistory(activeDocumentId);
        if (!isMounted) return;

        const history: ChatMessage[] = response.data.map((message, index) => ({
          id: `${activeDocumentId}-${index}-${message.created_at}`,
          role: message.role,
          content: message.content,
          originalContent: message.content,
          language: "en",
        }));

        setAllMessages(history);

        if ((currentLanguage?.id ?? "en") !== "en") {
          await retranslateAll(currentLanguage?.id ?? "en");
        }
      } catch {
        if (isMounted) {
          setAllMessages([]);
          toast.error("Failed to load chat history");
        }
      } finally {
        if (isMounted) {
          setHistoryLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      isMounted = false;
      stop();
    };
  }, [activeDocumentId, currentLanguage?.id, retranslateAll, setAllMessages, stop]);

  useEffect(() => {
    const nextLanguage = currentLanguage?.id ?? "en";
    if (prevLangRef.current !== nextLanguage) {
      prevLangRef.current = nextLanguage;
      retranslateAll(nextLanguage);
    }
  }, [currentLanguage?.id, retranslateAll]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    if (!activeDocumentId) {
      toast.error("Upload a note first before starting chat");
      return;
    }

    const content = input.trim();
    const messageId = `u-${Date.now()}`;

    addMessage({
      id: messageId,
      role: "user",
      content,
      originalContent: content,
      language: currentLanguage?.id ?? "en",
    });

    setInput("");
    setSending(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const response = await apiClient.chat({
        document_id: activeDocumentId,
        message: content,
        language: currentLanguage?.id ?? "en",
      });

      const assistantId = `a-${Date.now()}`;
      addMessage({
        id: assistantId,
        role: "assistant",
        content: response.data.answer,
        originalContent: response.data.answer,
        language: response.data.language || currentLanguage?.id || "en",
      });
    } catch {
      toast.error("Failed to send chat message");
    } finally {
      setSending(false);
    }
  }

  function handleTextareaChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col h-[calc(100vh-120px)] glass rounded-2xl overflow-hidden"
      data-ocid="chat.page"
    >
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[oklch(0.78_0.16_196)]/30 to-[oklch(0.60_0.20_264)]/30 flex items-center justify-center border border-white/10">
            <MessageSquare className="w-4 h-4 text-arcadia-teal" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">AI Tutor Chat</h1>
            <p className="text-xs text-muted-foreground">
              {currentLanguage?.flag} {currentLanguage?.name}
            </p>
          </div>
        </div>

        <select
          value={activeDocumentId}
          onChange={(event) => setActiveDocumentId(event.target.value)}
          className="arc-select bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-foreground max-w-[280px]"
        >
          {documents.length === 0 ? (
            <option value="">No documents uploaded</option>
          ) : (
            documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.original_name || document.filename}
              </option>
            ))
          )}
        </select>
      </div>

      <ScrollArea className="flex-1 px-6">
        <div className="py-4 flex flex-col gap-4">
          {historyLoading ? (
            <>
              <Skeleton className="h-10 w-56 rounded-2xl bg-white/10" />
              <Skeleton className="h-10 w-44 rounded-2xl bg-white/10 ml-auto" />
            </>
          ) : messages.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Start a conversation about your uploaded note.
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.isTranslating ? (
                  <Skeleton className="h-10 w-56 rounded-2xl bg-white/10" />
                ) : (
                  <div
                    className={`group relative max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-[oklch(0.78_0.16_196)]/50 to-[oklch(0.62_0.18_240)]/40 text-foreground"
                        : "glass-card text-foreground"
                    }`}
                  >
                    {message.content}
                    {message.role === "assistant" && (
                      <button
                        type="button"
                        onClick={() =>
                          playingId === message.id
                            ? stop()
                            : play(
                                message.content,
                                message.id,
                                currentLanguage?.id ?? "en",
                              )
                        }
                        className="absolute -right-8 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-arcadia-teal"
                        data-ocid={`chat.tts.${message.id}`}
                      >
                        {playingId === message.id && isPlaying ? (
                          <StopCircle className="w-4 h-4" />
                        ) : loadingId === message.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="glass-card rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-arcadia-teal animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-arcadia-teal animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-arcadia-teal animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-white/10 px-6 py-4 flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[oklch(0.78_0.16_196)] resize-none min-h-[40px] max-h-[120px] leading-relaxed"
          placeholder="Type a message…"
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          rows={1}
          data-ocid="chat.input"
        />
        <Button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan h-10 w-10 p-0 shrink-0"
          data-ocid="chat.send.button"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </motion.div>
  );
}
