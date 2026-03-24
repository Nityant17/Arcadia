import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CloudUpload,
  Flame,
  MessageSquare,
  Sparkles,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

function formatTopicLabel(topic: string | undefined) {
  if (!topic?.trim()) return "General";
  return topic.replaceAll("_", " ");
}

function getMasteryColor(percent: number) {
  if (percent >= 80) return "text-arcadia-teal";
  if (percent >= 50) return "text-arcadia-cyan";
  return "text-arcadia-purple";
}

export default function HomePage() {
  const navigate = useNavigate();
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [recentNotes, setRecentNotes] = useState<
    Array<{
      id: string;
      name: string;
      subject: string;
      topic: string;
    }>
  >([]);
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    topicsMastered: 0,
    averageScore: 0,
    streak: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [docsResponse, dashboardResponse] = await Promise.all([
          apiClient.listDocuments(),
          apiClient.getDashboardStats(),
        ]);

        const docs = docsResponse.data.documents.slice(0, 3).map((doc) => ({
          id: doc.id,
          name: doc.original_name || doc.filename,
          subject: doc.subject || "General",
          topic: formatTopicLabel(doc.topic),
        }));

        const dashboardStats = dashboardResponse.data.stats;

        setRecentNotes(docs);
        setStats({
          totalQuizzes: dashboardStats.total_quizzes_taken,
          topicsMastered: dashboardStats.topics_mastered,
          averageScore: Math.round((dashboardStats.average_score || 0) * 100),
          streak: Math.max(0, dashboardStats.study_streak),
        });
      } catch {
        setRecentNotes([]);
        setStats({ totalQuizzes: 0, topicsMastered: 0, averageScore: 0, streak: 0 });
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const uploadFileToBackend = async (file: File) => {
    if (uploading) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("subject", "General");
    formData.append("topic", "");

    setUploading(true);
    try {
      const response = await apiClient.uploadDocument(formData);
      const newDoc = response.data;
      const newNote = {
        id: newDoc.id,
        name: newDoc.original_name || newDoc.filename,
        subject: newDoc.subject || "General",
        topic: formatTopicLabel(newDoc.topic),
      };

      setRecentNotes((prev) => [newNote, ...prev].slice(0, 3));
      toast.success("Uploaded successfully");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      setDragActive(false);
    }
  };

  const latestTopic = recentNotes[0]?.topic || "Core Concepts";
  const hasNotes = recentNotes.length > 0;
  const progress = Math.max(0, Math.min(100, stats.averageScore));
  const ringCircumference = 2 * Math.PI * 46;
  const ringOffset = ringCircumference - (progress / 100) * ringCircumference;
  const masteryColor = getMasteryColor(progress);

  const cardBaseClass =
    "rounded-3xl bg-slate-950/45 backdrop-blur-xl border border-white/10 p-6 transition-all duration-300 hover:scale-[1.01] hover:bg-slate-900/60 hover:border-cyan-400/35 hover:shadow-[inset_0px_0px_20px_rgba(6,182,212,0.15)]";

  const handleOmnibarSubmit = (value: string) => {
    if (!value.trim()) return;
    window.sessionStorage.setItem("arcadia:pending-chat-query", value.trim());
    void navigate({ to: "/chat" });
  };

  const handleDeleteRecentNote = async (id: string) => {
    if (deletingId) return;

    setDeletingId(id);
    try {
      await apiClient.deleteDocument(id);
      setRecentNotes((prev) => prev.filter((note) => note.id !== id));
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
      data-ocid="home.neon.page"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
            Welcome back, {currentUser?.name ?? "Scholar"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Control your notes, mastery, and challenges from one canvas.
          </p>
        </div>
      </div>

      <section className="mx-auto w-full max-w-5xl rounded-3xl border border-white/10 bg-slate-950/60 p-6 md:p-8 backdrop-blur-2xl transition-all focus-within:border-cyan-500/50 focus-within:shadow-[0_0_30px_rgba(6,182,212,0.2)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl md:text-2xl font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
            Command Center
          </h2>
          <Sparkles className="h-5 w-5 text-cyan-300" />
        </div>

        <PlaceholdersAndVanishInput
          placeholders={[
            "Ask Arcadia anything about your notes...",
            "Summarize chapter 3 in 6 bullets",
            "Generate a Tier 2 challenge from my weak topics",
          ]}
          onSubmit={handleOmnibarSubmit}
          className="mt-2"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.txt"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void uploadFileToBackend(file);
            }
          }}
        />

        <button
          type="button"
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) {
              void uploadFileToBackend(file);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 w-full rounded-2xl border border-dashed p-5 text-center transition-all ${
            dragActive
              ? "border-cyan-400/80 bg-cyan-500/10 shadow-[0_0_24px_rgba(6,182,212,0.28)]"
              : "border-white/20 bg-white/5 hover:border-cyan-400/50"
          }`}
        >
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_22px_rgba(6,182,212,0.22)]">
            <CloudUpload className="h-5 w-5 animate-pulse text-cyan-300" />
          </div>
          <p className="text-sm text-foreground">
            Ask Arcadia a question, or drop a PDF here to begin.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {uploading ? "Uploading..." : "Drop file or click to upload"}
          </p>
        </button>
      </section>

      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 auto-rows-[minmax(190px,auto)]"
        variants={{
          hidden: {},
          show: {
            transition: {
              staggerChildren: 0.1,
            },
          },
        }}
        initial="hidden"
        animate="show"
      >
        <motion.section
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
          }}
          className={`${cardBaseClass} lg:col-span-2`}
          data-ocid="home.bento.recent-activity"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              Recent Notes
            </h3>
            <Button
              asChild
              className="rounded-full border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all"
            >
              <Link to={hasNotes ? "/chat" : "/notes"}>
                <MessageSquare className="h-4 w-4 mr-1" />
                Chat Now
              </Link>
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {(loading ? [1, 2, 3] : recentNotes).map((note) => {
              if (typeof note === "number") {
                return (
                  <div key={note} className="h-14 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
                );
              }

              return (
                <div
                  key={note.id}
                  className="group flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 transition-all duration-300 hover:scale-[1.01] hover:border-cyan-400/35 hover:bg-slate-900/60 hover:shadow-[inset_0px_0px_20px_rgba(6,182,212,0.15)]"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-medium text-foreground">{note.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] break-words">
                      {note.subject} · {note.topic}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteRecentNote(note.id);
                    }}
                    disabled={deletingId === note.id}
                    className="uiverse-delete-button uiverse-delete-button--xs shrink-0 disabled:opacity-50"
                    aria-label={`Delete ${note.name}`}
                    data-ocid={`home.recent.delete.${note.id}`}
                  >
                    <Trash2 className="uiverse-delete-icon" />
                  </button>
                </div>
              );
            })}

            {!loading && recentNotes.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/20 bg-slate-950/40 px-4 py-6 text-center">
                <MessageSquare className="mx-auto mb-2 h-5 w-5 text-cyan-300/60 drop-shadow-[0_0_14px_rgba(6,182,212,0.3)]" />
                <p className="text-sm text-muted-foreground">
                  No recent notes yet. Upload your first document to unlock AI chat.
                </p>
              </div>
            )}
          </div>
        </motion.section>

        <motion.section
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
          }}
          className={`${cardBaseClass} lg:col-span-1`}
          data-ocid="home.bento.mastery"
        >
          <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
            Overall Mastery
          </h3>
          <div className="mt-4 flex items-center justify-center">
            <svg
              className={`h-36 w-36 ${masteryColor}`}
              viewBox="0 0 120 120"
              role="img"
              aria-label="Overall Mastery progress ring"
            >
              <circle cx="60" cy="60" r="46" className="fill-none stroke-white/10" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="46"
                className="fill-none stroke-current transition-all duration-500"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="56" textAnchor="middle" className="fill-white text-[20px] font-semibold">
                {progress}%
              </text>
              <text x="60" y="73" textAnchor="middle" className="fill-white/60 text-[10px]">
                mastery
              </text>
            </svg>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className={`mt-1 text-lg font-semibold ${masteryColor}`}>
              {progress >= 75 ? "Strong" : progress >= 45 ? "Growing" : "Warming Up"}
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm text-foreground">
              <Flame className="h-4 w-4 text-arcadia-purple" />
              <span>{stats.streak} day streak</span>
            </div>
          </div>
        </motion.section>

        <motion.section
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
          }}
          className={`${cardBaseClass} lg:col-span-3 overflow-hidden relative`}
          data-ocid="home.bento.quiz-shortcut"
        >
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
                Quick Actions / Daily Challenge
              </h3>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                Focused on {latestTopic}. Push your retention with a short adaptive quiz or jump into a study module.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                {stats.topicsMastered} topics mastered
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                {stats.totalQuizzes} quizzes completed
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              asChild
              className="rounded-full border border-cyan-500/40 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30 hover:shadow-[0_0_24px_rgba(6,182,212,0.28)] transition-all"
            >
              <Link to="/quiz">
                Start Challenge
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              className="rounded-full border border-blue-500/40 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30 hover:shadow-[0_0_24px_rgba(37,99,235,0.28)] transition-all"
            >
              <Link to="/study">Start Module</Link>
            </Button>
          </div>
        </motion.section>
      </motion.div>
    </motion.div>
  );
}
