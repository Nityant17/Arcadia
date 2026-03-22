import { Button } from "@/components/ui/button";
import { apiClient, type PlannerTask } from "@/services/api";
import { Link } from "@tanstack/react-router";
import {
  Calendar,
  FileText,
  MessageSquare,
  Send,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

function formatTaskTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pickSubjectBadge(label: string) {
  if (!label) return "📘";
  const value = label.toLowerCase();
  if (value.includes("math")) return "📐";
  if (value.includes("physics")) return "⚛️";
  if (value.includes("chem")) return "🧪";
  if (value.includes("biology")) return "🧬";
  if (value.includes("history")) return "🏛️";
  if (value.includes("cs") || value.includes("program") || value.includes("ai")) return "💻";
  return "📘";
}

export default function BentoGrid() {
  const [documentCount, setDocumentCount] = useState(0);
  const [quizCount, setQuizCount] = useState(0);
  const [topicsMastered, setTopicsMastered] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [pendingTasks, setPendingTasks] = useState<PlannerTask[]>([]);
  const [recentNotes, setRecentNotes] = useState<string[]>([]);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const [documentsRes, statsRes, plannerRes] = await Promise.all([
          apiClient.listDocuments(),
          apiClient.getDashboardStats(),
          apiClient.getPlannerTasks(),
        ]);

        setDocumentCount(documentsRes.data.total);
        setRecentNotes(
          documentsRes.data.documents
            .slice(0, 3)
            .map((doc) => doc.original_name || doc.filename),
        );

        setQuizCount(statsRes.data.stats.total_quizzes_taken);
        setTopicsMastered(statsRes.data.stats.topics_mastered);
        setAvgScore(Math.round((statsRes.data.stats.average_score || 0) * 100));

        setPendingTasks(
          plannerRes.data.tasks
            .filter((task) => task.status === "pending")
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
            .slice(0, 3),
        );
      } catch {
        setDocumentCount(0);
        setQuizCount(0);
        setTopicsMastered(0);
        setAvgScore(0);
        setPendingTasks([]);
        setRecentNotes([]);
      }
    };

    loadSummary();
  }, []);

  const challengePercent = Math.max(0, Math.min(100, avgScore));
  const challengeDone = Math.max(0, Math.min(12, Math.round((challengePercent / 100) * 12)));
  const levelLabel = `Tier ${Math.max(1, topicsMastered)}`;
  const streakDays = Math.max(1, Math.floor(quizCount * 2.1));
  const leadTask = pendingTasks[0];
  const leadTaskTopic = (leadTask?.focus_topic || leadTask?.task_type || "Focused revision").replaceAll("_", " ");

  const trendPoints = useMemo(() => {
    const base = Math.max(22, Math.min(90, avgScore || 35));
    const influence = Math.min(12, quizCount * 2);
    const values = [
      base - 18,
      base - 12 + Math.min(4, influence),
      base - 14 + Math.min(6, influence),
      base - 8 + Math.min(8, influence),
      base - 6 + Math.min(10, influence),
      base + Math.min(12, influence),
    ].map((value) => Math.max(8, Math.min(98, Math.round(value))));

    const width = 230;
    const height = 44;
    const step = width / (values.length - 1);
    const points = values.map((value, index) => {
      const x = Math.round(index * step);
      const y = Math.round(height - (value / 100) * height);
      return `${x},${y}`;
    });

    return points.join(" ");
  }, [avgScore, quizCount]);

  const progressLabel = useMemo(() => {
    if (quizCount === 0) return "No quizzes yet";
    if (avgScore >= 80) return "Strong performance";
    if (avgScore >= 50) return "Steady progress";
    return "Needs review focus";
  }, [avgScore, quizCount]);

  const moduleCardClass =
    "glass-card rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:border-arcadia-teal/60 hover:shadow-2xl hover:shadow-arcadia-teal/50";

  return (
    <section className="space-y-4" data-ocid="bento.section">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={moduleCardClass}>
          <div className="flex items-center gap-2 mb-3 text-foreground">
            <Trophy className="w-4 h-4 text-arcadia-teal" />
            <span className="text-sm font-semibold">Daily Challenge</span>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="relative w-20 h-20 rounded-full grid place-items-center border border-white/10 bg-white/5">
              <div className="absolute inset-2 rounded-full border-4 border-[oklch(0.78_0.16_196)]/30" />
              <div className="text-lg font-bold text-foreground">{challengePercent}%</div>
            </div>
            <div>
              <div className="text-xs text-arcadia-teal">Adaptive quiz</div>
              <p className="text-xs text-muted-foreground mt-1">⏱ 12 min remaining</p>
              <p className="text-xs text-muted-foreground">{challengeDone} / 12 questions done</p>
            </div>
          </div>
          <Button asChild size="sm" className="w-full bg-black/75 text-foreground hover:bg-black/85 border border-white/10">
            <Link to="/quiz">Continue Quiz</Link>
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.04 }} className={moduleCardClass}>
          <div className="flex items-center gap-2 mb-3 text-foreground">
            <TrendingUp className="w-4 h-4 text-arcadia-teal" />
            <span className="text-sm font-semibold">My Progress</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div className="glass rounded-xl py-2">
              <div className="text-lg font-bold text-arcadia-teal">{levelLabel}</div>
              <div className="text-[10px] text-muted-foreground">Current Tier</div>
            </div>
            <div className="glass rounded-xl py-2">
              <div className="text-lg font-bold text-foreground">{streakDays}d 🔥</div>
              <div className="text-[10px] text-muted-foreground">Streak</div>
            </div>
            <div className="glass rounded-xl py-2">
              <div className="text-lg font-bold text-foreground">{Math.max(0, avgScore)}</div>
              <div className="text-[10px] text-muted-foreground">XP Today</div>
            </div>
          </div>
          <div className="h-10 rounded-xl bg-[linear-gradient(180deg,rgba(34,211,238,0.16)_0%,rgba(34,211,238,0.03)_100%)] border border-white/10 mb-3 px-2 py-1">
            <svg viewBox="0 0 230 44" className="w-full h-full" preserveAspectRatio="none" role="img" aria-label="Progress trend">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-arcadia-teal"
                points={trendPoints}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-[11px] text-muted-foreground">{progressLabel}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }} className={moduleCardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-foreground">
              <Calendar className="w-4 h-4 text-arcadia-teal" />
              <span className="text-sm font-semibold">Upcoming Sessions</span>
            </div>
            <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/10 rounded-full px-2 py-0.5">Planner</span>
          </div>
          <div className="space-y-2 min-h-[140px]">
            {pendingTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">Generate your planner to schedule sessions.</p>
            ) : (
              pendingTasks.map((task) => (
                <div key={task.id} className="text-xs text-foreground bg-white/5 rounded-lg px-2.5 py-2 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate">{task.subject}</div>
                    <span className="text-[10px] text-muted-foreground bg-white/5 rounded-full px-2 py-0.5">Due</span>
                  </div>
                  <div className="text-muted-foreground truncate">{task.focus_topic || task.task_type}</div>
                  <div className="text-muted-foreground">{formatTaskTime(task.due_date)}</div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.12 }} className={moduleCardClass}>
          <div className="flex items-center gap-2 mb-3 text-foreground">
            <MessageSquare className="w-4 h-4 text-arcadia-teal" />
            <span className="text-sm font-semibold">AI Tutor Chat</span>
          </div>
          <div className="space-y-2">
            <div className="text-xs rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-muted-foreground">
              <span className="text-arcadia-teal">Tutor:</span> Ready to continue with your uploaded notes?
            </div>
            <div className="text-xs text-foreground text-right pr-1">Help me revise this topic and quiz me.</div>
            <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-2 py-1.5">
              <input
                value=""
                onChange={() => {}}
                placeholder="Type a message..."
                className="bg-transparent text-xs text-muted-foreground outline-none flex-1"
              />
              <Button asChild size="icon" className="h-7 w-7 rounded-full bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan">
                <Link to={documentCount > 0 ? "/chat" : "/notes"}>
                  <Send className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.16 }} className={moduleCardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-arcadia-teal" />
              <span className="text-sm font-semibold">Recent Notes</span>
            </div>
            <span className="text-muted-foreground">›</span>
          </div>
          <div className="space-y-2 min-h-[78px]">
            {recentNotes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No notes uploaded yet.</p>
            ) : (
              recentNotes.map((note) => (
                <div key={note} className="text-xs text-foreground bg-white/5 rounded-lg px-2.5 py-2 truncate flex items-center gap-2">
                  <span className="text-arcadia-teal">•</span>
                  <span className="truncate">{note}</span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.2 }} className={moduleCardClass}>
          <div className="flex items-center gap-2 mb-3 text-foreground">
            <Sparkles className="w-4 h-4 text-arcadia-teal" />
            <span className="text-sm font-semibold">New Study Module</span>
          </div>
          <p className="text-sm text-foreground">{pickSubjectBadge(leadTask?.subject || "General")} {leadTask?.subject || "General Study"}</p>
          <p className="text-xs text-muted-foreground mt-1">Master weak areas with guided exercises.</p>
          <p className="text-[10px] text-arcadia-purple mt-3">Study Module</p>
          <div className="mt-2 h-1 rounded-full bg-gradient-to-r from-[oklch(0.78_0.16_196)] to-[oklch(0.66_0.22_304)] opacity-80" />
          <p className="text-[11px] text-muted-foreground mt-2 truncate">{leadTaskTopic}</p>
          <Button asChild size="sm" className="mt-4 w-full bg-[#2296f3] text-white hover:bg-[#1f86da]">
            <Link to="/study">Start Module</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
