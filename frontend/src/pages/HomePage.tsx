import { ArcadiaHero } from "@/components/ui/ArcadiaHero";
import { Flashcard } from "@/components/ui/Flashcard";
import { LampContainer } from "@/components/ui/lamp";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { QuickToolsGrid, type QuickToolId } from "@/components/ui/QuickToolsGrid";
import { TaskChecklist } from "@/components/ui/TaskChecklist";
import { Button } from "@/components/ui/button";
import { getPinnedFlashcards, togglePinnedFlashcard, type PinnedFlashcardItem } from "@/lib/pinnedFlashcards";
import { apiClient, getApiErrorMessage, type PlannerTask } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { useTimer } from "@/context/TimerContext";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, CloudUpload, MessageSquare, Star, Trash2, X, Play, Pause, RotateCcw, CheckCircle } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { toast } from "sonner";

function formatTopicLabel(topic: string | undefined) {
  if (!topic?.trim()) return "General";
  return topic.replaceAll("_", " ");
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

const StyledNextStepButton = styled.div`
  .animated-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 13px 30px;
    border: 4px solid;
    border-color: transparent;
    font-size: 15px;
    background-color: inherit;
    border-radius: 100px;
    font-weight: 600;
    color: #67e8f9;
    box-shadow: 0 0 0 2px rgba(103, 232, 249, 0.9);
    cursor: pointer;
    overflow: hidden;
    transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button svg {
    position: absolute;
    width: 24px;
    fill: #67e8f9;
    z-index: 9;
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button .arr-1 {
    right: 16px;
  }

  .animated-button .arr-2 {
    left: -25%;
  }

  .animated-button .circle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    background-color: #22d3ee;
    border-radius: 50%;
    opacity: 0;
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button .text {
    position: relative;
    z-index: 1;
    transform: translateX(-12px);
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button:hover {
    box-shadow: 0 0 0 12px transparent;
    color: #082f49;
    border-radius: 12px;
  }

  .animated-button:hover .arr-1 {
    right: -25%;
  }

  .animated-button:hover .arr-2 {
    left: 16px;
  }

  .animated-button:hover .text {
    transform: translateX(12px);
  }

  .animated-button:hover svg {
    fill: #082f49;
  }

  .animated-button:active {
    scale: 0.95;
    box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.8);
  }

  .animated-button:hover .circle {
    width: 220px;
    height: 220px;
    opacity: 1;
  }
`;

export default function HomePage() {
  const navigate = useNavigate();
  const { currentLanguage } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [quickToolBusy, setQuickToolBusy] = useState<QuickToolId | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [recentNotes, setRecentNotes] = useState<
    Array<{
      id: string;
      representativeDocId: string;
      documentIds: string[];
      name: string;
      subject: string;
      topic: string;
      count: number;
    }>
  >([]);
  const [askableNotes, setAskableNotes] = useState<Array<{ id: string; name: string; documentId: string; count: number }>>([]);
  const [selectedAskNoteId, setSelectedAskNoteId] = useState("");
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    topicsMastered: 0,
    averageScore: 0,
    streak: 0,
  });
  const [pinnedFlashcards, setPinnedFlashcards] = useState<PinnedFlashcardItem[]>([]);
  const [isDailyGoalsEditing, setIsDailyGoalsEditing] = useState(false);
  const [showNextSteps, setShowNextSteps] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasNotes = recentNotes.length > 0;
  const mapDocumentsToNotes = (documents: Array<{ id: string; note_id: string; note_title?: string; original_name: string; filename: string; subject: string; topic: string }>) => {
    const grouped = new Map<string, {
      id: string;
      representativeDocId: string;
      documentIds: string[];
      name: string;
      subject: string;
      topic: string;
      count: number;
    }>();

    for (const doc of documents) {
      const noteId = doc.note_id || doc.id;
      const existing = grouped.get(noteId);
      if (!existing) {
        grouped.set(noteId, {
          id: noteId,
          representativeDocId: doc.id,
          documentIds: [doc.id],
          name: doc.note_title || doc.topic || doc.original_name || doc.filename,
          subject: doc.subject || "General",
          topic: formatTopicLabel(doc.topic),
          count: 1,
        });
        continue;
      }
      existing.documentIds.push(doc.id);
      existing.count += 1;
    }

    return Array.from(grouped.values());
  };

  // --- TASKS & TIMER STATE ---
  const [todayTasks, setTodayTasks] = useState<PlannerTask[]>([]);
  const { timeLeft, isRunning, start, pause, reset, setTime } = useTimer();
  const [customHours, setCustomHours] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  useEffect(() => {
    const loadData = async () => {
      try {
        const [docsResponse, dashboardResponse, plannerResponse] = await Promise.all([
          apiClient.listDocuments(),
          apiClient.getDashboardStats(),
          apiClient.getPlannerTasks().catch(() => ({ data: { tasks: [] } })), 
        ]);

        const allNotes = mapDocumentsToNotes(docsResponse.data.documents);
        const docs = allNotes.slice(0, 3);

        const dashboardStats = dashboardResponse.data.stats;

        setRecentNotes(docs);
        setAskableNotes(allNotes.map((doc) => ({
          id: doc.id,
          name: doc.name,
          documentId: doc.representativeDocId,
          count: doc.count,
        })));
        setSelectedAskNoteId((previousSelectedId) => {
          if (!allNotes.length) return "";
          if (previousSelectedId && allNotes.some((doc) => doc.id === previousSelectedId)) {
            return previousSelectedId;
          }
          return allNotes[0].id;
        });
        setStats({
          totalQuizzes: dashboardStats.total_quizzes_taken,
          topicsMastered: dashboardStats.topics_mastered,
          averageScore: Math.round((dashboardStats.average_score || 0) * 100),
          streak: Math.max(0, dashboardStats.study_streak),
        });

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

        const tasksForToday = (plannerResponse.data?.tasks || [])
          .filter((task: PlannerTask) => task.status === "pending")
          .filter((task: PlannerTask) => {
            const due = new Date(task.due_date).getTime();
            return !Number.isNaN(due) && due >= startOfToday && due <= endOfToday;
          })
          .sort((a: PlannerTask, b: PlannerTask) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

        setTodayTasks(tasksForToday);

      } catch {
        setRecentNotes([]);
        setAskableNotes([]);
        setSelectedAskNoteId("");
        setStats({ totalQuizzes: 0, topicsMastered: 0, averageScore: 0, streak: 0 });
      } finally {
        setPinnedFlashcards(getPinnedFlashcards());
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const handleCustomTimerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseInt(customHours) || 0;
    const m = parseInt(customMinutes) || 0;
    
    if (h > 0 || m > 0) {
      setTime((h * 3600) + (m * 60));
      setCustomHours("");
      setCustomMinutes("");
    }
  };

  const uploadFileToBackend = async (file: File) => {
    if (uploading) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("subject", "General");
    formData.append("topic", "");

    setUploading(true);
    try {
      const response = await apiClient.uploadDocument(formData);
      const allDocs = await apiClient.listDocuments();
      const allNotes = mapDocumentsToNotes(allDocs.data.documents);
      setRecentNotes(allNotes.slice(0, 3));
      setAskableNotes(allNotes.map((doc) => ({
        id: doc.id,
        name: doc.name,
        documentId: doc.representativeDocId,
        count: doc.count,
      })));
      setSelectedAskNoteId(response.data.note_id || response.data.id);
      setShowNextSteps(true);
      toast.success("Uploaded successfully");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Upload failed"));
    } finally {
      setUploading(false);
      setDragActive(false);
    }
  };

  const handleOmnibarSubmit = (value: string) => {
    if (!value.trim()) return;
    window.sessionStorage.setItem("arcadia:pending-chat-query", value.trim());
    if (selectedAskNoteId) {
      window.sessionStorage.setItem("arcadia:pending-chat-document-id", selectedAskNoteId);
    } else {
      window.sessionStorage.removeItem("arcadia:pending-chat-document-id");
    }
    void navigate({ to: "/chat" });
  };

  const handleDeleteRecentNote = async (id: string) => {
    if (deletingId) return;

    setDeletingId(id);
    try {
      const target = recentNotes.find((note) => note.id === id);
      if (!target) {
        setDeletingId(null);
        return;
      }
      await Promise.all(target.documentIds.map((docId) => apiClient.deleteDocument(docId)));
      setRecentNotes((prev) => prev.filter((note) => note.id !== id));
      setAskableNotes((prev) => {
        const remainingNotes = prev.filter((note) => note.id !== id);
        setSelectedAskNoteId((previousSelectedId) => {
          if (previousSelectedId !== id) return previousSelectedId;
          return remainingNotes[0]?.id ?? "";
        });
        return remainingNotes;
      });
      toast.success("Note deleted");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete note"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePinnedFlashcard = (card: PinnedFlashcardItem) => {
    togglePinnedFlashcard(card);
    setPinnedFlashcards(getPinnedFlashcards());
  };

  const handleQuickToolClick = async (toolId: QuickToolId) => {
    if (quickToolBusy) return;

    const requireDocument = () => {
        if (!selectedAskNoteId) {
          toast.error("Upload and select a note first");
          return null;
        }
        return selectedAskNoteId;
    };

    if (toolId === "upload") {
      fileInputRef.current?.click();
      return;
    }

    if (toolId === "ask") {
      handleOmnibarSubmit("Summarize my selected note");
      return;
    }

    if (toolId === "quiz") {
      if (!askableNotes.length) {
        toast.error("Upload a note before starting a quiz");
        void navigate({ to: "/notes" });
        return;
      }
      void navigate({ to: "/quiz" });
      return;
    }

    if (toolId === "study") {
      if (!askableNotes.length) {
        toast.error("Upload a note before opening study tools");
        void navigate({ to: "/notes" });
        return;
      }
      void navigate({ to: "/study" });
      return;
    }

    if (toolId === "planner") {
      void navigate({ to: "/planner" });
      return;
    }

    if (toolId === "challenge") {
      if (!askableNotes.length) {
        toast.error("Upload a note before starting a challenge");
        void navigate({ to: "/notes" });
        return;
      }
      void navigate({ to: "/challenge" });
      return;
    }

    if (toolId === "dashboard") {
      void navigate({ to: "/dashboard" });
      return;
    }

    if (toolId === "code") {
      void navigate({ to: "/code" });
      return;
    }

    if (toolId === "notes") {
      void navigate({ to: "/notes" });
      return;
    }

    const docId = requireDocument();
    if (!docId) return;
  };

  const suggestionPills = [
    "Summarize",
    "Explain in Simple Terms",
    "Give me probable interview questions",
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
        {/* ROW 1 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <motion.section variants={cardVariants} className={`${rowCardClass} md:col-span-2`}>
            <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              Ask Arcadia
            </h2>

            <PlaceholdersAndVanishInput
              placeholders={[
                "Ask Arcadia anything about your notes...",
                "Summarize chapter 3 in 6 bullets",
                "Explain this concept like I’m a beginner",
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

            <div className="mt-4">
              {askableNotes.length > 0 ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2.5">
                  <label
                    htmlFor="ask-note-select"
                    className="mb-1.5 block text-[11px] uppercase tracking-wide text-cyan-300/80"
                  >
                    Ask about note
                  </label>
                  <div className="relative">
                    <select
                      id="ask-note-select"
                      value={selectedAskNoteId}
                      onChange={(event) => setSelectedAskNoteId(event.target.value)}
                      className="w-full appearance-none rounded-lg border border-white/10 bg-slate-900/70 px-3 pr-10 py-2 text-sm text-foreground outline-none transition-all focus:border-cyan-500/50 focus:shadow-[0_0_0_2px_rgba(6,182,212,0.18)]"
                    >
                      {askableNotes.map((note) => (
                        <option key={note.id} value={note.id}>
                          {note.name} ({note.count})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/30 px-3 py-2 text-xs text-muted-foreground">
                  Upload a note to choose a source before asking.
                </div>
              )}
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
              disabled={uploading}
              className={`uiverse-cloud-upload-zone mt-4 ${dragActive ? "uiverse-cloud-upload-zone--active" : ""}`}
            >
              {uploading ? (
                <div className="uiverse-wheel-and-hamster-wrap">
                  <div
                    aria-label="Upload in progress"
                    role="img"
                    className="uiverse-wheel-and-hamster"
                  >
                    <div className="uiverse-wheel" />
                    <div className="uiverse-hamster">
                      <div className="uiverse-hamster__body">
                        <div className="uiverse-hamster__head">
                          <div className="uiverse-hamster__ear" />
                          <div className="uiverse-hamster__eye" />
                          <div className="uiverse-hamster__nose" />
                        </div>
                        <div className="uiverse-hamster__limb uiverse-hamster__limb--fr" />
                        <div className="uiverse-hamster__limb uiverse-hamster__limb--fl" />
                        <div className="uiverse-hamster__limb uiverse-hamster__limb--br" />
                        <div className="uiverse-hamster__limb uiverse-hamster__limb--bl" />
                        <div className="uiverse-hamster__tail" />
                      </div>
                    </div>
                    <div className="uiverse-spoke" />
                  </div>
                </div>
              ) : (
                <div className="uiverse-cloud-upload-icon-wrap">
                  <CloudUpload className="uiverse-cloud-upload-icon" />
                </div>
              )}
              {uploading ? (
                <p className="text-base font-semibold text-cyan-300">Uploading...</p>
              ) : (
                <>
                  <p className="text-sm text-foreground">Drop file here or click to upload</p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF, image, or text file</p>
                </>
              )}
            </button>
          </motion.section>

          <motion.section
            variants={cardVariants}
            className={`${rowCardClass} md:col-span-1 relative overflow-visible flex flex-col items-center justify-center`}
          >
            <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              Utilities
            </h2>
            <div className="relative z-10 mt-4 flex items-center justify-center">
              <QuickToolsGrid onToolClick={(toolId) => void handleQuickToolClick(toolId)} disabled={uploading || quickToolBusy !== null} />
            </div>
          </motion.section>
        </div>

        {/* ROW 2 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
                        {note.subject} · {note.count} file{note.count > 1 ? "s" : ""} · {note.topic}
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
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
                Daily Goals
              </h2>
              <button
                type="button"
                onClick={() => setIsDailyGoalsEditing((previous) => !previous)}
                className="rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2 py-1 text-xs text-cyan-200 transition-all hover:bg-cyan-500/25 hover:shadow-[0_0_16px_rgba(6,182,212,0.25)]"
              >
                {isDailyGoalsEditing ? "Done" : "Edit"}
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 pl-8">
              <TaskChecklist isEditing={isDailyGoalsEditing} />
            </div>
          </motion.section>
        </div>

        {/* --- NEW ROW: Timer & Things To Do Today --- */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          
          {/* TIMER */}
          <motion.section variants={cardVariants} className={`${rowCardClass} md:col-span-1 flex flex-col`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
                Focus Timer
              </h2>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center space-y-5 py-2">
              <div className="text-4xl font-mono text-foreground font-light tracking-wider drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full border-cyan-500/30 bg-cyan-500/10 w-12 h-12 hover:bg-cyan-500/20 text-cyan-400 transition-all"
                  onClick={isRunning ? pause : start}
                >
                  {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-1" />}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full border-white/10 w-10 h-10 hover:bg-white/10 text-white"
                  onClick={reset}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              {/* Custom H/M Timer Controls */}
              <div className="flex items-center justify-center w-full pt-4 border-t border-white/10">
                <form
                  onSubmit={handleCustomTimerSubmit}
                  className="flex items-center gap-2"
                >
                  <div className="flex items-center bg-white/5 rounded-lg border border-white/5 hover:border-cyan-500/30 focus-within:border-cyan-500/50 transition-all px-3 py-1.5">
                    <input
                      type="number"
                      placeholder="0"
                      value={customHours}
                      onChange={(e) => setCustomHours(e.target.value)}
                      className="w-8 bg-transparent text-sm text-center text-foreground outline-none placeholder:text-muted-foreground/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min="0"
                    />
                    <span className="text-xs text-muted-foreground mr-2 font-medium">h</span>
                    
                    <div className="w-[1px] h-4 bg-white/15 mr-2" />
                    
                    <input
                      type="number"
                      placeholder="0"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      className="w-8 bg-transparent text-sm text-center text-foreground outline-none placeholder:text-muted-foreground/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min="0"
                      max="59"
                    />
                    <span className="text-xs text-muted-foreground font-medium">m</span>
                  </div>
                  
                  <button
                    type="submit"
                    className="px-3 py-2 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-xs font-semibold transition-all shadow-[0_0_10px_rgba(6,182,212,0.1)] hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                  >
                    Set
                  </button>
                </form>
              </div>
            </div>
          </motion.section>

          {/* THINGS TO DO TODAY */}
          <motion.section variants={cardVariants} className={`${rowCardClass} md:col-span-3 flex flex-col`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
                Things To Do Today
              </h2>
              <Button
                asChild
                className="rounded-full border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all"
              >
                <Link to="/planner">Open Planner</Link>
              </Button>
            </div>

            {/* Custom Scrollbar applied here */}
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[220px] pr-2 
              [&::-webkit-scrollbar]:w-1.5 
              [&::-webkit-scrollbar-track]:bg-transparent 
              [&::-webkit-scrollbar-thumb]:bg-cyan-500/20 
              [&::-webkit-scrollbar-thumb]:rounded-full 
              hover:[&::-webkit-scrollbar-thumb]:bg-cyan-500/40 
              transition-all"
            >
              {loading ? (
                [1, 2].map(i => <div key={i} className="h-14 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />)
              ) : todayTasks.length > 0 ? (
                todayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="group flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 transition-all duration-300 hover:border-cyan-400/35 hover:bg-slate-900/60"
                  >
                    <div className="min-w-0 pr-3 flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-cyan-500/50 shrink-0" />
                      <div>
                        <p className="line-clamp-1 text-sm font-medium text-foreground">
                          {task.subject} {task.focus_topic ? `· ${task.focus_topic}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(task.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {task.task_type.replaceAll("_", " ")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-8 text-center h-full flex flex-col items-center justify-center">
                  <CheckCircle className="mx-auto mb-2 h-6 w-6 text-cyan-300/60 drop-shadow-[0_0_14px_rgba(6,182,212,0.3)]" />
                  <p className="text-sm text-muted-foreground">
                    No tasks scheduled for today. You're all caught up!
                  </p>
                </div>
              )}
            </div>
          </motion.section>
        </div>

        {/* ROW 3: Pinned Flashcards */}
        <motion.section variants={cardVariants} className={rowCardClass}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              Pinned Flashcards
            </h2>
            <Button
              asChild
              className="rounded-full border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all"
            >
              <Link to="/study">Open Study Materials</Link>
            </Button>
          </div>

          {pinnedFlashcards.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 place-items-center">
              {pinnedFlashcards.slice(0, 6).map((card) => (
                <Flashcard
                  key={card.id}
                  question={card.question}
                  answer={card.answer}
                  isPinned
                  onPin={() => handleTogglePinnedFlashcard(card)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/20 bg-slate-950/40 px-4 py-6 text-center">
              <Star className="mx-auto mb-2 h-5 w-5 text-yellow-300/70" />
              <p className="text-sm text-muted-foreground">
                Star flashcards in Study and they’ll appear here.
              </p>
            </div>
          )}
        </motion.section>
      </motion.div>

      {showNextSteps && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          data-ocid="home.next-steps.panel"
        >
          <LampContainer
            className="w-[min(94vw,560px)] min-h-[310px] rounded-2xl border border-cyan-500/30 bg-slate-950/95 shadow-[0_0_36px_rgba(6,182,212,0.28)]"
            contentClassName="absolute inset-0 z-50 flex translate-y-0 items-start justify-center px-6 pt-8 pb-10"
          >
            <button
              type="button"
              onClick={() => setShowNextSteps(false)}
              className="absolute right-3 top-3 z-30 rounded-md border border-white/10 bg-white/5 p-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close next steps"
              data-ocid="home.next-steps.close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto flex w-full max-w-[430px] flex-col text-center">
              <div className="flex flex-col gap-1">
                <h3 className="text-4xl font-semibold text-cyan-100">Things to do next…</h3>
                <p className="text-lg text-cyan-100/85">Your note is ready. Pick the next step.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <StyledNextStepButton>
                  <Link to="/chat" data-ocid="home.next-steps.chat" className="animated-button">
                    <svg viewBox="0 0 24 24" className="arr-2" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
                    </svg>
                    <span className="text">Chat</span>
                    <span className="circle" />
                    <svg viewBox="0 0 24 24" className="arr-1" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
                    </svg>
                  </Link>
                </StyledNextStepButton>

                <StyledNextStepButton>
                  <Link to="/quiz" data-ocid="home.next-steps.quiz" className="animated-button">
                    <svg viewBox="0 0 24 24" className="arr-2" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
                    </svg>
                    <span className="text">Quiz</span>
                    <span className="circle" />
                    <svg viewBox="0 0 24 24" className="arr-1" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
                    </svg>
                  </Link>
                </StyledNextStepButton>

                <StyledNextStepButton>
                  <Link to="/study" data-ocid="home.next-steps.study" className="animated-button">
                    <svg viewBox="0 0 24 24" className="arr-2" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
                    </svg>
                    <span className="text">Study</span>
                    <span className="circle" />
                    <svg viewBox="0 0 24 24" className="arr-1" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
                    </svg>
                  </Link>
                </StyledNextStepButton>

                <StyledNextStepButton>
                  <Link to="/planner" data-ocid="home.next-steps.planner" className="animated-button">
                    <svg viewBox="0 0 24 24" className="arr-2" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
                    </svg>
                    <span className="text">Plan</span>
                    <span className="circle" />
                    <svg viewBox="0 0 24 24" className="arr-1" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
                    </svg>
                  </Link>
                </StyledNextStepButton>
              </div>
            </div>
          </LampContainer>
        </motion.div>
      )}
    </motion.div>
  );
}
