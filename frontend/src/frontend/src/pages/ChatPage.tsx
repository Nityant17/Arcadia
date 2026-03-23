import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { type ChatMessage, useChatMessages } from "@/hooks/useChatMessages";
import { apiClient, type DocumentItem } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import {
  FileText,
  Loader2,
  MessageSquare,
  Send,
  Volume2,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

function parseCitation(source: string, index: number) {
  const compact = source.trim();
  const [titlePart, ...rest] = compact.split(/\s+-\s+/);
  const title = titlePart || `Source ${index + 1}`;
  const pageLike = rest.find((item) => /page\s*\d+/i.test(item));
  return {
    label: `[${index + 1}] ${title}${pageLike ? ` - ${pageLike}` : ""}`,
    preview: compact,
  };
}

function WaveformIcon({ active }: { active: boolean }) {
  if (!active) {
    return <Volume2 className="w-4 h-4" />;
  }

  return (
    <span className="inline-flex items-end gap-[2px] h-4" aria-hidden>
      <span className="w-[2px] h-2 rounded-full bg-cyan-300 animate-pulse" />
      <span
        className="w-[2px] h-3 rounded-full bg-cyan-400 animate-pulse"
        style={{ animationDelay: "120ms" }}
      />
      <span
        className="w-[2px] h-2 rounded-full bg-cyan-300 animate-pulse"
        style={{ animationDelay: "240ms" }}
      />
      <span
        className="w-[2px] h-4 rounded-full bg-cyan-400 animate-pulse"
        style={{ animationDelay: "360ms" }}
      />
    </span>
  );
}

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
          sources: [],
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
        sources: response.data.sources || [],
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

  const hasInput = input.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex flex-col h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-3rem)] rounded-2xl border border-white/10 bg-slate-950/35 backdrop-blur-xl overflow-hidden"
      data-ocid="chat.page"
    >
      <div className="px-6 py-4 border-b border-white/10 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
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

          <div className="flex items-center gap-2 overflow-x-auto pr-2 pb-1">
            {documents.length === 0 ? (
              <div className="text-xs text-muted-foreground rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                No source documents uploaded
              </div>
            ) : (
              documents.map((document) => {
                const isActive = activeDocumentId === document.id;
                return (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => setActiveDocumentId(document.id)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs border transition-all ${
                      isActive
                        ? "border-cyan-500/40 bg-cyan-500/12 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.18)]"
                        : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
                    }`}
                    data-ocid={`chat.document.${document.id}`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span className="max-w-[190px] truncate">
                      {document.original_name || document.filename}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-6">
        <div className="py-4 pb-36 flex flex-col gap-4">
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
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24 }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.isTranslating ? (
                  <Skeleton className="h-10 w-56 rounded-2xl bg-white/10" />
                ) : (
                  <div
                    className={`group relative max-w-[74%] px-3 py-2 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "rounded-full border border-white/15 bg-white/6 text-foreground"
                        : "text-foreground"
                    }`}
                  >
                    <div>{message.content}</div>
                    {message.role === "assistant" && (message.sources?.length || 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.sources?.map((source, index) => {
                          const citation = parseCitation(source, index);
                          return (
                            <HoverCard key={`${message.id}-source-${index}`}>
                              <HoverCardTrigger asChild>
                                <button
                                  type="button"
                                  className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-cyan-200 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all"
                                >
                                  {citation.label}
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80 border-white/15 bg-slate-950/95 text-foreground backdrop-blur-xl">
                                <p className="text-xs leading-relaxed text-muted-foreground">{citation.preview}</p>
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })}
                      </div>
                    )}
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
                        className="absolute -right-10 top-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-full border border-white/10 bg-slate-950/70 p-1.5 text-muted-foreground hover:text-cyan-300 hover:border-cyan-500/40"
                        data-ocid={`chat.tts.${message.id}`}
                      >
                        {loadingId === message.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <WaveformIcon active={playingId === message.id && isPlaying} />
                        )}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ))
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-full border border-cyan-500/25 bg-cyan-500/8 shadow-[0_0_20px_rgba(6,182,212,0.2)] px-4 py-2.5 flex gap-1.5 items-center">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(860px,calc(100%-2rem))]">
        <div className="pointer-events-auto rounded-2xl border border-white/12 bg-slate-950/60 backdrop-blur-2xl px-4 py-3 focus-within:border-cyan-500/50 focus-within:shadow-[0_0_30px_rgba(6,182,212,0.2)] transition-all">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              className="flex-1 bg-transparent border-0 rounded-xl px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none min-h-[38px] max-h-[120px] leading-relaxed"
              placeholder="Ask Arcadia anything..."
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              rows={1}
              data-ocid="chat.input"
            />
            <motion.button
              type="button"
              onClick={handleSend}
              disabled={sending || !hasInput}
              animate={
                !sending && hasInput
                  ? {
                      boxShadow: [
                        "0 0 0 rgba(6,182,212,0)",
                        "0 0 16px rgba(6,182,212,0.35)",
                        "0 0 0 rgba(6,182,212,0)",
                      ],
                    }
                  : { boxShadow: "0 0 0 rgba(6,182,212,0)" }
              }
              transition={{ duration: 1.6, repeat: hasInput && !sending ? Number.POSITIVE_INFINITY : 0 }}
              className="h-10 w-10 shrink-0 rounded-xl border border-cyan-500/35 bg-cyan-500/20 text-cyan-100 disabled:opacity-45 disabled:cursor-not-allowed hover:bg-cyan-500/30 transition-all"
              data-ocid="chat.send.button"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : <Send className="w-4 h-4 mx-auto" />}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
