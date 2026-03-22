import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { apiClient, type DocumentItem } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { ChevronLeft, ChevronRight, Loader2, ScanText, StopCircle, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
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
  const { currentLanguage } = useAppStore();
  const { play, stop, loadingId, playingId, isPlaying } = useAudioPlayer();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [focusTopic, setFocusTopic] = useState("");
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topics, setTopics] = useState<Array<{ title: string; summary: string }>>([]);

  const [loading, setLoading] = useState(false);
  const [cheatsheetTitle, setCheatsheetTitle] = useState("");
  const [cheatsheetContent, setCheatsheetContent] = useState("");
  const [flashcards, setFlashcards] = useState<Array<{ front: string; back: string }>>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardRevealed, setFlashcardRevealed] = useState(false);
  const [diagram, setDiagram] = useState<{ title: string; mermaid_code: string } | null>(
    null,
  );
  const [diagramSvg, setDiagramSvg] = useState("");

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await apiClient.listDocuments();
        setDocuments(response.data.documents);
        if (response.data.documents.length > 0) {
          setDocumentId(response.data.documents[0].id);
        }
      } catch {
        toast.error("Failed to load documents for study generation");
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
        mermaid.initialize({ startOnLoad: false, theme: "dark" });
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, diagram.mermaid_code);
        setDiagramSvg(svg);
      } catch {
        toast.error("Failed to render diagram");
      }
    };

    renderDiagram();
  }, [diagram]);

  useEffect(() => {
    setFlashcardIndex(0);
    setFlashcardRevealed(false);
  }, [flashcards]);

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
        document_id: documentId,
        language: currentLanguage?.id ?? "en",
        focus_topic: focusTopic,
      });

      setCheatsheetTitle(response.data.title);
      setCheatsheetContent(response.data.content);
      toast.success("Cheatsheet generated");
    } catch {
      toast.error("Failed to generate cheatsheet");
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
        document_id: documentId,
        language: currentLanguage?.id ?? "en",
        focus_topic: focusTopic,
      });

      setFlashcards(response.data.cards);
      toast.success("Flashcards generated");
    } catch {
      toast.error("Failed to generate flashcards");
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
        document_id: documentId,
        language: currentLanguage?.id ?? "en",
        focus_topic: focusTopic,
      });

      setDiagram(response.data);
      toast.success("Diagram generated");
    } catch {
      toast.error("Failed to generate diagram");
    } finally {
      setLoading(false);
    }
  }

  async function extractTopics() {
    if (!documentId) {
      toast.error("Select a document first");
      return;
    }
    setTopicsLoading(true);
    try {
      const response = await apiClient.extractTopics(documentId);
      setTopics(response.data.topics);
      if (!focusTopic && response.data.topics.length > 0) {
        setFocusTopic(response.data.topics[0].title);
      }
      toast.success("Topics extracted");
    } catch {
      toast.error("Failed to extract topics");
    } finally {
      setTopicsLoading(false);
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
        <h1 className="text-2xl font-bold text-foreground">Study Workspace</h1>
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
            documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.original_name || document.filename}
              </option>
            ))
          )}
        </select>

        <input
          value={focusTopic}
          onChange={(event) => setFocusTopic(event.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
          placeholder="Focus topic (optional)"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="border-white/10"
          onClick={extractTopics}
          disabled={topicsLoading || !documentId}
        >
          {topicsLoading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <ScanText className="w-3.5 h-3.5 mr-1" />
          )}
          Extract Topics
        </Button>
        {topics.length > 0 && (
          <select
            value={focusTopic}
            onChange={(event) => setFocusTopic(event.target.value)}
            className="arc-select min-w-[240px] bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-foreground"
          >
            {topics.map((item) => (
              <option key={item.title} value={item.title}>
                {item.title}
              </option>
            ))}
          </select>
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Cheatsheets</h3>
            <Button
              variant="outline"
              className="border-white/10 gap-2"
              onClick={generateCheatsheet}
              disabled={loading}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Generate New
            </Button>
          </div>

          {cheatsheetHtml ? (
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
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-white/5 text-muted-foreground border-white/10">Markdown Rendered</Badge>
                </div>
                <div
                  className="space-y-2"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown content is escaped before conversion
                  dangerouslySetInnerHTML={{ __html: cheatsheetHtml }}
                />
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No cheatsheet generated yet.</div>
          )}
        </TabsContent>

        <TabsContent value="flashcards" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Flashcards</h3>
            <Button
              variant="outline"
              className="border-white/10 gap-2"
              onClick={generateFlashcards}
              disabled={loading}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Generate New
            </Button>
          </div>

          {flashcards.length > 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground text-center">
                {flashcardIndex + 1} / {flashcards.length}
              </div>
              <button
                type="button"
                onClick={() => setFlashcardRevealed((prev) => !prev)}
                className="w-full max-w-md mx-auto glass-card rounded-3xl p-8 min-h-[220px] flex flex-col items-center justify-center text-center border border-white/10"
              >
                <div className="text-4xl font-semibold text-foreground leading-snug">
                  {flashcardRevealed
                    ? flashcards[flashcardIndex]?.back
                    : flashcards[flashcardIndex]?.front}
                </div>
                <div className="text-xs text-muted-foreground mt-4">Tap to {flashcardRevealed ? "hide answer" : "reveal"}</div>
              </button>

              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  className="border-white/10 h-8 w-8 p-0"
                  onClick={() => {
                    setFlashcardIndex((prev) => (prev > 0 ? prev - 1 : prev));
                    setFlashcardRevealed(false);
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
                    setFlashcardRevealed(false);
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
            <div className="text-sm text-muted-foreground">No flashcards generated yet.</div>
          )}
        </TabsContent>

        <TabsContent value="diagrams" className="space-y-4">
          <Button
            variant="outline"
            className="border-white/10 gap-2"
            onClick={generateDiagram}
            disabled={loading}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Generate
            Diagram
          </Button>

          {diagram ? (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold text-foreground">{diagram.title}</h3>
              {diagramSvg ? (
                <div
                  className="w-full overflow-x-auto [&>svg]:max-w-full [&>svg]:mx-auto [&>svg]:block"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted mermaid rendering output
                  dangerouslySetInnerHTML={{ __html: diagramSvg }}
                />
              ) : (
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                  {diagram.mermaid_code}
                </pre>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No diagram generated yet.</div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
