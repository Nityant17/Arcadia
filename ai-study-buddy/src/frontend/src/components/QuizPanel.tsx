import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ArcadiaDocument, QuizQuestion, SupportedLanguages, UserSession } from "../lib/api";
import { extractTopics, generateQuiz, getSupportedLanguages, submitQuiz, whiteboardHint } from "../lib/api";

type Props = {
  session: UserSession;
  activeDocument: ArcadiaDocument | null;
};

export default function QuizPanel({ session, activeDocument }: Props) {
  const [tier, setTier] = useState(1);
  const [quiz, setQuiz] = useState<{ quiz_id: string; questions: QuizQuestion[] } | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<null | {
    score: number;
    mastery_score: number;
    total_questions: number;
    correct_answers: number;
    results?: Array<{
      question_id: number;
      selected_option: number;
      correct_option: number;
      is_correct: boolean;
      explanation?: string;
    }>;
  }>(null);
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [focusTopic, setFocusTopic] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [hintText, setHintText] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [language, setLanguage] = useState("en");
  const [supportedLanguages, setSupportedLanguages] = useState<SupportedLanguages>({ en: "English" });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

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

  const buildQuiz = async () => {
    if (!activeDocument) return;
    setLoading(true);
    setResult(null);
    setAnswers({});
    try {
      const data = await generateQuiz(session.token, {
        document_id: activeDocument.id,
        tier,
        num_questions: 5,
        language,
        focus_topic: focusTopic,
      });
      setQuiz(data);
      setQuestionText(data.questions?.[0]?.question ?? "");
    } catch (e) {
      toast.error(`Quiz generation failed: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!quiz || !activeDocument) return;
    if (Object.keys(answers).length < quiz.questions.length) {
      toast.error("Answer all questions first");
      return;
    }
    setLoading(true);
    try {
      const payload = quiz.questions.map((q) => ({ question_id: q.id, selected_option: answers[q.id] }));
      const data = await submitQuiz(session.token, {
        quiz_id: quiz.quiz_id,
        document_id: activeDocument.id,
        answers: payload,
        user_id: session.user_id,
      });
      setResult(data);
    } catch (e) {
      toast.error(`Quiz submit failed: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTopics = async () => {
    if (!activeDocument) return;
    try {
      const data = await extractTopics(session.token, activeDocument.id);
      setTopics((data.topics ?? []).map((t: { title: string }) => t.title));
      toast.success("Topics extracted");
    } catch (e) {
      toast.error(`Topic extraction failed: ${String(e)}`);
    }
  };

  const onWhiteboardImage = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result || "");
      const b64 = raw.includes(",") ? raw.split(",")[1] : raw;
      try {
        const data = await whiteboardHint(session.token, {
          image_base64: b64,
          question: questionText,
          topic: focusTopic,
        });
        setHintText(data.hint || "");
      } catch (e) {
        toast.error(`Hint failed: ${String(e)}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const getPointerPos = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const { x, y } = getPointerPos(event);
    context.beginPath();
    context.moveTo(x, y);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 3;
    context.strokeStyle = "#111827";
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDrawing(true);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const { x, y } = getPointerPos(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const clearWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setHintText("");
  };

  const requestWhiteboardHint = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!questionText.trim()) {
      toast.error("Enter a question prompt first");
      return;
    }
    setHintLoading(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1] ?? "";
      const data = await whiteboardHint(session.token, {
        image_base64: base64,
        question: questionText,
        topic: focusTopic,
      });
      setHintText(data.hint || "");
    } catch (error) {
      toast.error(`Hint failed: ${String(error)}`);
    } finally {
      setHintLoading(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  if (!activeDocument) {
    return <div className="text-sm text-muted-foreground">Select a document first.</div>;
  }

  return (
    <Card className="bento-card h-[calc(100vh-9.5rem)] overflow-auto border-white/15 bg-white/[0.04] text-white">
      <CardHeader>
        <CardTitle className="text-white">Adaptive Quiz + Whiteboard Hint</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-center">
          <select className="rounded-lg px-2 py-2 text-sm bg-white/[0.08] border border-white/15 text-white" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
            <option value={1}>Tier 1 (Recall)</option>
            <option value={2}>Tier 2 (Application)</option>
            <option value={3}>Tier 3 (Analysis)</option>
          </select>
          <select className="rounded-lg px-2 py-2 text-sm bg-white/[0.08] border border-white/15 text-white" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {Object.entries(supportedLanguages).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <Button variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={loadTopics}>Extract topics</Button>
          <select className="rounded-lg px-2 py-2 text-sm bg-white/[0.08] border border-white/15 text-white" value={focusTopic} onChange={(e) => setFocusTopic(e.target.value)}>
            <option value="">All topics</option>
            {topics.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
          <Button className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-0" onClick={buildQuiz} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate quiz"}</Button>
        </div>

        {quiz && (
          <div className="space-y-4">
            {quiz.questions.map((q) => (
              <div key={q.id} className="border border-white/15 bg-white/[0.06] rounded-lg p-3">
                <p className="font-medium text-sm mb-2">{q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt, idx) => (
                    <label key={idx} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={answers[q.id] === idx}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                        disabled={!!result}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {!result && (
              <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0" onClick={submit} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit quiz"}</Button>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="bg-white/[0.08] border border-white/15 rounded-lg p-3 text-sm">
              Score: {Math.round((result.score ?? 0) * 100)}% • Mastery: {Math.round((result.mastery_score ?? 0) * 100)}% • Correct: {result.correct_answers}/{result.total_questions}
            </div>
            <div className="space-y-2">
              {(result.results ?? []).map((item) => {
                const question = quiz?.questions.find((q) => q.id === item.question_id);
                return (
                  <div key={item.question_id} className={`rounded-lg border p-3 ${item.is_correct ? "border-emerald-400/30 bg-emerald-500/10" : "border-rose-400/30 bg-rose-500/10"}`}>
                    <p className="text-sm font-medium mb-1">{question?.question}</p>
                    <p className="text-xs text-white/75">Your answer: {question?.options?.[item.selected_option] ?? "-"}</p>
                    <p className="text-xs text-white/90">Correct answer: {question?.options?.[item.correct_option] ?? "-"}</p>
                    {item.explanation && <p className="text-xs text-white/70 mt-1">{item.explanation}</p>}
                  </div>
                );
              })}
            </div>
            <Button variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={() => { setQuiz(null); setResult(null); setAnswers({}); }}>Start another quiz</Button>
          </div>
        )}

        <div className="border-t border-white/10 pt-3 space-y-2">
          <p className="font-medium text-sm">Whiteboard Hint</p>
          <Input className="bg-white/[0.05] border-white/20 text-white placeholder:text-white/45" placeholder="Question prompt for hint" value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
          <div className="rounded-lg border border-white/15 bg-white p-2">
            <canvas
              ref={canvasRef}
              width={900}
              height={260}
              className="w-full h-[220px] rounded bg-white cursor-crosshair touch-none"
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
              onPointerCancel={stopDrawing}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={clearWhiteboard}>Clear board</Button>
            <Button className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-0" onClick={() => void requestWhiteboardHint()} disabled={hintLoading}>{hintLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get hint from board"}</Button>
            <span className="text-xs text-white/60">or upload image</span>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onWhiteboardImage(e.target.files[0])} />
          </div>
          {hintText && <div className="text-sm bg-white/[0.08] border border-white/15 rounded-lg p-3 whitespace-pre-wrap">{hintText}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
