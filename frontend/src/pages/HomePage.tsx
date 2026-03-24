import { ArcadiaHero } from "@/components/ui/ArcadiaHero";
import { Flashcard } from "@/components/ui/Flashcard";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { QuickToolsGrid, type QuickToolId } from "@/components/ui/QuickToolsGrid";
import { TaskChecklist } from "@/components/ui/TaskChecklist";
import { Button } from "@/components/ui/button";
import { getPinnedFlashcards, togglePinnedFlashcard, type PinnedFlashcardItem } from "@/lib/pinnedFlashcards";
import { apiClient } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { Link, useNavigate } from "@tanstack/react-router";
import { CloudUpload, MessageSquare, Star, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
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
      name: string;
      subject: string;
      topic: string;
    }>
  >([]);
  const [askableNotes, setAskableNotes] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedAskNoteId, setSelectedAskNoteId] = useState("");
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    topicsMastered: 0,
    averageScore: 0,
    streak: 0,
  });
  const [pinnedFlashcards, setPinnedFlashcards] = useState<PinnedFlashcardItem[]>([]);
  const [isDailyGoalsEditing, setIsDailyGoalsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [docsResponse, dashboardResponse] = await Promise.all([
          apiClient.listDocuments(),
          apiClient.getDashboardStats(),
        ]);

        const allDocs = docsResponse.data.documents.map((doc) => ({
          id: doc.id,
          name: doc.original_name || doc.filename,
          subject: doc.subject || "General",
          topic: formatTopicLabel(doc.topic),
        }));
        const docs = allDocs.slice(0, 3);

        const dashboardStats = dashboardResponse.data.stats;

        setRecentNotes(docs);
        setAskableNotes(allDocs.map((doc) => ({ id: doc.id, name: doc.name })));
        setSelectedAskNoteId((previousSelectedId) => {
          if (!allDocs.length) return "";
          if (previousSelectedId && allDocs.some((doc) => doc.id === previousSelectedId)) {
            return previousSelectedId;
          }
          return allDocs[0].id;
        });
        setStats({
          totalQuizzes: dashboardStats.total_quizzes_taken,
          topicsMastered: dashboardStats.topics_mastered,
          averageScore: Math.round((dashboardStats.average_score || 0) * 100),
          streak: Math.max(0, dashboardStats.study_streak),
        });
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
      await apiClient.deleteDocument(id);
      setRecentNotes((prev) => prev.filter((note) => note.id !== id));
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
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

    const docId = requireDocument();
    if (!docId) return;

    if (toolId === "topics") {
      setQuickToolBusy(toolId);
      try {
        const response = await apiClient.extractTopics(docId, true);
        toast.success(`Extracted ${response.data.topics.length} topics`);
      } catch {
        toast.error("Failed to extract topics");
      } finally {
        setQuickToolBusy(null);
      }
      return;
    }

    if (toolId === "cheatsheet") {
      setQuickToolBusy(toolId);
      try {
        await apiClient.generateCheatsheet(
          {
            document_id: docId,
            language: currentLanguage?.id ?? "en",
            focus_topic: "",
          },
          true,
        );
        toast.success("Cheatsheet generated. Opening Study.");
        void navigate({ to: "/study" });
      } catch {
        toast.error("Failed to generate cheatsheet");
      } finally {
        setQuickToolBusy(null);
      }
    }
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
                  <select
                    id="ask-note-select"
                    value={selectedAskNoteId}
                    onChange={(event) => setSelectedAskNoteId(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-foreground outline-none transition-all focus:border-cyan-500/50 focus:shadow-[0_0_0_2px_rgba(6,182,212,0.18)]"
                  >
                    {askableNotes.map((note) => (
                      <option key={note.id} value={note.id}>
                        {note.name}
                      </option>
                    ))}
                  </select>
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
    </motion.div>
  );
}
