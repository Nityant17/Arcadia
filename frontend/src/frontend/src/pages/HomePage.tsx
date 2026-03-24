import { ArcadiaHero } from "@/components/ui/ArcadiaHero";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { QuickActionsOrb } from "@/components/ui/QuickActionsOrb";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { Link, useNavigate } from "@tanstack/react-router";
import { CloudUpload, Flame, MessageSquare, Trash2 } from "lucide-react";
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

const rowCardClass =
  "rounded-3xl p-6 bg-slate-950/40 backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 transition-all";

const gridVariants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.2,
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

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

  const hasNotes = recentNotes.length > 0;
  const progress = Math.max(0, Math.min(100, stats.averageScore));
  const ringCircumference = 2 * Math.PI * 46;
  const ringOffset = ringCircumference - (progress / 100) * ringCircumference;
  const masteryColor = getMasteryColor(progress);

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

  const suggestionPills = [
    "Summarize last note",
    "Test my knowledge",
    currentUser?.name ? `Plan study session for ${currentUser.name}` : "Build a quick study plan",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
      data-ocid="home.pure-hero.page"
    >
      <ArcadiaHero />

      <motion.div variants={gridVariants} initial="hidden" animate="show" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <motion.section variants={cardVariants} className={`${rowCardClass} md:col-span-2`}>
            <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              Ask Arcadia
            </h2>

            <PlaceholdersAndVanishInput
              placeholders={[
                "Ask Arcadia anything about your notes...",
                "Summarize chapter 3 in 6 bullets",
                "Generate a quiz from my weakest topic",
              ]}
              onSubmit={handleOmnibarSubmit}
              className="mt-4"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {suggestionPills.map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => handleOmnibarSubmit(pill)}
                  className="text-xs text-cyan-400 bg-cyan-950/30 border border-cyan-500/30 rounded-full px-3 py-1 hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
                >
                  {pill}
                </button>
              ))}
            </div>
          </motion.section>

          <motion.section variants={cardVariants} className={`${rowCardClass} md:col-span-1`}>
            <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              Quick Upload
            </h2>

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
              className={`uiverse-cloud-upload-zone mt-4 ${dragActive ? "uiverse-cloud-upload-zone--active" : ""}`}
            >
              <div className="uiverse-cloud-upload-icon-wrap">
                <CloudUpload className="uiverse-cloud-upload-icon" />
              </div>
              <p className="text-sm text-foreground">Drop file here or click to upload</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {uploading ? "Uploading..." : "PDF, image, or text file"}
              </p>
            </button>
          </motion.section>

          <motion.section variants={cardVariants} className={`${rowCardClass} md:col-span-1 relative overflow-hidden`}>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-28 w-28 rounded-full bg-cyan-500/10 blur-2xl animate-pulse" />
            </div>
            <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              Workspace
            </h2>
            <div className="relative z-10 mt-4 flex items-center justify-center">
              <QuickActionsOrb />
            </div>
          </motion.section>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.section variants={cardVariants} className={`${rowCardClass} md:col-span-3`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
                Recent Notes
              </h2>
              <Button
                asChild
                className="rounded-full border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all"
              >
                <Link to={hasNotes ? "/chat" : "/notes"}>
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Open
                </Link>
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {(loading ? [1, 2, 3] : recentNotes).map((note) => {
                if (typeof note === "number") {
                  return (
                    <div
                      key={note}
                      className="h-14 rounded-2xl border border-white/10 bg-white/5 animate-pulse"
                    />
                  );
                }

                return (
                  <div
                    key={note.id}
                    className="group flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 transition-all duration-300 hover:border-cyan-400/35 hover:bg-slate-900/60 hover:shadow-[inset_0px_0px_20px_rgba(6,182,212,0.15)]"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="line-clamp-2 text-sm font-medium text-foreground break-words">
                        {note.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
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

          <motion.section variants={cardVariants} className={`${rowCardClass} md:col-span-1`}>
            <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              Overall Mastery
            </h2>

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
              <p className="mt-2 text-xs text-muted-foreground">
                {stats.topicsMastered} topics mastered · {stats.totalQuizzes} quizzes completed
              </p>
            </div>
          </motion.section>
        </div>
      </motion.div>
    </motion.div>
  );
}
