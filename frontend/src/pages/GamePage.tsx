import { Button } from "@/components/ui/button";
import { apiClient, getApiErrorMessage, type DocumentItem, type TopicItem } from "@/services/api";
import { Heart, Sparkles, Trophy, Zap, Gamepad2, Flame } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type GameStatus = "setup" | "playing" | "finished";

interface QuestQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  hint: string;
}

function shuffle<T>(values: T[]): T[] {
  const cloned = [...values];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function buildQuestQuestions(topics: TopicItem[]): QuestQuestion[] {
  const normalized = topics
    .map((topic) => ({
      title: topic.title.trim() || "Untitled topic",
      summary: (topic.summary || "").trim() || `Core idea for ${topic.title || "this topic"}`,
    }))
    .filter((topic) => topic.title);

  if (!normalized.length) {
    return [
      {
        id: "fallback-1",
        prompt: "Pick the most useful first learning move",
        options: [
          "Start with a short summary and one active recall question",
          "Read everything once without notes",
          "Skip the difficult sections",
          "Memorize random definitions only",
        ],
        answer: "Start with a short summary and one active recall question",
        hint: "Good learning starts with structure and recall.",
      },
    ];
  }

  const titlePool = normalized.map((topic) => topic.title);
  const summaryPool = normalized.map((topic) => topic.summary);

  const questions: QuestQuestion[] = [];

  normalized.slice(0, 8).forEach((topic, idx) => {
    const distractors = shuffle(summaryPool.filter((summary) => summary !== topic.summary)).slice(0, 3);
    const options = shuffle([topic.summary, ...distractors]);
    questions.push({
      id: `summary-${idx}`,
      prompt: `Which summary best matches: ${topic.title}?`,
      options,
      answer: topic.summary,
      hint: topic.summary,
    });
  });

  normalized.slice(0, 6).forEach((topic, idx) => {
    const distractors = shuffle(titlePool.filter((title) => title !== topic.title)).slice(0, 3);
    const options = shuffle([topic.title, ...distractors]);
    questions.push({
      id: `title-${idx}`,
      prompt: `Which topic fits this clue? ${topic.summary}`,
      options,
      answer: topic.title,
      hint: topic.title,
    });
  });

  return shuffle(questions).slice(0, 12);
}

function heartsRow(hearts: number) {
  return Array.from({ length: 3 }).map((_, index) => (
    <Heart
      key={`heart-${index}`}
      className={`h-5 w-5 ${index < hearts ? "text-rose-300 fill-rose-400/90" : "text-slate-600"}`}
    />
  ));
}

export default function GamePage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [status, setStatus] = useState<GameStatus>("setup");
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [questions, setQuestions] = useState<QuestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastFeedback, setLastFeedback] = useState("");
  const [answered, setAnswered] = useState(false);

  const noteOptions = useMemo(() => {
    const grouped = new Map<string, { id: string; label: string; count: number }>();
    documents.forEach((doc) => {
      const noteId = doc.note_id || doc.id;
      const existing = grouped.get(noteId);
      if (existing) {
        existing.count += 1;
        return;
      }
      grouped.set(noteId, {
        id: noteId,
        label: doc.note_title || doc.topic || doc.original_name || doc.filename,
        count: 1,
      });
    });
    return Array.from(grouped.values());
  }, [documents]);

  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;
  const level = Math.floor(xp / 100) + 1;
  const levelProgress = xp % 100;

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await apiClient.listDocuments();
        setDocuments(response.data.documents);
        if (response.data.documents.length > 0) {
          setSelectedNoteId(response.data.documents[0].note_id || response.data.documents[0].id);
        }
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Failed to load notes"));
      }
    };

    void loadDocuments();
  }, []);

  const startQuest = async () => {
    if (!selectedNoteId) {
      toast.error("Upload and select a note first");
      return;
    }

    setLoadingTopics(true);
    try {
      const response = await apiClient.extractTopics(selectedNoteId);
      const generated = buildQuestQuestions(response.data.topics || []);
      setQuestions(generated);
      setCurrentIndex(0);
      setHearts(3);
      setStreak(0);
      setLastFeedback("");
      setAnswered(false);
      setStatus("playing");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to start game"));
    } finally {
      setLoadingTopics(false);
    }
  };

  const finishQuest = (message: string) => {
    setLastFeedback(message);
    setStatus("finished");
  };

  const answerQuestion = (option: string) => {
    if (!currentQuestion || answered) return;
    setAnswered(true);

    const correct = option === currentQuestion.answer;
    if (correct) {
      setStreak((prev) => {
        const nextStreak = prev + 1;
        setXp((prevXp) => prevXp + 10 + nextStreak * 2);
        return nextStreak;
      });
      setLastFeedback("Correct! Nice streak.");
    } else {
      setStreak(0);
      setHearts((prev) => prev - 1);
      setLastFeedback(`Not quite. Hint: ${currentQuestion.hint}`);
    }

    window.setTimeout(() => {
      setAnswered(false);
      const nextHearts = correct ? hearts : hearts - 1;
      if (nextHearts <= 0) {
        finishQuest("Out of hearts. Retry to beat your XP.");
        return;
      }

      if (currentIndex + 1 >= questions.length) {
        finishQuest("Quest complete. Awesome work!");
        return;
      }

      setCurrentIndex((prev) => prev + 1);
    }, 550);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      <section className="rounded-3xl border border-white/10 bg-slate-950/45 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 via-teal-300 to-blue-400 bg-clip-text text-transparent flex items-center gap-2">
              <Gamepad2 className="h-6 w-6 text-cyan-300" />
              Arcadia Quest
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Learn with hearts, streaks, XP, and quick rounds from your notes.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-cyan-200">
            Level {level}
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" style={{ width: `${Math.max(5, levelProgress)}%` }} />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Hearts</div>
            <div className="mt-2 flex items-center gap-1">{heartsRow(hearts)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Streak</div>
            <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-amber-300">
              <Flame className="h-5 w-5" />
              {streak}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">XP</div>
            <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-cyan-200">
              <Zap className="h-5 w-5" />
              {xp}
            </div>
          </div>
        </div>
      </section>

      {status === "setup" && (
        <section className="rounded-3xl border border-white/10 bg-slate-950/45 p-6 backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-foreground">Start A Quest</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a merged note and launch a fun challenge round.</p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <select
              value={selectedNoteId}
              onChange={(event) => setSelectedNoteId(event.target.value)}
              className="arc-select w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-foreground outline-none"
            >
              {noteOptions.length === 0 ? (
                <option value="">No notes uploaded</option>
              ) : (
                noteOptions.map((note) => (
                  <option key={note.id} value={note.id}>{note.label} · {note.count} file{note.count > 1 ? "s" : ""}</option>
                ))
              )}
            </select>
            <Button
              onClick={() => void startQuest()}
              disabled={!selectedNoteId || loadingTopics}
              className="bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan"
            >
              <Sparkles className="mr-1 h-4 w-4" />
              {loadingTopics ? "Preparing..." : "Start Quest"}
            </Button>
          </div>
        </section>
      )}

      {status === "playing" && currentQuestion && (
        <section className="rounded-3xl border border-cyan-500/30 bg-slate-950/60 p-6 backdrop-blur-xl shadow-[0_0_24px_rgba(6,182,212,0.18)]">
          <div className="mb-3 flex items-center justify-between gap-2 text-xs text-cyan-200/90">
            <span>Question {currentIndex + 1} / {questions.length}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>

          <h3 className="mt-5 text-xl font-semibold text-foreground">{currentQuestion.prompt}</h3>

          <div className="mt-4 grid gap-2">
            {currentQuestion.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => answerQuestion(option)}
                disabled={answered}
                className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-left text-sm text-foreground transition-all hover:border-cyan-400/40 hover:bg-slate-800/70 disabled:opacity-70"
              >
                {option}
              </button>
            ))}
          </div>

          {lastFeedback ? (
            <p className="mt-3 text-sm text-cyan-200/90">{lastFeedback}</p>
          ) : null}
        </section>
      )}

      {status === "finished" && (
        <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 text-center backdrop-blur-xl">
          <Trophy className="mx-auto h-10 w-10 text-amber-300" />
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Quest Finished</h2>
          <p className="mt-1 text-sm text-muted-foreground">{lastFeedback || "Great run."}</p>
          <div className="mt-3 text-sm text-cyan-200">XP: {xp} · Best streak this run: {streak}</div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStatus("setup");
                setQuestions([]);
                setCurrentIndex(0);
                setHearts(3);
                setStreak(0);
                setLastFeedback("");
              }}
            >
              <Sparkles className="mr-1 h-4 w-4" />
              New Quest
            </Button>
            <Button
              onClick={() => void startQuest()}
              disabled={!selectedNoteId || loadingTopics}
              className="bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan"
            >
              <Zap className="mr-1 h-4 w-4" />
              Play Again
            </Button>
          </div>
        </section>
      )}
    </motion.div>
  );
}
