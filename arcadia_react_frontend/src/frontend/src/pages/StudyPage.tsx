import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store/useAppStore";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MOCK_CHEATSHEETS = [
  {
    id: "te",
    title: "\u3066-Form Conjugation",
    level: "N4",
    rules: [
      "Group 1 (\u3046-verbs): \u304b\u304d\u304c\u306b\u3073\u307f\u308a \u2192 \u3044\u3066/\u3044\u3067",
      "Group 2 (\u308b-verbs): Remove \u308b + \u3066",
      "Irregular: \u3059\u308b\u2192\u3057\u3066, \u304f\u308b\u2192\u304d\u3066",
      "Used to chain actions",
    ],
  },
  {
    id: "cond",
    title: "Conditional Forms",
    level: "N3",
    rules: [
      "\u301c\u305f\u3089: specific hypothetical events",
      "\u301c\u3070: general conditions, wishes",
      "\u301c\u306a\u3089: condition based on info",
      "\u301c\u3068: natural/inevitable consequences",
    ],
  },
  {
    id: "honorific",
    title: "Honorific Speech (Keigo)",
    level: "N3",
    rules: [
      "Sonkeigo: elevates the subject's action",
      "Kenjougo: humbles the speaker's action",
      "Teineigo: general polite speech",
      "\u304a~\u306b\u306a\u308b = honorific ~\u3059\u308b",
    ],
  },
  {
    id: "kanji",
    title: "N3 Core Kanji",
    level: "N3",
    rules: [
      "\u6a5f\u4f1a opportunity",
      "\u7d4c\u9a13 experience",
      "\u611f\u8b1d gratitude",
      "\u6280\u8853 technology",
      "\u793e\u4f1a society",
    ],
  },
];

const MOCK_FLASHCARDS = [
  {
    front: "\u98f2\u3080",
    back: "To drink",
    example: "\u6c34\u3092\u98f2\u307f\u307e\u3059 (I drink water)",
  },
  {
    front: "\u6a5f\u4f1a",
    back: "Opportunity / Chance",
    example: "\u6a5f\u4f1a\u3092\u3064\u304b\u3080 (seize the opportunity)",
  },
  {
    front: "\u611f\u8b1d",
    back: "Gratitude",
    example: "\u611f\u8b1d\u3059\u308b (to be grateful)",
  },
  {
    front: "\u7d4c\u9a13",
    back: "Experience",
    example: "\u7d4c\u9a13\u304c\u3042\u308b (to have experience)",
  },
  {
    front: "\u6280\u8853",
    back: "Technology / Skill",
    example: "\u6280\u8853\u8005 (technician)",
  },
  {
    front: "\u793e\u4f1a",
    back: "Society",
    example: "\u793e\u4f1a\u4eba (member of society)",
  },
  {
    front: "\u5927\u5207",
    back: "Important / Precious",
    example: "\u5927\u5207\u306a\u4eba (an important person)",
  },
  {
    front: "\u8a00\u8449",
    back: "Words / Language",
    example: "\u8a00\u8449\u3092\u5c55\u958b\u3059\u308b",
  },
];

const DIAGRAMS = [
  {
    id: "verb",
    label: "Verb Groups",
    code: "flowchart TD\n    V[Japanese Verb] --> G1[Group 1: U-verbs]\n    V --> G2[Group 2: RU-verbs]\n    V --> G3[Group 3: Irregular]\n    G1 --> T1[Te-form: ~ite/~ide]\n    G2 --> T2[Te-form: ~te]\n    G3 --> T3[suru to shite, kuru to kite]",
  },
  {
    id: "keigo",
    label: "Keigo Levels",
    code: "flowchart LR\n    Speech --> Sonkeigo\n    Speech --> Kenjougo\n    Speech --> Teineigo\n    Sonkeigo --> S1[Elevates subject]\n    Kenjougo --> K1[Humbles speaker]\n    Teineigo --> T1[General polite masu/desu]",
  },
  {
    id: "study",
    label: "Study Plan",
    code: "sequenceDiagram\n    participant L as Learner\n    participant T as Tutor\n    L->>T: Select topic\n    T-->>L: Generate cheatsheet\n    L->>T: Request quiz\n    T-->>L: Adaptive questions\n    L->>T: Review results\n    T-->>L: Recommendations",
  },
];

function FlashcardDeck() {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = MOCK_FLASHCARDS[idx];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-sm text-muted-foreground">
        {idx + 1} / {MOCK_FLASHCARDS.length}
      </div>
      <button
        type="button"
        className="flashcard-scene w-full max-w-sm h-52 cursor-pointer focus:outline-none"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show front" : "Flip to see answer"}
      >
        <div
          className={`flashcard relative w-full h-full ${flipped ? "flipped" : ""}`}
        >
          <div className="flashcard-front glass rounded-3xl flex flex-col items-center justify-center p-8">
            <span className="text-5xl font-bold text-foreground mb-3">
              {card.front}
            </span>
            <span className="text-xs text-muted-foreground">Tap to reveal</span>
          </div>
          <div className="flashcard-back glass-card rounded-3xl flex flex-col items-center justify-center p-8 text-center">
            <span className="text-2xl font-bold text-arcadia-teal mb-2">
              {card.back}
            </span>
            <span className="text-sm text-muted-foreground italic">
              {card.example}
            </span>
          </div>
        </div>
      </button>
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="border-white/10"
          onClick={() => {
            setIdx((i) => Math.max(0, i - 1));
            setFlipped(false);
          }}
          disabled={idx === 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          className="border-white/10"
          onClick={() => {
            setIdx((i) => Math.min(MOCK_FLASHCARDS.length - 1, i + 1));
            setFlipped(false);
          }}
          disabled={idx === MOCK_FLASHCARDS.length - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function MermaidDiagrams() {
  const [selected, setSelected] = useState(0);
  const [rendered, setRendered] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, boolean>>({});
  const renderRef = useRef<number | null>(null);

  useEffect(() => {
    const render = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "dark" });
        const d = DIAGRAMS[selected];
        const id = `mermaid-${selected}-${Date.now()}`;
        const { svg } = await mermaid.render(id, d.code);
        setRendered((prev) => ({ ...prev, [selected]: svg }));
      } catch {
        setErrors((prev) => ({ ...prev, [selected]: true }));
      }
    };
    if (!rendered[selected] && !errors[selected]) {
      renderRef.current = selected;
      render();
    }
  }, [selected, rendered, errors]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {DIAGRAMS.map((d, i) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setSelected(i)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selected === i ? "bg-[oklch(0.78_0.16_196)]/20 text-arcadia-teal border border-[oklch(0.78_0.16_196)]/30" : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"}`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="glass-card rounded-2xl p-6 min-h-64">
        {rendered[selected] ? (
          <div
            className="w-full overflow-x-auto [&>svg]:max-w-full [&>svg]:mx-auto [&>svg]:block"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid SVG output
            dangerouslySetInnerHTML={{ __html: rendered[selected] }}
          />
        ) : errors[selected] ? (
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono p-2">
            {DIAGRAMS[selected].code}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Rendering diagram\u2026
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudyPage() {
  const { currentLanguage } = useAppStore();
  const [genLoading, setGenLoading] = useState(false);

  async function generateCheatsheet() {
    setGenLoading(true);
    try {
      await fetch("/api/study/cheatsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: currentLanguage?.id }),
      });
      toast.success("New cheatsheet generated!");
    } catch {
      toast.error("Could not generate cheatsheet");
    } finally {
      setGenLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      data-ocid="study.page"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Study Workspace</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {currentLanguage?.flag} {currentLanguage?.name}
        </p>
      </div>
      <Tabs defaultValue="cheatsheets">
        <TabsList className="bg-white/5 border border-white/10 mb-6">
          <TabsTrigger
            value="cheatsheets"
            className="data-[state=active]:bg-white/10"
            data-ocid="study.tab.cheatsheets"
          >
            Cheatsheets
          </TabsTrigger>
          <TabsTrigger
            value="flashcards"
            className="data-[state=active]:bg-white/10"
            data-ocid="study.tab.flashcards"
          >
            Flashcards
          </TabsTrigger>
          <TabsTrigger
            value="diagrams"
            className="data-[state=active]:bg-white/10"
            data-ocid="study.tab.diagrams"
          >
            Diagrams
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cheatsheets">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              className="border-white/10 gap-2"
              onClick={generateCheatsheet}
              disabled={genLoading}
              data-ocid="study.cheatsheet.generate"
            >
              {genLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{" "}
              Generate New
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_CHEATSHEETS.map((cs) => (
              <div
                key={cs.id}
                className="glass-card glass-card-hover rounded-2xl p-5"
                data-ocid={`study.cheatsheet.${cs.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">{cs.title}</h3>
                  <Badge className="bg-[oklch(0.78_0.16_196)]/15 text-arcadia-teal border-[oklch(0.78_0.16_196)]/25 text-xs">
                    {cs.level}
                  </Badge>
                </div>
                <ul className="space-y-1.5">
                  {cs.rules.map((r) => (
                    <li
                      key={r}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-arcadia-teal shrink-0 mt-1.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="flashcards">
          <FlashcardDeck />
        </TabsContent>

        <TabsContent value="diagrams">
          <MermaidDiagrams />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
