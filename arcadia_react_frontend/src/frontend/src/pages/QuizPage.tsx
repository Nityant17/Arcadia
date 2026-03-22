import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import {
  Brain,
  CheckCircle2,
  Eraser,
  Loader2,
  XCircle,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type Tier = "recall" | "application" | "analysis";

interface QuizQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

const MOCK_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    question: "Which \u3066-form of \u98f2\u3080 (to drink) is correct?",
    options: [
      "\u98f2\u3093\u3067",
      "\u98f2\u307f\u3066",
      "\u98f2\u3063\u3066",
      "\u98f2\u3044\u3066",
    ],
    correctIndex: 0,
    explanation:
      "\u98f2\u3080 is a \u3080-verb. The \u3066-form replaces \u3080 with \u3093\u3067.",
  },
  {
    id: "q2",
    question: "What does \u6a5f\u4f1a (\u304d\u304b\u3044) mean?",
    options: ["Experience", "Gratitude", "Opportunity", "Situation"],
    correctIndex: 2,
    explanation: "\u6a5f\u4f1a means 'opportunity' or 'chance'.",
  },
  {
    id: "q3",
    question: "Which particle marks the destination of movement?",
    options: ["\u306f", "\u3092", "\u306b", "\u304c"],
    correctIndex: 2,
    explanation:
      "\u306b marks direction/destination. Example: \u5b66\u6821\u306b\u884c\u304f (go to school).",
  },
  {
    id: "q4",
    question: "What is the honorific form of \u98df\u3079\u308b (to eat)?",
    options: [
      "\u98df\u3079\u307e\u3059",
      "\u3044\u305f\u3060\u304d\u307e\u3059",
      "\u9802\u304d\u307e\u3059",
      "\u304a\u98df\u3079\u306b\u306a\u308a\u307e\u3059",
    ],
    correctIndex: 3,
    explanation:
      "\u304a~\u306b\u306a\u308b is the honorific (sonkeigo) pattern.",
  },
  {
    id: "q5",
    question: "\u301c\u305f\u3089 is best used for:",
    options: [
      "Habitual actions",
      "Specific hypothetical conditions",
      "General truths",
      "Past experiences",
    ],
    correctIndex: 1,
    explanation:
      "\u301c\u305f\u3089 is used for specific hypothetical or future conditions.",
  },
];

const TIERS = [
  {
    id: "recall" as Tier,
    icon: <Brain className="w-6 h-6" />,
    label: "Recall",
    desc: "Multiple choice on vocabulary & grammar",
    color: "text-arcadia-teal",
    active: "border-[oklch(0.78_0.16_196)]/50 bg-[oklch(0.78_0.16_196)]/10",
  },
  {
    id: "application" as Tier,
    icon: <Zap className="w-6 h-6" />,
    label: "Application",
    desc: "Fill-in-context sentences",
    color: "text-arcadia-purple",
    active: "border-[oklch(0.60_0.20_264)]/50 bg-[oklch(0.60_0.20_264)]/10",
  },
  {
    id: "analysis" as Tier,
    icon: <span className="text-xl">🔬</span>,
    label: "Analysis",
    desc: "Deep comprehension & nuance",
    color: "text-arcadia-magenta",
    active: "border-[oklch(0.62_0.22_340)]/50 bg-[oklch(0.62_0.22_340)]/10",
  },
];

function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  function getPos(
    e: React.MouseEvent | React.TouchEvent,
    c: HTMLCanvasElement,
  ) {
    const r = c.getBoundingClientRect();
    const s = "touches" in e ? e.touches[0] : e;
    return { x: s.clientX - r.left, y: s.clientY - r.top };
  }
  function start(e: React.MouseEvent | React.TouchEvent) {
    const c = canvasRef.current;
    if (!c) return;
    drawing.current = true;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = getPos(e, c);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = getPos(e, c);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  function end() {
    drawing.current = false;
  }
  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  }
  return (
    <div className="mt-4 glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Whiteboard Hints
        </span>
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Eraser className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={160}
        className="w-full h-40 cursor-crosshair touch-none"
        style={{ background: "rgba(255,255,255,0.02)" }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        data-ocid="quiz.whiteboard"
      />
    </div>
  );
}

export default function QuizPage() {
  const { currentLanguage } = useAppStore();
  const [step, setStep] = useState<"config" | "quiz" | "review">("config");
  const [tier, setTier] = useState<Tier>("recall");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [locked, setLocked] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const tierMap: Record<Tier, number> = {
        recall: 1,
        application: 2,
        analysis: 3,
      };

      const response = await api.quiz.generate({
        document_id: "default",
        tier: tierMap[tier],
        num_questions: 5,
        language: currentLanguage?.id ?? "en",
      });

      const qs = response.data?.questions ?? MOCK_QUESTIONS;
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(null));
      setCurrentQ(0);
      setStep("quiz");
    } catch {
      toast.error("Unable to generate quiz from backend. Showing fallback quiz.");
      setQuestions(MOCK_QUESTIONS);
      setAnswers(new Array(MOCK_QUESTIONS.length).fill(null));
      setCurrentQ(0);
      setStep("quiz");
    } finally {
      setLoading(false);
    }
  }

  function pick(i: number) {
    if (locked || answers[currentQ] !== null) return;
    setLocked(true);
    const next = answers.map((a, qi) => (qi === currentQ ? i : a));
    setAnswers(next);
    setTimeout(() => {
      setLocked(false);
      if (currentQ < questions.length - 1) {
        setCurrentQ((p) => p + 1);
      } else {
        setStep("review");
        const correct = next.filter(
          (a, qi) => a === questions[qi]?.correctIndex,
        ).length;
        toast.success(`Quiz complete! ${correct}/${questions.length} correct`);
      }
    }, 500);
  }

  const score = answers.filter(
    (a, i) => a !== null && a === questions[i]?.correctIndex,
  ).length;

  if (step === "config")
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl mx-auto space-y-6"
        data-ocid="quiz.page"
      >
        <div className="glass rounded-3xl p-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Adaptive Quiz
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {currentLanguage?.flag} {currentLanguage?.name} &middot; Choose your
            tier
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 mb-6">
            {loading
              ? [1, 2, 3].map((index) => (
                  <div key={index} className="glass-card rounded-2xl p-5">
                    <Skeleton className="h-6 w-12 mb-3 bg-white/10" />
                    <Skeleton className="h-4 w-24 mb-2 bg-white/10" />
                    <Skeleton className="h-3 w-32 bg-white/10" />
                  </div>
                ))
              : TIERS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t.id)}
                    className={`glass-card rounded-2xl p-5 text-left border transition-all ${tier === t.id ? t.active : "border-white/10 hover:border-white/20"}`}
                    data-ocid={`quiz.tier.${t.id}`}
                  >
                    <div className={`mb-3 ${t.color}`}>{t.icon}</div>
                    <div className="font-semibold text-foreground mb-1">
                      {t.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </button>
                ))}
          </div>
          <Button
            onClick={generate}
            disabled={loading}
            className="w-full bg-foreground text-[#0B1020] font-semibold hover:bg-white/90"
            data-ocid="quiz.generate.button"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{" "}
            Generate Quiz
          </Button>
        </div>
      </motion.div>
    );

  if (step === "quiz") {
    const q = questions[currentQ];
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl mx-auto space-y-4"
        data-ocid="quiz.active"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Question {currentQ + 1} of {questions.length}
          </span>
          <Badge className="bg-white/5 text-muted-foreground border-white/10">
            {TIERS.find((t) => t.id === tier)?.label}
          </Badge>
        </div>
        <Progress
          value={(currentQ / questions.length) * 100}
          className="h-1 bg-white/10 [&>div]:bg-arcadia-teal"
        />
        <div className="glass rounded-3xl p-8">
          <p className="text-lg font-semibold text-foreground mb-6">
            {q.question}
          </p>
          <div className="grid gap-3">
            {q.options.map((opt, i) => {
              const answered = answers[currentQ] !== null;
              const isCorrect = i === q.correctIndex;
              const isSelected = answers[currentQ] === i;
              let cls =
                "glass-card border border-white/10 rounded-xl px-4 py-3 text-sm text-left transition-all ";
              if (answered) {
                if (isCorrect)
                  cls +=
                    "border-[oklch(0.78_0.16_196)]/50 bg-[oklch(0.78_0.16_196)]/10 ";
                else if (isSelected)
                  cls += "border-destructive/50 bg-destructive/10 ";
              } else cls += "cursor-pointer hover:border-white/25 ";
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => pick(i)}
                  disabled={answered || locked}
                  className={cls}
                  data-ocid={`quiz.option.${i}`}
                >
                  <span className="text-muted-foreground mr-2">
                    {["A", "B", "C", "D"][i]}.
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
        <Whiteboard />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto space-y-4"
      data-ocid="quiz.review"
    >
      <div className="glass rounded-3xl p-8 text-center">
        <div className="text-4xl font-bold text-foreground mb-1">
          {score}/{questions.length}
        </div>
        <p className="text-muted-foreground text-sm">
          Quiz Complete &middot; {tier} tier
        </p>
        <div className="flex gap-3 justify-center mt-4">
          <Button
            variant="outline"
            onClick={() => setStep("config")}
            className="border-white/10"
          >
            New Quiz
          </Button>
          <Button
            onClick={() => {
              setAnswers(new Array(questions.length).fill(null));
              setCurrentQ(0);
              setStep("quiz");
            }}
            className="bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan"
          >
            Retake
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {questions.map((q, qi) => {
          const sel = answers[qi];
          const correct = q.correctIndex;
          const ok = sel === correct;
          return (
            <div key={q.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-3">
                {ok ? (
                  <CheckCircle2 className="w-5 h-5 text-arcadia-teal shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                )}
                <p className="text-sm font-medium text-foreground">
                  {q.question}
                </p>
              </div>
              <div className="space-y-1 pl-8">
                {q.options.map((opt, i) => (
                  <div
                    key={opt}
                    className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 ${
                      i === correct
                        ? "bg-[oklch(0.78_0.16_196)]/15 text-arcadia-teal"
                        : i === sel && i !== correct
                          ? "bg-destructive/15 text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    <span className="font-medium">
                      {["A", "B", "C", "D"][i]}.
                    </span>
                    {opt}
                    {i === correct && (
                      <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />
                    )}
                    {i === sel && i !== correct && (
                      <XCircle className="w-3.5 h-3.5 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 pl-8 text-xs text-muted-foreground bg-white/5 rounded-xl p-3">
                💡 {q.explanation}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
