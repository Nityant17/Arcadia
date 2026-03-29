import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flashcard } from "@/components/ui/Flashcard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { buildPinnedFlashcardId, getPinnedFlashcards, togglePinnedFlashcard } from "@/lib/pinnedFlashcards";
import { apiClient, getApiErrorMessage, type DocumentItem } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { ChevronLeft, ChevronRight, Loader2, Sparkles, StopCircle, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inlineMarkdownToHtml(text: string) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-white/10 text-foreground">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function markdownToHtml(markdown: string) {
  const lines = markdown.split("\n");
  const html: string[] = [];
  let listMode: "ul" | "ol" | null = null;

  const closeList = () => {
    if (!listMode) return;
    html.push(listMode === "ul" ? "</ul>" : "</ol>");
    listMode = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3 class="text-base font-semibold text-foreground mt-4 mb-2">${inlineMarkdownToHtml(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2 class="text-lg font-semibold text-foreground mt-4 mb-2">${inlineMarkdownToHtml(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1 class="text-xl font-bold text-foreground mt-2 mb-2">${inlineMarkdownToHtml(line.slice(2))}</h1>`);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (listMode !== "ol") {
        closeList();
        html.push('<ol class="list-decimal pl-5 space-y-1 text-sm text-foreground/90">');
        listMode = "ol";
      }
      html.push(`<li>${inlineMarkdownToHtml(orderedMatch[1])}</li>`);
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (listMode !== "ul") {
        closeList();
        html.push('<ul class="list-disc pl-5 space-y-1 text-sm text-foreground/90">');
        listMode = "ul";
      }
      html.push(`<li>${inlineMarkdownToHtml(line.slice(2))}</li>`);
      continue;
    }

    closeList();
    html.push(`<p class="text-sm text-muted-foreground leading-relaxed">${inlineMarkdownToHtml(line)}</p>`);
  }

  closeList();
  return html.join("");
}

export default function StudyPage() {
  const { currentLanguage, currentUser } = useAppStore();
  const { resolvedTheme } = useTheme();
  const { play, stop, loadingId, playingId, isPlaying } = useAudioPlayer();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentId, setDocumentId] = useState("");
  const selectedDocument = documents.find((doc) => doc.id === documentId || doc.note_id === documentId);
  const selectedNoteId = selectedDocument?.note_id || documentId;
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
  const [focusTopic, setFocusTopic] = useState("");
  const [debouncedFocusTopic, setDebouncedFocusTopic] = useState("");
  const [topics, setTopics] = useState<Array<{ title: string; summary: string }>>([]);

  const [loading, setLoading] = useState(false);
  const [cheatsheetTitle, setCheatsheetTitle] = useState("");
  const [cheatsheetContent, setCheatsheetContent] = useState("");
  const [flashcards, setFlashcards] = useState<Array<{ front: string; back: string }>>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [pinnedFlashcards, setPinnedFlashcards] = useState<Set<string>>(new Set());
  const [diagram, setDiagram] = useState<{ title: string; mermaid_code: string } | null>(
    null,
  );
  const [diagramSvg, setDiagramSvg] = useState("");
  const [diagramScale, setDiagramScale] = useState(1);
  const [diagramOffset, setDiagramOffset] = useState({ x: 0, y: 0 });
  const diagramPanRef = useRef({ x: 0, y: 0, startX: 0, startY: 0, panning: false });
  const [restoringMaterials, setRestoringMaterials] = useState(false);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await apiClient.listDocuments();
        setDocuments(response.data.documents);
        // Check sessionStorage for pending-study-document-id
        const pendingId = window.sessionStorage.getItem("arcadia:pending-study-document-id");
        if (pendingId && response.data.documents.some((doc: any) => doc.id === pendingId || doc.note_id === pendingId)) {
          setDocumentId(pendingId);
          window.sessionStorage.removeItem("arcadia:pending-study-document-id");
        } else if (response.data.documents.length > 0) {
          setDocumentId(response.data.documents[0].note_id || response.data.documents[0].id);
        }
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Failed to load documents for study generation"));
      }
    };
    loadDocuments();
  }, []);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!diagram?.mermaid_code) {
        setDiagramSvg("");
        return;
      }

      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === "light" ? "default" : "dark",
        });
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, diagram.mermaid_code);
        setDiagramSvg(svg);
        setDiagramScale(1);
        setDiagramOffset({ x: 0, y: 0 });
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Failed to render diagram"));
      }
    };

    renderDiagram();
  }, [diagram, resolvedTheme]);

  useEffect(() => {
    setFlashcardIndex(0);
  }, [flashcards]);

  function handleDiagramWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    const factor = direction > 0 ? 1.1 : 0.9;
    setDiagramScale((prev) => Math.min(3, Math.max(0.5, prev * factor)));
  }

  function handleDiagramPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    diagramPanRef.current = {
      panning: true,
      startX: event.clientX,
      startY: event.clientY,
      x: diagramOffset.x,
      y: diagramOffset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDiagramPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!diagramPanRef.current.panning) return;
    const dx = event.clientX - diagramPanRef.current.startX;
    const dy = event.clientY - diagramPanRef.current.startY;
    setDiagramOffset({
      x: diagramPanRef.current.x + dx,
      y: diagramPanRef.current.y + dy,
    });
  }

  function handleDiagramPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    diagramPanRef.current.panning = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  useEffect(() => {
    if (!selectedNoteId || flashcards.length === 0) {
      setPinnedFlashcards(new Set());
      return;
    }

    const saved = getPinnedFlashcards(currentUser?.id);
    const ids = new Set(
      saved
        .filter((item) => item.documentId === selectedNoteId)
        .map((item) => item.id),
    );
    setPinnedFlashcards(ids);
  }, [selectedNoteId, flashcards, currentUser?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFocusTopic(focusTopic);
    }, 300);
    return () => clearTimeout(timer);
  }, [focusTopic]);

  useEffect(() => {
    const loadTopics = async () => {
      if (!documentId) {
        setTopics([]);
        return;
      }

      try {
        const contextDocId = selectedNoteId || selectedDocument?.id || documentId;
        const response = await apiClient.extractTopics(contextDocId);
        setTopics(response.data.topics);
      } catch {
        setTopics([]);
      }
    };

    void loadTopics();
  }, [documentId, selectedDocument?.id, selectedNoteId]);

  useEffect(() => {
    const loadStored = async () => {
      if (!documentId) return;

      setRestoringMaterials(true);
      setCheatsheetTitle("");
      setCheatsheetContent("");
      setFlashcards([]);
      setDiagram(null);

      try {
        const response = await apiClient.getStoredStudyMaterials({
          document_id: selectedDocument?.id || documentId,
          note_id: selectedNoteId,
          language: currentLanguage?.id ?? "en",
          focus_topic: debouncedFocusTopic,
        });

        if (response.data.cheatsheet) {
          setCheatsheetTitle(response.data.cheatsheet.title || "Generated Cheatsheet");
          setCheatsheetContent(response.data.cheatsheet.content || "");
        }
        if (response.data.flashcards) {
          setFlashcards(response.data.flashcards.cards || []);
        }
        if (response.data.diagram) {
          setDiagram({
            title: response.data.diagram.title,
            mermaid_code: response.data.diagram.mermaid_code,
          });
        }
      } catch {
        // Keep clean defaults when no cache is available or request fails.
      } finally {
        setRestoringMaterials(false);
      }
    };

    void loadStored();
  }, [documentId, selectedDocument?.id, selectedNoteId, currentLanguage?.id, debouncedFocusTopic]);

  const cheatsheetHtml = useMemo(() => {
    if (!cheatsheetContent.trim()) return "";
    return markdownToHtml(cheatsheetContent);
  }, [cheatsheetContent]);

  async function generateCheatsheet() {
    if (!documentId) {
      toast.error("Select a document first");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.generateCheatsheet({
        document_id: selectedDocument?.id || documentId,
        note_id: selectedNoteId,
        language: currentLanguage?.id ?? "en",
        focus_topic: focusTopic,
      }, true);

      setCheatsheetTitle(response.data.title);
      setCheatsheetContent(response.data.content);
      toast.success("Cheatsheet generated");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to generate cheatsheet"));
    } finally {
      setLoading(false);
    }
  }

  async function generateFlashcards() {
    if (!documentId) {
      toast.error("Select a document first");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.generateFlashcards({
        document_id: selectedDocument?.id || documentId,
        note_id: selectedNoteId,
        language: currentLanguage?.id ?? "en",
        focus_topic: focusTopic,
      }, true);

      setFlashcards(response.data.cards);
      toast.success("Flashcards generated");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to generate flashcards"));
    } finally {
      setLoading(false);
    }
  }

  async function generateDiagram() {
    if (!documentId) {
      toast.error("Select a document first");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.generateDiagram({
        document_id: selectedDocument?.id || documentId,
        note_id: selectedNoteId,
        language: currentLanguage?.id ?? "en",
        focus_topic: focusTopic,
      }, true);

      setDiagram(response.data);
      toast.success("Diagram generated");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to generate diagram"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      data-ocid="study.page"
      className="space-y-4"
    >
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">Study Workspace</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {currentLanguage?.flag} {currentLanguage?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <select
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value)}
          className="arc-select w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-foreground"
        >
          {documents.length === 0 ? (
            <option value="">No documents uploaded</option>
          ) : (
            noteOptions.map((note) => (
              <option key={note.noteId} value={note.noteId}>
                {note.label} · {note.count} file{note.count > 1 ? "s" : ""}
              </option>
            ))
          )}
        </select>

        {topics.length > 0 ? (
          <select
            value={focusTopic}
            onChange={(event) => setFocusTopic(event.target.value)}
            className="arc-select w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-foreground"
          >
            <option value="">All topics (entire note)</option>
            {topics.map((item) => (
              <option key={item.title} value={item.title}>
                {item.title}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={focusTopic}
            onChange={(event) => setFocusTopic(event.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
            placeholder="Focus topic (optional)"
          />
        )}
      </div>

      <Tabs defaultValue="cheatsheets">
        <TabsList className="bg-white/5 border border-white/10 mb-6">
          <TabsTrigger value="cheatsheets" className="data-[state=active]:bg-white/10">
            Cheatsheet
          </TabsTrigger>
          <TabsTrigger value="flashcards" className="data-[state=active]:bg-white/10">
            Flashcards
          </TabsTrigger>
          <TabsTrigger value="diagrams" className="data-[state=active]:bg-white/10">
            Diagram
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cheatsheets" className="space-y-4">
          <Button
            variant="outline"
            className="border-white/10 gap-2 sparkle-generate-button text-foreground"
            onClick={generateCheatsheet}
            disabled={loading}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Generate Cheatsheet
          </Button>

          {restoringMaterials && !cheatsheetHtml ? (
            <div className="text-sm text-muted-foreground">Loading saved cheatsheet...</div>
          ) : cheatsheetHtml ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground">{cheatsheetTitle || "Generated Cheatsheet"}</h4>
                <button
                  type="button"
                  onClick={() =>
                    playingId === "cheatsheet"
                      ? stop()
                      : play(
                          cheatsheetContent,
                          "cheatsheet",
                          currentLanguage?.id ?? "en",
                        )
                  }
                  className="text-muted-foreground hover:text-arcadia-teal"
                >
                  {playingId === "cheatsheet" && isPlaying ? (
                    <StopCircle className="w-4 h-4" />
                  ) : loadingId === "cheatsheet" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="rounded-2xl bg-slate-950/40 backdrop-blur-xl border border-white/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-white/5 text-muted-foreground border-white/10">Markdown Rendered</Badge>
                </div>
                <div
                  className="chat-multilingual-text space-y-2"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown content is escaped before conversion
                  dangerouslySetInnerHTML={{ __html: cheatsheetHtml }}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/20 bg-slate-950/40 p-6 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-2 h-5 w-5 text-cyan-300/60 drop-shadow-[0_0_14px_rgba(6,182,212,0.3)]" />
              No cheatsheet generated yet.
            </div>
          )}
        </TabsContent>

        <TabsContent value="flashcards" className="space-y-4">
          <Button
            variant="outline"
            className="border-white/10 gap-2 sparkle-generate-button text-foreground"
            onClick={generateFlashcards}
            disabled={loading}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Generate Flashcards
          </Button>

          {restoringMaterials && flashcards.length === 0 ? (
            <div className="text-sm text-muted-foreground">Loading saved flashcards...</div>
          ) : flashcards.length > 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground text-center">
                {flashcardIndex + 1} / {flashcards.length}
              </div>
              <div className="w-full flex justify-center">
                <Flashcard
                  question={flashcards[flashcardIndex]?.front ?? ""}
                  answer={flashcards[flashcardIndex]?.back ?? ""}
                  isPinned={pinnedFlashcards.has(
                    buildPinnedFlashcardId(
                      selectedNoteId,
                      flashcards[flashcardIndex]?.front ?? "",
                      flashcards[flashcardIndex]?.back ?? "",
                    ),
                  )}
                  onPin={() => {
                    const activeCard = flashcards[flashcardIndex];
                    if (!activeCard || !selectedNoteId) return;

                    const id = buildPinnedFlashcardId(
                      selectedNoteId,
                      activeCard.front,
                      activeCard.back,
                    );
                    const isNowPinned = togglePinnedFlashcard({
                      id,
                      documentId: selectedNoteId,
                      question: activeCard.front,
                      answer: activeCard.back,
                      language: currentLanguage?.id ?? "en",
                      createdAt: Date.now(),
                    }, currentUser?.id);

                    setPinnedFlashcards((previous) => {
                      const updated = new Set(previous);
                      if (isNowPinned) {
                        updated.add(id);
                      } else {
                        updated.delete(id);
                      }
                      return updated;
                    });
                  }}
                />
              </div>

              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  className="border-white/10 h-8 w-8 p-0"
                  onClick={() => {
                    setFlashcardIndex((prev) => (prev > 0 ? prev - 1 : prev));
                  }}
                  disabled={flashcardIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  className="border-white/10 h-8 w-8 p-0"
                  onClick={() => {
                    setFlashcardIndex((prev) =>
                      prev < flashcards.length - 1 ? prev + 1 : prev,
                    );
                  }}
                  disabled={flashcardIndex >= flashcards.length - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <button
                  type="button"
                  onClick={() =>
                    playingId === `flashcard-${flashcardIndex}`
                      ? stop()
                      : play(
                          `${flashcards[flashcardIndex]?.front}. ${flashcards[flashcardIndex]?.back}`,
                          `flashcard-${flashcardIndex}`,
                          currentLanguage?.id ?? "en",
                        )
                  }
                  className="text-muted-foreground hover:text-arcadia-teal ml-2"
                >
                  {playingId === `flashcard-${flashcardIndex}` && isPlaying ? (
                    <StopCircle className="w-4 h-4" />
                  ) : loadingId === `flashcard-${flashcardIndex}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/20 bg-slate-950/40 p-6 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-2 h-5 w-5 text-cyan-300/60 drop-shadow-[0_0_14px_rgba(6,182,212,0.3)]" />
              No flashcards generated yet.
            </div>
          )}
        </TabsContent>

        <TabsContent value="diagrams" className="space-y-4">
          <Button
            variant="outline"
            className="border-white/10 gap-2 sparkle-generate-button text-foreground"
            onClick={generateDiagram}
            disabled={loading}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Generate
            Diagram
          </Button>

          {restoringMaterials && !diagram ? (
            <div className="text-sm text-muted-foreground">Loading saved diagram...</div>
          ) : diagram ? (
            <div className="rounded-2xl bg-slate-950/40 backdrop-blur-xl border border-white/10 p-5 space-y-3">
              <h3 className="font-semibold text-foreground">{diagram.title}</h3>
              {diagramSvg ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Scroll to zoom · Drag to pan</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 h-7 px-2 text-xs"
                        onClick={() => setDiagramScale((prev) => Math.min(3, prev * 1.1))}
                      >
                        Zoom In
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 h-7 px-2 text-xs"
                        onClick={() => setDiagramScale((prev) => Math.max(0.5, prev * 0.9))}
                      >
                        Zoom Out
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 h-7 px-2 text-xs"
                        onClick={() => {
                          setDiagramScale(1);
                          setDiagramOffset({ x: 0, y: 0 });
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                  <div
                    className="relative h-[320px] w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/30 cursor-grab"
                    onWheel={handleDiagramWheel}
                    onPointerDown={handleDiagramPointerDown}
                    onPointerMove={handleDiagramPointerMove}
                    onPointerUp={handleDiagramPointerUp}
                    onPointerLeave={handleDiagramPointerUp}
                  >
                    <div
                      className="[&>svg]:block [&>svg]:max-w-none"
                      style={{
                        transform: `translate(${diagramOffset.x}px, ${diagramOffset.y}px) scale(${diagramScale})`,
                        transformOrigin: "0 0",
                      }}
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted mermaid rendering output
                      dangerouslySetInnerHTML={{ __html: diagramSvg }}
                    />
                  </div>
                </div>
              ) : (
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                  {diagram.mermaid_code}
                </pre>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/20 bg-slate-950/40 p-6 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-2 h-5 w-5 text-cyan-300/60 drop-shadow-[0_0_14px_rgba(6,182,212,0.3)]" />
              No diagram generated yet.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
