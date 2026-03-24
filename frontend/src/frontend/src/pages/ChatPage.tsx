import { Button } from "@/components/ui/button";
import { GlowingChatInput } from "@/components/ui/GlowingChatInput";
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
  RotateCcw,
  Volume2,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [clearing, setClearing] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevLangRef = useRef(currentLanguage?.id ?? "en");

  const refreshChatHistory = useCallback(
    async (documentId: string, shouldApply: () => boolean = () => true) => {
      setHistoryLoading(true);

      try {
        const response = await apiClient.getChatHistory(documentId);
        if (!shouldApply()) return;

        const history: ChatMessage[] = response.data.map((message, index) => ({
          id: `${documentId}-${index}-${message.created_at}`,
          role: message.role,
          content: message.content,
          originalContent: message.content,
          language: "en",
          originalLanguage: "en",
          sources: [],
        }));

        setAllMessages(history);

        const targetLanguage = currentLanguage?.id ?? "en";
        if (targetLanguage !== "en") {
          await retranslateAll(targetLanguage);
        }
      } catch {
        if (shouldApply()) {
          setAllMessages([]);
          toast.error("Failed to load chat history");
        }
      } finally {
        if (shouldApply()) {
          setHistoryLoading(false);
        }
      }
    },
    [currentLanguage?.id, retranslateAll, setAllMessages],
  );

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null;

    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: "smooth",
    });
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

    void refreshChatHistory(activeDocumentId, () => isMounted);

    return () => {
      isMounted = false;
      stop();
    };
  }, [activeDocumentId, refreshChatHistory, setAllMessages, stop]);

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
      originalLanguage: currentLanguage?.id ?? "en",
    });

    setInput("");
    setSending(true);

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
        originalLanguage: response.data.language || currentLanguage?.id || "en",
        sources: response.data.sources || [],
      });
    } catch {
      toast.error("Failed to send chat message");
    } finally {
      setSending(false);
    }
  }

  async function handleNewChat() {
    if (!activeDocumentId || clearing) return;

    setClearing(true);
    try {
      await apiClient.clearChatHistory(activeDocumentId);
      setAllMessages([]);
      stop();
      toast.success("Started a new chat");
    } catch {
      toast.error("Failed to clear chat history");
    } finally {
      setClearing(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex flex-col h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-3rem)] rounded-2xl border border-white/10 bg-slate-950/35 backdrop-blur-xl overflow-hidden"
      data-ocid="chat.page"
    >
      <div className="px-6 py-4 border-b border-white/10 flex items-start justify-between gap-4 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[oklch(0.78_0.16_196)]/30 to-[oklch(0.60_0.20_264)]/30 flex items-center justify-center border border-white/10">
              <MessageSquare className="w-4 h-4 text-arcadia-teal" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-foreground">AI Tutor Chat</h1>
              <p className="text-xs text-muted-foreground">
                {currentLanguage?.flag} {currentLanguage?.name}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              disabled={!activeDocumentId || historyLoading || clearing}
              className="ml-auto border-white/10 bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
              data-ocid="chat.new"
            >
              {clearing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              New Chat
            </Button>
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

      <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 px-6">
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 py-4 pb-8">
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
                        : "text-slate-300"
                    }`}
                  >
                    <div
                      className={`whitespace-pre-wrap break-words leading-relaxed ${
                        message.role === "assistant" ? "text-slate-300" : ""
                      }`}
                    >
                      {message.content}
                    </div>
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
        </div>
      </ScrollArea>

      <div className="px-6 pb-4 pt-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent border-t border-white/10 shrink-0">
        <div className="relative">
          {sending && (
            <div className="absolute -top-8 right-4 text-xs text-cyan-300 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
            </div>
          )}
          <GlowingChatInput
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onSubmit={handleSend}
          />
        </div>
      </div>
    </motion.div>
  );
}
