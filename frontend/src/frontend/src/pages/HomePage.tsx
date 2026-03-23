import { MacbookScroll } from "@/components/ui/macbook-scroll";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CloudUpload,
  Flame,
  Image,
  MessageSquare,
  Sparkles,
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

function NeonBadgeLogo() {
  return (
    <div className="h-10 w-10 -rotate-12 rounded-xl bg-cyan-400/20 border border-cyan-300/40 shadow-[0_0_14px_rgba(6,182,212,0.35)]" />
  );
}

export default function HomePage() {
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
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
    "rounded-3xl bg-slate-950/40 backdrop-blur-xl border border-white/10 p-6 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all";

  return (
    <div className="space-y-5" data-ocid="home.neon.page">
      <MacbookScroll
        title={
          <span>
            Arcadia RAG Pipeline Workspace
            <br />
            Grounded tutoring from your real notes.
          </span>
        }
        badge={<NeonBadgeLogo />}
        src="/chat-preview.webp"
        showGradient={false}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
            Welcome back, {currentUser?.name ?? "Scholar"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Control your notes, mastery, and challenges from one canvas.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 auto-rows-[minmax(190px,auto)]">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          whileHover={{ scale: 1.01, y: -3 }}
          className={`${cardBaseClass} lg:col-span-2`}
          data-ocid="home.bento.search"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              Ask Arcadia
            </h2>
            <Sparkles className="h-5 w-5 text-arcadia-teal" />
          </div>

          <PlaceholdersAndVanishInput
            placeholders={[
              "Ask Arcadia anything about your notes...",
              "Summarize chapter 3 in 6 bullets",
              "Generate a Tier 2 challenge from my weak topics",
            ]}
            onSubmit={() => {
              toast.info("Search prompt captured. Open Chat to run it.");
            }}
            className="mt-5"
          />

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
              {stats.topicsMastered} topics mastered
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
              {stats.totalQuizzes} quizzes completed
            </span>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          whileHover={{ scale: 1.01, y: -3 }}
          className={`${cardBaseClass} flex flex-col gap-4 min-h-[260px]`}
          data-ocid="home.bento.quick-upload"
        >
          <div>
            <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              Quick Upload
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag & drop PDFs/images into Arcadia.
            </p>
          </div>

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
            className={`rounded-2xl border border-dashed p-4 text-left transition-all min-h-[150px] flex flex-col items-center justify-center ${
              dragActive
                ? "border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.35)] bg-cyan-500/10"
                : "border-white/20 bg-white/5 hover:border-cyan-400/50"
            }`}
          >
            <div className="mb-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 p-2 text-cyan-300">
              <CloudUpload className="h-5 w-5" />
            </div>
            <div className="text-sm text-foreground text-center min-h-8">
              <span>{uploading ? "Uploading..." : "Drop files here or click to upload"}</span>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Image className="h-3.5 w-3.5" />
              <span>PDF, PNG, JPG, TXT</span>
            </div>
          </button>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          whileHover={{ scale: 1.01, y: -3 }}
          className={`${cardBaseClass} lg:row-span-2`}
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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          whileHover={{ scale: 1.01, y: -3 }}
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
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{note.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5">
                        {note.subject}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5">
                        {note.topic}
                      </span>
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className="rounded-full border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all"
                  >
                    <Link to="/chat">Chat Now</Link>
                  </Button>
                </div>
              );
            })}

            {!loading && recentNotes.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-muted-foreground">
                No recent notes yet. Upload your first document to unlock AI chat.
              </div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          whileHover={{ scale: 1.02, y: -4 }}
          className={`${cardBaseClass} lg:col-span-2 overflow-hidden relative`}
          data-ocid="home.bento.quiz-shortcut"
        >
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
          <h3 className="text-xl font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
            Ready for a Tier 2 Challenge?
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Focused on {latestTopic}. Push your retention with a short adaptive quiz.
          </p>

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
      </div>

    </div>
  );
}
