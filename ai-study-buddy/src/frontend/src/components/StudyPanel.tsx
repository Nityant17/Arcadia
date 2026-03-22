import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ArcadiaDocument, Flashcard, SupportedLanguages, UserSession } from "../lib/api";
import { extractTopics, generateCheatsheet, generateDiagram, generateFlashcards, getSupportedLanguages } from "../lib/api";

type Props = {
  session: UserSession;
  activeDocument: ArcadiaDocument | null;
};

export default function StudyPanel({ session, activeDocument }: Props) {
  const [activeTab, setActiveTab] = useState<"cheatsheet" | "flashcards" | "diagram">("cheatsheet");
  const [cheatsheet, setCheatsheet] = useState("");
  const [cheatsheetLoading, setCheatsheetLoading] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [diagram, setDiagram] = useState("");
  const [diagramSvg, setDiagramSvg] = useState("");
  const [diagramRenderError, setDiagramRenderError] = useState<string | null>(null);
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [language, setLanguage] = useState("en");
  const [topics, setTopics] = useState<string[]>([]);
  const [focusTopic, setFocusTopic] = useState("");
  const [supportedLanguages, setSupportedLanguages] = useState<SupportedLanguages>({ en: "English" });

  const runGenerateForTab = async () => {
    if (activeTab === "cheatsheet") {
      await loadCheatsheet();
      return;
    }
    if (activeTab === "flashcards") {
      await loadFlashcards();
      return;
    }
    await loadDiagram();
  };

  const generateButtonLabel =
    activeTab === "cheatsheet"
      ? "Generate cheatsheet"
      : activeTab === "flashcards"
        ? "Generate flashcards"
        : "Generate diagram";

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const langs = await getSupportedLanguages(session.token);
        setSupportedLanguages(langs);
      } catch {
        setSupportedLanguages({ en: "English", hi: "Hindi", es: "Spanish", fr: "French" });
      }
    };
    void loadLanguages();
  }, [session.token]);

  useEffect(() => {
    let mounted = true;

    const renderMermaid = async () => {
      if (!diagram.trim()) {
        setDiagramSvg("");
        setDiagramRenderError(null);
        return;
      }

      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "dark" });

        const id = `arcadia-diagram-${Date.now()}`;
        const { svg } = await mermaid.render(id, diagram);
        if (!mounted) return;
        setDiagramSvg(svg);
        setDiagramRenderError(null);
      } catch (error) {
        if (!mounted) return;
        setDiagramRenderError(String(error));
        setDiagramSvg("");
      }
    };

    void renderMermaid();

    return () => {
      mounted = false;
    };
  }, [diagram]);

  if (!activeDocument) {
    return <div className="text-sm text-muted-foreground">Select a document first.</div>;
  }

  const loadCheatsheet = async () => {
    setCheatsheetLoading(true);
    try {
      const data = await generateCheatsheet(session.token, {
        document_id: activeDocument.id,
        language,
        focus_topic: focusTopic,
      });
      setCheatsheet(data.content || "");
      setActiveTab("cheatsheet");
    } catch (e) {
      toast.error(`Cheatsheet failed: ${String(e)}`);
    } finally {
      setCheatsheetLoading(false);
    }
  };

  const loadFlashcards = async () => {
    setFlashcardsLoading(true);
    try {
      const data = await generateFlashcards(session.token, {
        document_id: activeDocument.id,
        language,
        focus_topic: focusTopic,
      });
      setFlashcards(data.cards || []);
      setActiveFlashcardIndex(0);
      setFlashcardFlipped(false);
      setActiveTab("flashcards");
    } catch (e) {
      toast.error(`Flashcards failed: ${String(e)}`);
    } finally {
      setFlashcardsLoading(false);
    }
  };

  const loadTopics = async () => {
    try {
      const data = await extractTopics(session.token, activeDocument.id);
      setTopics((data.topics ?? []).map((t: { title: string }) => t.title));
      toast.success("Topics extracted");
    } catch (e) {
      toast.error(`Topic extraction failed: ${String(e)}`);
    }
  };

  const loadDiagram = async () => {
    setDiagramLoading(true);
    try {
      const data = await generateDiagram(session.token, { document_id: activeDocument.id });
      setDiagram(data.mermaid_code || "");
      setActiveTab("diagram");
    } catch (e) {
      toast.error(`Diagram failed: ${String(e)}`);
    } finally {
      setDiagramLoading(false);
    }
  };

  const currentCard = flashcards[activeFlashcardIndex];

  return (
    <Card className="bento-card h-[calc(100vh-9.5rem)] overflow-auto border-white/15 bg-white/[0.04] text-white">
      <CardHeader>
        <CardTitle className="text-white">Study Materials</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4">
          <div className="space-y-3 rounded-xl border border-white/12 bg-white/[0.04] p-3 h-fit">
            <p className="text-xs uppercase tracking-wide text-white/60">Generation Controls</p>
            <select className="w-full rounded-lg px-2 py-2 text-sm bg-white/[0.08] border border-white/15 text-white" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {Object.entries(supportedLanguages).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <Button variant="outline" className="w-full border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={loadTopics}>Extract topics</Button>
            <select className="w-full rounded-lg px-2 py-2 text-sm bg-white/[0.08] border border-white/15 text-white" value={focusTopic} onChange={(e) => setFocusTopic(e.target.value)}>
              <option value="">All topics</option>
              {topics.map((topic) => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-xs uppercase tracking-wide text-white/55">Select output</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={activeTab === "cheatsheet" ? "default" : "outline"}
                  className={activeTab === "cheatsheet" ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-0" : "border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]"}
                  onClick={() => setActiveTab("cheatsheet")}
                >
                  Cheatsheet
                </Button>
                <Button
                  variant={activeTab === "flashcards" ? "default" : "outline"}
                  className={activeTab === "flashcards" ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-0" : "border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]"}
                  onClick={() => setActiveTab("flashcards")}
                >
                  Flashcards
                </Button>
                <Button
                  variant={activeTab === "diagram" ? "default" : "outline"}
                  className={activeTab === "diagram" ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-0" : "border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]"}
                  onClick={() => setActiveTab("diagram")}
                >
                  Diagram
                </Button>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-0"
                onClick={() => void runGenerateForTab()}
                disabled={cheatsheetLoading || flashcardsLoading || diagramLoading}
              >
                {generateButtonLabel}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="border-b border-white/10 pb-3">
              <p className="text-sm font-semibold text-white/90">{activeTab === "cheatsheet" ? "Cheatsheet" : activeTab === "flashcards" ? "Flashcards" : "Diagram"}</p>
              <p className="text-xs text-white/60 mt-1">Use the generate controls on the left to switch outputs.</p>
            </div>

            {activeTab === "cheatsheet" && (
              cheatsheetLoading ? (
                <div className="border border-white/15 bg-white/[0.06] rounded-lg p-4 text-sm text-white/65">Generating cheatsheet...</div>
              ) : cheatsheet ? (
                <ScrollArea className="h-[56vh] rounded-lg border border-white/15 bg-white/[0.06] p-4">
                  <div className="text-sm whitespace-pre-wrap leading-7">{cheatsheet}</div>
                </ScrollArea>
              ) : (
                <div className="border border-white/15 bg-white/[0.06] rounded-lg p-4 text-sm text-white/65">Generate a cheatsheet to view this tab.</div>
              )
            )}

            {activeTab === "flashcards" && (
              flashcardsLoading ? (
                <div className="border border-white/15 bg-white/[0.06] rounded-lg p-4 text-sm text-white/65">Generating flashcards...</div>
              ) : flashcards.length > 0 && currentCard ? (
                <div className="space-y-3">
                  <div className="text-sm text-white/65">Card {activeFlashcardIndex + 1} of {flashcards.length}</div>
                  <button
                    type="button"
                    onClick={() => setFlashcardFlipped((prev) => !prev)}
                    className="w-full text-left rounded-xl border border-white/15 bg-white/[0.08] p-6 min-h-[260px]"
                  >
                    <p className="text-xs text-white/60 mb-2">{flashcardFlipped ? "Back" : "Front"}</p>
                    <p className="text-lg leading-8 font-medium">{flashcardFlipped ? currentCard.back : currentCard.front}</p>
                  </button>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" disabled={activeFlashcardIndex === 0} onClick={() => { setActiveFlashcardIndex((i) => Math.max(0, i - 1)); setFlashcardFlipped(false); }}>Previous</Button>
                    <Button variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" disabled={activeFlashcardIndex >= flashcards.length - 1} onClick={() => { setActiveFlashcardIndex((i) => Math.min(flashcards.length - 1, i + 1)); setFlashcardFlipped(false); }}>Next</Button>
                    <Button variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={() => setFlashcardFlipped((prev) => !prev)}>Flip</Button>
                  </div>
                </div>
              ) : (
                <div className="border border-white/15 bg-white/[0.06] rounded-lg p-4 text-sm text-white/65">Generate flashcards to view this tab.</div>
              )
            )}

            {activeTab === "diagram" && (
              diagramLoading ? (
                <div className="border border-white/15 bg-white/[0.06] rounded-lg p-4 text-sm text-white/65">Generating diagram...</div>
              ) : diagram ? (
                <ScrollArea className="h-[56vh] rounded-lg border border-white/15 bg-white/[0.06] p-4">
                  {diagramSvg ? (
                    <div className="text-white" dangerouslySetInnerHTML={{ __html: diagramSvg }} />
                  ) : diagramRenderError ? (
                    <div className="space-y-2">
                      <p className="text-xs text-rose-300">Diagram render failed: {diagramRenderError}</p>
                      <pre className="text-xs whitespace-pre-wrap leading-6">{diagram}</pre>
                    </div>
                  ) : (
                    <p className="text-sm text-white/65">Rendering diagram...</p>
                  )}
                </ScrollArea>
              ) : (
                <div className="border border-white/15 bg-white/[0.06] rounded-lg p-4 text-sm text-white/65">Generate a diagram to view this tab.</div>
              )
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
