import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiClient, type DocumentItem } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import {
  Brain,
  CheckCircle2,
  Loader2,
  Lightbulb,
  ScanText,
  XCircle,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Tier = 1 | 2 | 3;

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  tier: number;
}

interface QuizResult {
  question_id: number;
  question: string;
  selected_option: number;
  correct_option: number;
  is_correct: boolean;
  explanation: string;
}

const TIERS: Array<{
  id: Tier;
  icon: ReactNode;
  label: string;
  desc: string;
  active: string;
}> = [
  {
    id: 1,
    icon: <Brain className="w-6 h-6" />,
    label: "Tier 1 · Recall",
    desc: "Foundational concept checks",
    active: "border-[oklch(0.78_0.16_196)]/50 bg-[oklch(0.78_0.16_196)]/10",
  },
  {
    id: 2,
    icon: <Zap className="w-6 h-6" />,
    label: "Tier 2 · Application",
    desc: "Apply concepts in context",
    active: "border-[oklch(0.60_0.20_264)]/50 bg-[oklch(0.60_0.20_264)]/10",
  },
  {
    id: 3,
    icon: <span className="text-xl">🔬</span>,
    label: "Tier 3 · Analysis",
    desc: "Reasoning and deeper understanding",
    active: "border-[oklch(0.62_0.22_340)]/50 bg-[oklch(0.62_0.22_340)]/10",
  },
];

export default function QuizPage() {
  const { currentLanguage } = useAppStore();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentId, setDocumentId] = useState("");

  const [step, setStep] = useState<"config" | "quiz" | "review">("config");
  const [tier, setTier] = useState<Tier>(1);
  const [focusTopic, setFocusTopic] = useState("");

  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topics, setTopics] = useState<Array<{ title: string; summary: string }>>([]);
  const [hintImageBase64, setHintImageBase64] = useState("");
  const [hintImagePreview, setHintImagePreview] = useState("");
  const [hintRoughWorkText, setHintRoughWorkText] = useState("");
  const [hintText, setHintText] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasCanvasInk, setHasCanvasInk] = useState(false);

  const [quizId, setQuizId] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [currentQ, setCurrentQ] = useState(0);

  const [results, setResults] = useState<QuizResult[]>([]);
  const [score, setScore] = useState(0);

  async function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  }

  async function extractTopics() {
    if (!documentId) {
      toast.error("Select a document first");
      return;
    }
    setLoadingTopics(true);
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
      setLoadingTopics(false);
    }
  }

  async function requestWhiteboardHint() {
    let imageBase64ToSend = hintImageBase64;
    if (!imageBase64ToSend && hasCanvasInk && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      imageBase64ToSend = dataUrl.split(",")[1] || "";
    }

    if (!imageBase64ToSend && !hintRoughWorkText.trim()) {
      toast.error("Draw, upload, or type rough work first");
      return;
    }

    const question = questions[currentQ]?.question ?? "";
    setHintLoading(true);
    try {
      const response = await apiClient.getWhiteboardHint({
        image_base64: imageBase64ToSend,
        question,
        topic: focusTopic,
        rough_work_text: hintRoughWorkText,
      });
      setHintText(response.data.hint);
    } catch {
      toast.error("Failed to generate hint");
    } finally {
      setHintLoading(false);
    }
  }

  function setupCanvasContext() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#22d3ee";
    return context;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.floor(rect.width * ratio));
      const nextHeight = Math.max(1, Math.floor(rect.height * ratio));

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        const snapshot = canvas.toDataURL("image/png");
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        const context = canvas.getContext("2d");
        if (!context) return;

        const image = new Image();
        image.onload = () => {
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
        };
        image.src = snapshot;
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(event: ReactPointerEvent<HTMLCanvasElement>) {
    const context = setupCanvasContext();
    if (!context) return;
    const point = getCanvasPoint(event);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function moveDraw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = setupCanvasContext();
    if (!context) return;
    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasCanvasInk(true);
  }

  function endDraw() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasCanvasInk(false);
  }

  useEffect(() => {
    if (step !== "quiz") return;
    setHintText("");
  }, [currentQ, step]);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await apiClient.listDocuments();
        setDocuments(response.data.documents);
        if (response.data.documents.length > 0) {
          setDocumentId(response.data.documents[0].id);
        }
      } catch {
        toast.error("Failed to load documents for quiz");
      }
    };

    loadDocuments();
  }, []);

  async function generate() {
    if (!documentId) {
      toast.error("Please upload a note before starting a quiz");
      return;
    }

    setLoadingGenerate(true);
    try {
      const response = await apiClient.generateQuiz({
        document_id: documentId,
        tier,
        num_questions: 5,
        language: currentLanguage?.id ?? "en",
        focus_topic: focusTopic,
      });

      const generatedQuestions = response.data.questions;
      setQuizId(response.data.quiz_id);
      setQuestions(generatedQuestions);
      setAnswers(new Array(generatedQuestions.length).fill(null));
      setCurrentQ(0);
      setResults([]);
      setScore(0);
      setStep("quiz");
    } catch {
      toast.error("Failed to generate Quiz");
    } finally {
      setLoadingGenerate(false);
    }
  }

  async function submitQuiz(nextAnswers: (number | null)[]) {
    if (!quizId || !documentId) return;

    const payloadAnswers = nextAnswers
      .map((answer, index) => ({
        question_id: questions[index]?.id,
        selected_option: answer,
      }))
      .filter(
        (item): item is { question_id: number; selected_option: number } =>
          typeof item.question_id === "number" &&
          typeof item.selected_option === "number",
      );

    if (payloadAnswers.length !== questions.length) {
      toast.error("Please answer all questions before submitting");
      return;
    }

    setLoadingSubmit(true);
    try {
      const response = await apiClient.submitQuiz({
        quiz_id: quizId,
        document_id: documentId,
        answers: payloadAnswers,
      });

      setResults(response.data.results);
      setScore(response.data.correct_answers);
      setStep("review");
      toast.success(`Quiz complete! ${response.data.correct_answers}/${response.data.total_questions} correct`);
    } catch {
      toast.error("Failed to submit Quiz");
    } finally {
      setLoadingSubmit(false);
    }
  }

  function pick(optionIndex: number) {
    if (answers[currentQ] !== null || loadingSubmit) return;

    const nextAnswers = answers.map((answer, index) =>
      index === currentQ ? optionIndex : answer,
    );

    setAnswers(nextAnswers);

    if (currentQ < questions.length - 1) {
      setCurrentQ((prev) => prev + 1);
      return;
    }

    submitQuiz(nextAnswers);
  }

  if (step === "config") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl mx-auto space-y-6"
        data-ocid="quiz.page"
      >
        <div className="glass rounded-3xl p-8 space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Adaptive Quiz</h1>
          <p className="text-muted-foreground text-sm">
            {currentLanguage?.flag} {currentLanguage?.name}
          </p>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Source document</label>
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
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Focus topic</label>
            <input
              value={focusTopic}
              onChange={(event) => setFocusTopic(event.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
              placeholder="Optional topic"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-white/10"
                onClick={extractTopics}
                disabled={loadingTopics || !documentId}
              >
                {loadingTopics ? (
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
                  className="arc-select flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-foreground"
                >
                  {topics.map((item) => (
                    <option key={item.title} value={item.title}>
                      {item.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Choose tier</label>
            <span className="text-xs text-foreground">Selected: Tier {tier}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {TIERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTier(item.id)}
                aria-pressed={tier === item.id}
                className={`glass-card rounded-2xl p-5 text-left border transition-all ${
                  tier === item.id
                    ? `${item.active} ring-2 ring-[oklch(0.78_0.16_196)]/55 shadow-[0_0_24px_rgba(34,211,238,0.24)] scale-[1.02]`
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className={`mb-3 ${tier === item.id ? "text-foreground" : "text-arcadia-teal"}`}>{item.icon}</div>
                <div className="font-semibold text-foreground mb-1">{item.label}</div>
                <div className={`text-xs ${tier === item.id ? "text-foreground/85" : "text-muted-foreground"}`}>{item.desc}</div>
              </button>
            ))}
          </div>

          <Button
            onClick={generate}
            disabled={loadingGenerate || !documentId}
            className="w-full bg-foreground text-[#0B1020] font-semibold hover:bg-white/90"
          >
            {loadingGenerate ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Start Quiz
          </Button>
        </div>
      </motion.div>
    );
  }

  if (step === "quiz") {
    const question = questions[currentQ];

    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl mx-auto space-y-4"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Question {currentQ + 1} of {questions.length}
          </span>
          <Badge className="bg-white/5 text-muted-foreground border-white/10">
            {TIERS.find((item) => item.id === tier)?.label}
          </Badge>
        </div>

        <Progress
          value={(currentQ / questions.length) * 100}
          className="h-1 bg-white/10 [&>div]:bg-arcadia-teal"
        />

        <div className="glass rounded-3xl p-8">
          <p className="text-lg font-semibold text-foreground mb-6">{question.question}</p>
          <div className="grid gap-3">
            {question.options.map((option, index) => (
              <button
                key={option}
                type="button"
                onClick={() => pick(index)}
                disabled={answers[currentQ] !== null || loadingSubmit}
                className="glass-card border border-white/10 rounded-xl px-4 py-3 text-sm text-left transition-all cursor-pointer hover:border-white/25"
              >
                <span className="text-muted-foreground mr-2">
                  {["A", "B", "C", "D"][index]}.
                </span>
                {option}
              </button>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lightbulb className="w-4 h-4 text-arcadia-teal" /> Whiteboard Hint
            </div>
            <canvas
              ref={canvasRef}
              width={720}
              height={220}
              className="w-full rounded-xl border border-white/15 bg-[#0b1020] touch-none"
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/10"
                onClick={clearCanvas}
                disabled={!hasCanvasInk}
              >
                Clear Canvas
              </Button>
              <span className="text-xs text-muted-foreground">Draw your rough work directly here</span>
            </div>
            <input
              type="file"
              accept="image/*"
              className="w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-foreground"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const dataUrl = await readFileAsDataUrl(file);
                  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
                  setHintImageBase64(base64);
                  setHintImagePreview(dataUrl);
                  setHintText("");
                } catch {
                  toast.error("Failed to read image");
                }
              }}
            />
            <textarea
              value={hintRoughWorkText}
              onChange={(event) => setHintRoughWorkText(event.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground min-h-[72px]"
              placeholder="Optional: type your current thinking or steps"
            />

            {hintImagePreview && (
              <img
                src={hintImagePreview}
                alt="Whiteboard preview"
                className="rounded-xl border border-white/10 max-h-40 object-contain"
              />
            )}

            <Button
              variant="outline"
              className="border-white/10"
              onClick={requestWhiteboardHint}
              disabled={
                hintLoading
                || (!hintImageBase64 && !hasCanvasInk && !hintRoughWorkText.trim())
              }
            >
              {hintLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
              Get Hint
            </Button>

            {hintText && (
              <div className="glass-card rounded-xl p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                {hintText}
              </div>
            )}
          </div>
        </div>

        {loadingSubmit && (
          <div className="glass-card rounded-xl p-3 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Submitting quiz...
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto space-y-4"
    >
      <div className="glass rounded-3xl p-8 text-center">
        <div className="text-4xl font-bold text-foreground mb-1">
          {score}/{results.length}
        </div>
        <p className="text-muted-foreground text-sm">Quiz Complete · Tier {tier}</p>
        <div className="flex gap-3 justify-center mt-4">
          <Button
            variant="outline"
            onClick={() => setStep("config")}
            className="border-white/10"
          >
            New Quiz
          </Button>
          <Button
            onClick={generate}
            className="bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan"
            disabled={loadingGenerate}
          >
            Retry Tier
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {results.map((result) => (
          <div key={result.question_id} className="glass-card rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-3">
              {result.is_correct ? (
                <CheckCircle2 className="w-5 h-5 text-arcadia-teal shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              )}
              <p className="text-sm font-medium text-foreground">{result.question}</p>
            </div>
            <div className="space-y-1 pl-8">
              <div className="text-xs text-muted-foreground">
                Selected: {result.selected_option + 1}
              </div>
              <div className="text-xs text-arcadia-teal">
                Correct: {result.correct_option + 1}
              </div>
              <div className="text-xs text-muted-foreground">{result.explanation}</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
