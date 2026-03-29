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
import {
  apiClient,
  getApiErrorMessage,
  type DocumentItem,
} from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import {
  FileText,
  Loader2,
  MessageSquare,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { toast } from "sonner";
import "katex/dist/katex.min.css";

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

function resolveCitationFromSource(source: string, index: number, documents: DocumentItem[]) {
  const normalized = source.trim();
  const matchedDocument = documents.find((item) => item.id === normalized);
  if (!matchedDocument) {
    return {
      ...parseCitation(source, index),
      sourceId: normalized,
      noteId: "",
    };
  }

  const labelText =
    matchedDocument.original_name ||
    matchedDocument.note_title ||
    matchedDocument.topic ||
    matchedDocument.filename;

  const previewParts = [
    matchedDocument.note_title || matchedDocument.topic || "Untitled note",
    matchedDocument.subject || "General",
  ].filter(Boolean);

  return {
    label: `[${index + 1}] ${labelText}`,
    preview: previewParts.join(" • "),
    sourceId: matchedDocument.id,
    noteId: matchedDocument.note_id || "",
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

async function extractTextFromPdfFile(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const bytes = new Uint8Array(await file.arrayBuffer());

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableWorker: true,
  } as Parameters<typeof pdfjs.getDocument>[0]);

  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pages.push(`Page ${pageNumber}: ${pageText}`);
    }
  }

  return pages.join("\n\n").trim();
}

export default function ChatPage() {
  const { currentLanguage } = useAppStore();
  const { messages, setAllMessages, addMessage, retranslateAll } = useChatMessages([]);
  const { play, stop, isPlaying, playingId, loadingId } = useAudioPlayer();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [input, setInput] = useState("");
  const [pendingAutoSendQuery, setPendingAutoSendQuery] = useState<string | null>(null);
  const [hasLoadedInitialHistory, setHasLoadedInitialHistory] = useState(false);
  const [localContextName, setLocalContextName] = useState("");
  const [localContextText, setLocalContextText] = useState("");
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [uploadingContext, setUploadingContext] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevLangRef = useRef(currentLanguage?.id ?? "en");

  const pendingQueryStorageKey = "arcadia:pending-chat-query";
  const pendingDocumentStorageKey = "arcadia:pending-chat-document-id";
  const activeDocument = documents.find(
    (document) => document.id === activeDocumentId || document.note_id === activeDocumentId,
  );
  const activeNoteId = activeDocument?.note_id || activeDocumentId;
  const noteOptions = useMemo(() => {
    const grouped = new Map<string, { noteId: string; label: string; documentId: string; count: number }>();
    for (const doc of documents) {
      const noteId = doc.note_id || doc.id;
      const existing = grouped.get(noteId);
      if (existing) {
        existing.count += 1;
        continue;
      }
      grouped.set(noteId, {
        noteId,
        label: doc.note_title || doc.topic || doc.original_name || doc.filename,
        documentId: doc.id,
        count: 1,
      });
    }
    return Array.from(grouped.values());
  }, [documents]);

  const openSourceNote = useCallback((sourceId: string, noteId: string) => {
    const resolvedNoteId =
      noteId ||
      documents.find((item) => item.id === sourceId)?.note_id ||
      "";

    if (!resolvedNoteId) {
      toast.error("Could not locate this source note");
      return;
    }

    window.location.assign(`/notes?noteId=${encodeURIComponent(resolvedNoteId)}`);
  }, [documents]);

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
      } catch (error) {
        if (shouldApply()) {
          setAllMessages([]);
          toast.error(getApiErrorMessage(error, "Failed to load chat history"));
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
        const nextDocuments = response.data.documents;
        setDocuments(nextDocuments);

        if (nextDocuments.length > 0) {
          const preferredDocumentId = window.sessionStorage.getItem(pendingDocumentStorageKey);
          const preferredExists = preferredDocumentId
            ? nextDocuments.some((document) => document.id === preferredDocumentId || document.note_id === preferredDocumentId)
            : false;

          setActiveDocumentId(preferredExists ? preferredDocumentId! : (nextDocuments[0].note_id || nextDocuments[0].id));
          window.sessionStorage.removeItem(pendingDocumentStorageKey);
        }
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Failed to load documents for chat"));
      }
    };

    loadDocuments();
  }, []);

  useEffect(() => {
    const pendingQuery = window.sessionStorage.getItem(pendingQueryStorageKey);
    if (!pendingQuery) return;

    setInput(pendingQuery);
    setPendingAutoSendQuery(pendingQuery);
    window.sessionStorage.removeItem(pendingQueryStorageKey);
  }, []);

  const sendMessage = useCallback(
    async (content: string, options: { clearInput?: boolean } = {}) => {
      const trimmedContent = content.trim();
      if (!trimmedContent || sending) return;
      if (!activeDocumentId) {
        toast.error("Upload a note first before starting chat");
        return;
      }

      const messageForModel = localContextText
        ? `Local context (${localContextName || "attached file"}):\n${localContextText}\n\nUser question:\n${trimmedContent}`
        : trimmedContent;

      const messageId = `u-${Date.now()}`;

      addMessage({
        id: messageId,
        role: "user",
        content: trimmedContent,
        originalContent: trimmedContent,
        language: currentLanguage?.id ?? "en",
        originalLanguage: currentLanguage?.id ?? "en",
      });

      if (options.clearInput !== false) {
        setInput("");
      }
      setSending(true);

      try {
        const response = await apiClient.chat({
          document_id: activeDocument?.id || activeDocumentId,
          note_id: activeNoteId,
          message: messageForModel,
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
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Failed to send chat message"));
      } finally {
        setSending(false);
      }
    },
    [activeDocument, activeDocumentId, activeNoteId, addMessage, currentLanguage?.id, localContextName, localContextText, sending],
  );

  useEffect(() => {
    if (!pendingAutoSendQuery || !activeDocumentId || sending || !hasLoadedInitialHistory) return;

    const queryToSend = pendingAutoSendQuery;
    setPendingAutoSendQuery(null);
    void sendMessage(queryToSend);
  }, [activeDocumentId, hasLoadedInitialHistory, pendingAutoSendQuery, sendMessage, sending]);

  useEffect(() => {
    if (!activeDocumentId) {
      setAllMessages([]);
      setHasLoadedInitialHistory(false);
      return;
    }

    let isMounted = true;
    setHasLoadedInitialHistory(false);

    void (async () => {
      await refreshChatHistory(activeNoteId || activeDocumentId, () => isMounted);
      if (isMounted) {
        setHasLoadedInitialHistory(true);
      }
    })();

    return () => {
      isMounted = false;
      stop();
    };
  }, [activeDocumentId, activeNoteId, refreshChatHistory, setAllMessages, stop]);

  useEffect(() => {
    const nextLanguage = currentLanguage?.id ?? "en";
    if (prevLangRef.current !== nextLanguage) {
      prevLangRef.current = nextLanguage;
      retranslateAll(nextLanguage);
    }
  }, [currentLanguage?.id, retranslateAll]);

  async function handleSend() {
    if (!input.trim()) return;
    await sendMessage(input);
  }

  const handleAttachContextFile = useCallback(
    async (file: File) => {
      if (uploadingContext) return;

      const isPdfFile = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

      setUploadingContext(true);
      try {
        let extractedText = "";

        if (isPdfFile) {
          extractedText = await extractTextFromPdfFile(file);
        } else {
          extractedText = (await file.text()).trim();
        }

        if (!extractedText) {
          const fallbackDetails = [
            `Attached file: ${file.name}`,
            `Type: ${file.type || "unknown"}`,
            `Size: ${Math.max(1, Math.round(file.size / 1024))} KB`,
            "Note: Could not extract readable text content in-browser for this format.",
          ];
          extractedText = fallbackDetails.join("\n");
          toast.warning("Attached with metadata only (no readable text extracted)");
        }

        const maxContextChars = 8000;
        setLocalContextName(file.name);
        setLocalContextText(extractedText.slice(0, maxContextChars));
        toast.success("Context attached to this chat only");
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Failed to process attached file"));
      } finally {
        setUploadingContext(false);
      }
    },
    [uploadingContext],
  );

  async function handleNewChat() {
    if (!activeDocumentId || clearing) return;

    setClearing(true);
    try {
      await apiClient.clearChatHistory(activeDocumentId);
      setAllMessages([]);
      stop();
      toast.success("Started a new chat");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to clear chat history"));
    } finally {
      setClearing(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex flex-col h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-3rem)] rounded-2xl border border-border/70 bg-card/85 dark:bg-slate-950/35 backdrop-blur-xl overflow-hidden"
      data-ocid="chat.page"
    >
      <div className="px-6 py-4 border-b border-border/70 dark:border-white/10 flex items-start justify-between gap-4 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[oklch(0.78_0.16_196)]/30 to-[oklch(0.60_0.20_264)]/30 flex items-center justify-center border border-border/70 dark:border-white/10">
              <MessageSquare className="w-4 h-4 text-arcadia-teal" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-foreground">AI Tutor Chat</h1>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              disabled={!activeDocumentId || historyLoading || clearing}
              className="ml-auto border-cyan-500/45 text-cyan-700 dark:text-cyan-300"
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
            {noteOptions.length === 0 ? (
              <div className="text-xs text-muted-foreground rounded-full border border-border/70 bg-muted/55 px-3 py-1.5">
                No source documents uploaded
              </div>
            ) : (
              noteOptions.map((note) => {
                const isActive = activeNoteId === note.noteId || activeDocumentId === note.noteId;
                return (
                  <button
                    key={note.noteId}
                    type="button"
                    onClick={() => setActiveDocumentId(note.noteId)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs border transition-all ${
                      isActive
                        ? "border-cyan-500/45 bg-cyan-500/12 text-cyan-700 dark:text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.18)]"
                        : "border-border/70 bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    data-ocid={`chat.document.${note.noteId}`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span className="max-w-[190px] truncate">
                      {note.label} ({note.count})
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
              <Skeleton className="h-10 w-56 rounded-2xl bg-muted/60" />
              <Skeleton className="h-10 w-44 rounded-2xl bg-muted/60 ml-auto" />
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
                  <Skeleton className="h-10 w-56 rounded-2xl bg-muted/60" />
                ) : (
                  <div
                    className={`group relative max-w-[74%] px-3 py-2 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "rounded-full border border-border/70 bg-muted/55 text-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none break-words text-foreground dark:prose-invert prose-headings:text-foreground prose-strong:text-foreground prose-a:text-cyan-700 dark:prose-a:text-cyan-300 prose-code:text-cyan-700 dark:prose-code:text-cyan-200">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap break-words leading-relaxed">
                        {message.content}
                      </div>
                    )}
                    {message.role === "assistant" && (message.sources?.length || 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.sources?.map((source, index) => {
                          const citation = resolveCitationFromSource(source, index, documents);
                          return (
                            <HoverCard key={`${message.id}-source-${index}`}>
                              <HoverCardTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => openSourceNote(citation.sourceId, citation.noteId)}
                                  className="rounded-full border border-border/70 bg-muted/45 px-2.5 py-1 text-[11px] text-cyan-700 dark:text-cyan-200 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all"
                                >
                                  {citation.label}
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80 border-border/70 bg-card/95 text-foreground backdrop-blur-xl">
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
                        className="absolute -right-10 top-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-full border border-border/70 bg-card/95 dark:bg-slate-950/70 p-1.5 text-muted-foreground hover:text-cyan-700 dark:hover:text-cyan-300 hover:border-cyan-500/40"
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

      <div className="px-6 pb-4 pt-4 bg-gradient-to-t from-card via-card/95 to-transparent border-t border-border/70 dark:border-white/10 shrink-0">
        <div className="relative">
          <div className="mb-2 min-h-5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2">
              {localContextText && (
                <div className="flex items-center gap-2 rounded-md border border-cyan-500/35 bg-cyan-500/12 px-2 py-1 text-xs text-cyan-700 dark:text-cyan-200 max-w-[75%]">
                  <span className="truncate">Using context: {localContextName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalContextName("");
                      setLocalContextText("");
                    }}
                    className="shrink-0 rounded border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-cyan-400/60 hover:text-cyan-700 dark:hover:text-cyan-100"
                  >
                    Clear
                  </button>
                </div>
              )}

              {uploadingContext && (
                <div className="text-xs text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading context...
                </div>
              )}
            </div>

            {sending && (
              <div className="text-xs text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5 shrink-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
              </div>
            )}
          </div>

          <GlowingChatInput
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onSubmit={handleSend}
            onAttach={handleAttachContextFile}
            attachDisabled={uploadingContext}
          />
        </div>
      </div>
    </motion.div>
  );
}
