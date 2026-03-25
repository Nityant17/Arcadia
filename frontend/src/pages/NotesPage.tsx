import { Button } from "@/components/ui/button";
import { LampContainer } from "@/components/ui/lamp";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, getApiErrorMessage, type DocumentItem } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { Link } from "@tanstack/react-router";
import {
  BrainIcon,
  CalendarClockIcon,
  FileText,
  Loader2,
  MessageSquare,
  PuzzleIcon,
  ScanText,
  Star,
  Trash2,
  Upload,
  X,
  Edit2,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { toast } from "sonner";

interface Note {
  id: string;
  filename: string;
  subject: string;
  topic: string;
  isStarred: boolean;
  uploadDate: string;
  preview: string;
}

function mapDocumentToNote(document: DocumentItem): Note {
  return {
    id: document.id,
    filename: document.original_name || document.filename,
    subject: document.subject,
    topic: document.topic,
    isStarred: document.is_starred,
    uploadDate: document.created_at,
    preview: document.extracted_text_preview || "",
  };
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

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

export default function NotesPage() {
  const refreshPinnedItems = useAppStore((s) => s.refreshPinnedItems);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [starringId, setStarringId] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSubject, setUploadSubject] = useState("General");
  const [uploadTopic, setUploadTopic] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedTopics, setExtractedTopics] = useState<Array<{ title: string; summary: string }>>([]);
  const [extractingTopics, setExtractingTopics] = useState(false);
  const [noteSummaries, setNoteSummaries] = useState<Record<string, string>>({});
  const [noteTopics, setNoteTopics] = useState<Record<string, Array<{ title: string; summary: string }>>>({});
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showNextSteps, setShowNextSteps] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- EDIT MODAL STATE ---
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editFilename, setEditFilename] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const selectedNote = notes.find((note) => note.id === selectedId) ?? null;

  const loadNotes = async () => {
    setLoadingNotes(true);
    try {
      const response = await apiClient.listDocuments();
      const mapped = response.data.documents.map(mapDocumentToNote);
      const preferredNoteId = new URLSearchParams(window.location.search).get("noteId") ?? "";
      setNotes(mapped);
      if (mapped.length > 0) {
        const preferredExists = preferredNoteId && mapped.some((note) => note.id === preferredNoteId);
        setSelectedId((prev) => prev || (preferredExists ? preferredNoteId : mapped[0].id));
      } else {
        setSelectedId("");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to fetch notes"));
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    if (!selectedNote) {
      setExtractedTopics([]);
      return;
    }
    setExtractedTopics(noteTopics[selectedNote.id] || []);
  }, [selectedNote, noteTopics]);

  useEffect(() => {
    const loadSummary = async () => {
      if (!selectedNote) return;

      if (noteSummaries[selectedNote.id] && noteTopics[selectedNote.id]) {
        setExtractedTopics(noteTopics[selectedNote.id]);
        return;
      }

      setLoadingSummary(true);
      try {
        const response = await apiClient.extractTopics(selectedNote.id);
        const topics = response.data.topics;
        setExtractedTopics(topics);
        setNoteTopics((prev) => ({
          ...prev,
          [selectedNote.id]: topics,
        }));

        setNoteSummaries((prev) => ({
          ...prev,
          [selectedNote.id]: response.data.summary || selectedNote.preview || "No summary available for this note.",
        }));
      } catch {
        setNoteTopics((prev) => ({
          ...prev,
          [selectedNote.id]: [],
        }));
        setNoteSummaries((prev) => ({
          ...prev,
          [selectedNote.id]: selectedNote.preview || "No summary available for this note.",
        }));
      } finally {
        setLoadingSummary(false);
      }
    };

    void loadSummary();
  }, [selectedNote, noteSummaries]);

  async function handleUpload(fileOverride?: File) {
    const fileToUpload = fileOverride ?? uploadFile;
    if (!fileToUpload || uploading) return;

    const formData = new FormData();
    formData.append("file", fileToUpload);
    formData.append("subject", uploadSubject || "General");
    formData.append("topic", uploadTopic);

    setUploading(true);
    setUploadProgress(0);

    try {
      const response = await apiClient.uploadDocument(formData, setUploadProgress);
      const created = mapDocumentToNote(response.data);

      setNotes((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setUploadFile(null);
      setUploadTopic("");
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast.success("Note uploaded successfully");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to upload note"));
    } finally {
      setUploading(false);
    }
  }

  async function deleteNote(id: string) {
    if (deletingId) return;

    setDeletingId(id);
    try {
      await apiClient.deleteDocument(id);
      const remaining = notes.filter((note) => note.id !== id);
      setNotes(remaining);
      setNoteSummaries((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setNoteTopics((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (selectedId === id) {
        setSelectedId(remaining[0]?.id ?? "");
      }
      await refreshPinnedItems();
      toast.success("Note deleted");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete note"));
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleStar(note: Note) {
    if (starringId) return;
    setStarringId(note.id);
    try {
      const nextStarState = !note.isStarred;
      await apiClient.setDocumentStar(note.id, nextStarState);
      setNotes((prev) =>
        prev.map((item) =>
          item.id === note.id ? { ...item, isStarred: nextStarState } : item,
        ),
      );
      await refreshPinnedItems();
      toast.success(nextStarState ? "Note starred" : "Note unstarred");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update note star"));
    } finally {
      setStarringId(null);
    }
  }

  async function extractTopics() {
    if (!selectedNote || extractingTopics) return;

    setExtractingTopics(true);
    try {
      const response = await apiClient.extractTopics(selectedNote.id, true);
      setExtractedTopics(response.data.topics);
      setNoteTopics((prev) => ({
        ...prev,
        [selectedNote.id]: response.data.topics,
      }));
      setNoteSummaries((prev) => ({
        ...prev,
        [selectedNote.id]: response.data.summary || selectedNote.preview || "No summary available for this note.",
      }));
      if (response.data.topics.length > 0) {
        setUploadTopic(response.data.topics[0].title);
      }
      toast.success("Topics extracted from note");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to extract topics"));
    } finally {
      setExtractingTopics(false);
    }
  }

  // --- EDIT HANDLERS ---
  function openEditModal(note: Note) {
    setEditingNoteId(note.id);
    setEditFilename(note.filename);
    setEditSubject(note.subject || "General");
    setEditTopic(note.topic || "");
  }

  async function saveNoteEdit() {
    if (!editingNoteId) return;
    setIsUpdating(true);
    try {
      const res = await apiClient.updateDocument(editingNoteId, {
        filename: editFilename,
        subject: editSubject,
        topic: editTopic,
      });
      
      setNotes((prev) =>
        prev.map((n) =>
          n.id === editingNoteId
            ? {
                ...n,
                filename: res.data.original_name || res.data.filename,
                subject: res.data.subject,
                topic: res.data.topic,
              }
            : n
        )
      );
      
      toast.success("Note details updated");
      setEditingNoteId(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update note"));
    } finally {
      setIsUpdating(false);
    }
  }

  const handleNextStepNavigate = () => {
    if (selectedNote?.id) {
      window.sessionStorage.setItem("arcadia:pending-chat-document-id", selectedNote.id);
    }
    setShowNextSteps(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4 relative"
      data-ocid="notes.page"
    >
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">Notes</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage uploads, summaries, and AI topic extraction.</p>
      </div>

      <div className="flex gap-4 h-[calc(100dvh-11rem)] lg:h-[calc(100dvh-7rem)]">
        <div className="w-80 shrink-0 rounded-2xl bg-slate-950/40 backdrop-blur-xl border border-white/10 flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-white/10">
            <div className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-arcadia-teal" /> Notes
            </div>

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.txt"
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setUploadFile(selected);
                  if (selected) {
                    void handleUpload(selected);
                  }
                }}
              />
              <input
                value={uploadSubject}
                onChange={(event) => setUploadSubject(event.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground"
                placeholder="Subject"
              />
              <input
                value={uploadTopic}
                onChange={(event) => setUploadTopic(event.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground"
                placeholder="Topic (optional)"
              />
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5 mr-1" />
                )}
                Choose File & Upload Note
              </Button>
              {uploading && (
                <Progress
                  value={uploadProgress}
                  className="h-1 bg-white/10 [&>div]:bg-arcadia-teal"
                />
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="p-2 flex flex-col gap-1 min-h-full">
              {loadingNotes ? (
                <>
                  <Skeleton className="h-10 w-full bg-white/10 rounded-xl" />
                  <Skeleton className="h-10 w-full bg-white/10 rounded-xl" />
                </>
              ) : notes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/20 bg-slate-950/40 px-3 py-5 text-center">
                  <FileText className="mx-auto mb-2 h-4 w-4 text-cyan-300/60 drop-shadow-[0_0_12px_rgba(6,182,212,0.28)]" />
                  <p className="text-xs text-muted-foreground">No notes uploaded yet.</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={`group w-full flex items-start justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-all duration-300 cursor-pointer ${
                      note.id === selectedId
                        ? "bg-[oklch(0.78_0.16_196)]/15 border border-[oklch(0.78_0.16_196)]/30"
                        : "bg-slate-950/45 backdrop-blur-xl border border-white/10 hover:scale-[1.01] hover:bg-slate-900/60 hover:border-cyan-400/35 hover:shadow-[inset_0px_0px_20px_rgba(6,182,212,0.15)]"
                    }`}
                    onClick={() => setSelectedId(note.id)}
                    data-ocid={`notes.item.${note.id}`}
                  >
                    <div className="min-w-0 flex-1 text-left pr-2">
                      <p className="text-sm text-foreground truncate">{note.filename}</p>
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {note.subject || "General"} · {note.topic || "General"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void toggleStar(note);
                      }}
                      disabled={starringId === note.id}
                      className={`mt-0.5 shrink-0 rounded-lg p-1.5 transition-colors ${
                        note.isStarred
                          ? "text-yellow-300 hover:bg-yellow-400/10"
                          : "text-slate-500 hover:bg-white/5 hover:text-yellow-300"
                      }`}
                      aria-label={`${note.isStarred ? "Unstar" : "Star"} note ${note.filename}`}
                      data-ocid={`notes.star.${note.id}`}
                    >
                      <Star className={`h-3.5 w-3.5 ${note.isStarred ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteNote(note.id);
                      }}
                      disabled={deletingId === note.id}
                      className="uiverse-delete-button uiverse-delete-button--xs mt-0.5 shrink-0 disabled:opacity-50"
                      aria-label={`Delete note ${note.filename}`}
                      data-ocid={`notes.delete.${note.id}`}
                    >
                      <Trash2 className="uiverse-delete-icon" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col rounded-2xl bg-slate-950/40 backdrop-blur-xl border border-white/10 overflow-hidden">
          {selectedNote ? (
            <>
              <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
                <div className="min-w-0 pr-4">
                  <h2 className="text-xl font-bold text-foreground truncate">{selectedNote.filename}</h2>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {selectedNote.subject} · {selectedNote.topic} · {new Date(selectedNote.uploadDate).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-cyan-300 hover:bg-white/5"
                    onClick={() => openEditModal(selectedNote)}
                    aria-label="Edit document details"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="border-cyan-400/40 text-cyan-300"
                    onClick={() => setShowNextSteps(true)}
                  >
                    Next
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 flex-1 min-h-0">
                <div className="lg:col-span-2 p-4 overflow-auto">
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {loadingSummary
                      ? "Generating summary..."
                      : noteSummaries[selectedNote.id] || selectedNote.preview || "No summary available for this note."}
                  </div>
                </div>

                <div className="border-l border-white/10 p-4 overflow-auto">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-foreground">All Topics</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-cyan-400/40 text-cyan-300"
                      onClick={extractTopics}
                      disabled={extractingTopics}
                    >
                      {extractingTopics ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <ScanText className="w-3.5 h-3.5 mr-1" />
                      )}
                      Extract Topics
                    </Button>
                  </div>
                  {extractedTopics.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/20 bg-slate-950/40 p-4 text-center">
                      <ScanText className="mx-auto mb-2 h-4 w-4 text-cyan-300/60 drop-shadow-[0_0_12px_rgba(6,182,212,0.28)]" />
                      <p className="text-xs text-muted-foreground">
                        Click Extract Topics to let Arcadia analyze this note and suggest focus areas.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {extractedTopics.map((item) => (
                        <div key={item.title} className="rounded-xl bg-slate-950/40 backdrop-blur-xl border border-white/10 p-3 hover:border-cyan-500/30 transition-all">
                          <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                          <div className="text-xs text-muted-foreground mt-1 overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] break-words">
                            {compactText(item.summary)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-md rounded-2xl border border-dashed border-white/20 bg-slate-950/40 px-6 py-8 text-center text-muted-foreground">
                <FileText className="mx-auto mb-3 h-8 w-8 text-cyan-300/60 drop-shadow-[0_0_14px_rgba(6,182,212,0.3)]" />
                <p className="text-sm">Upload and select a note to begin.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- EDIT MODAL --- */}
      {editingNoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="rounded-2xl bg-slate-950/90 border border-white/10 p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">Edit Note Details</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Document Name</label>
                <input
                  value={editFilename}
                  onChange={(e) => setEditFilename(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyan-500/50"
                  placeholder="Filename"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
                <input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyan-500/50"
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Topic</label>
                <input
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyan-500/50"
                  placeholder="Topic"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={saveNoteEdit}
                disabled={isUpdating}
                className="flex-1 bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingNoteId(null)}
                disabled={isUpdating}
                className="flex-1 border-white/10 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- NEXT STEPS MODAL --- */}
      {showNextSteps && selectedNote && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          data-ocid="notes.next-steps.panel"
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
              data-ocid="notes.next-steps.close"
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
                  <Link to="/chat" onClick={handleNextStepNavigate} data-ocid="notes.next-steps.chat" className="animated-button">
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
                  <Link
                    to="/quiz"
                    onClick={() => {
                      if (selectedNote?.id) {
                        window.sessionStorage.setItem("arcadia:pending-quiz-document-id", selectedNote.id);
                      }
                      handleNextStepNavigate();
                    }}
                    data-ocid="notes.next-steps.quiz"
                    className="animated-button"
                  >
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
                  <Link
                    to="/study"
                    onClick={() => {
                      if (selectedNote?.id) {
                        window.sessionStorage.setItem("arcadia:pending-study-document-id", selectedNote.id);
                      }
                      handleNextStepNavigate();
                    }}
                    data-ocid="notes.next-steps.study"
                    className="animated-button"
                  >
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
                  <Link to="/planner" onClick={handleNextStepNavigate} data-ocid="notes.next-steps.planner" className="animated-button">
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