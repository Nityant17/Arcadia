import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, type DocumentItem } from "@/services/api";
import {
  FileText,
  Loader2,
  ScanText,
  Trash2,
  Upload,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Note {
  id: string;
  filename: string;
  subject: string;
  topic: string;
  uploadDate: string;
  preview: string;
}

function mapDocumentToNote(document: DocumentItem): Note {
  return {
    id: document.id,
    filename: document.original_name || document.filename,
    subject: document.subject,
    topic: document.topic,
    uploadDate: document.created_at,
    preview: document.extracted_text_preview || "",
  };
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSubject, setUploadSubject] = useState("General");
  const [uploadTopic, setUploadTopic] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedTopics, setExtractedTopics] = useState<Array<{ title: string; summary: string }>>([]);
  const [extractingTopics, setExtractingTopics] = useState(false);
  const [noteSummaries, setNoteSummaries] = useState<Record<string, string>>({});
  const [loadingSummary, setLoadingSummary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedNote = notes.find((note) => note.id === selectedId) ?? null;

  const loadNotes = async () => {
    setLoadingNotes(true);
    try {
      const response = await apiClient.listDocuments();
      const mapped = response.data.documents.map(mapDocumentToNote);
      setNotes(mapped);
      if (mapped.length > 0) {
        setSelectedId((prev) => prev || mapped[0].id);
      } else {
        setSelectedId("");
      }
    } catch {
      toast.error("Failed to fetch notes");
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    setExtractedTopics([]);
  }, [selectedId]);

  useEffect(() => {
    const loadSummary = async () => {
      if (!selectedNote || noteSummaries[selectedNote.id]) return;

      setLoadingSummary(true);
      try {
        const response = await apiClient.extractTopics(selectedNote.id);
        const topics = response.data.topics;
        setExtractedTopics(topics);

        setNoteSummaries((prev) => ({
          ...prev,
          [selectedNote.id]: response.data.summary || selectedNote.preview || "No summary available for this note.",
        }));
      } catch {
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
    } catch {
      toast.error("Failed to upload note");
    } finally {
      setUploading(false);
    }
  }

  async function deleteNote(id: string) {
    try {
      await apiClient.deleteDocument(id);
      const remaining = notes.filter((note) => note.id !== id);
      setNotes(remaining);
      if (selectedId === id) {
        setSelectedId(remaining[0]?.id ?? "");
      }
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  }

  async function extractTopics() {
    if (!selectedNote || extractingTopics) return;

    setExtractingTopics(true);
    try {
      const response = await apiClient.extractTopics(selectedNote.id, true);
      setExtractedTopics(response.data.topics);
      setNoteSummaries((prev) => ({
        ...prev,
        [selectedNote.id]: response.data.summary || selectedNote.preview || "No summary available for this note.",
      }));
      if (response.data.topics.length > 0) {
        setUploadTopic(response.data.topics[0].title);
      }
      toast.success("Topics extracted from note");
    } catch {
      toast.error("Failed to extract topics");
    } finally {
      setExtractingTopics(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
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

        <ScrollArea className="flex-1">
          <div className="p-2 flex flex-col gap-1">
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
                <button
                  key={note.id}
                  type="button"
                  className={`group w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all ${
                    note.id === selectedId
                      ? "bg-[oklch(0.78_0.16_196)]/15 border border-[oklch(0.78_0.16_196)]/30"
                      : "bg-slate-950/40 backdrop-blur-xl border border-white/10 hover:border-cyan-500/30"
                  }`}
                  onClick={() => setSelectedId(note.id)}
                  data-ocid={`notes.item.${note.id}`}
                >
                  <span className="text-sm text-foreground truncate flex-1 text-left">
                    {note.filename}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteNote(note.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all ml-1 shrink-0"
                    data-ocid={`notes.delete.${note.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col rounded-2xl bg-slate-950/40 backdrop-blur-xl border border-white/10 overflow-hidden">
        {selectedNote ? (
          <>
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedNote.filename}</h2>
                <div className="text-xs text-muted-foreground mt-1">
                  {selectedNote.subject} · {selectedNote.topic} · {new Date(selectedNote.uploadDate).toLocaleString()}
                </div>
              </div>
              <Button
                variant="outline"
                className="border-white/10"
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 flex-1 min-h-0">
              <div className="lg:col-span-2 p-4 overflow-auto">
                <div className="text-sm text-foreground whitespace-pre-wrap">
                  {loadingSummary
                    ? "Generating summary..."
                    : noteSummaries[selectedNote.id] || selectedNote.preview || "No summary available for this note."}
                </div>
              </div>

              <div className="border-l border-white/10 p-4 overflow-auto">
                <div className="text-sm font-semibold text-foreground mb-2">AI Topics</div>
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
                        <div className="text-sm font-medium text-foreground">{item.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">{item.summary}</div>
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
    </motion.div>
  );
}
