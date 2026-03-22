import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileText, Layers, Loader2, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ArcadiaDocument } from "../lib/api";
import { deleteDocument, uploadDocument } from "../lib/api";

type Props = {
  documents: ArcadiaDocument[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onDocumentSelected?: (id: string) => void;
  loading: boolean;
  sessionToken: string;
};

export default function SubjectTopics({ documents, activeDocumentId, onSelectDocument, onDocumentSelected, loading, sessionToken }: Props) {
  const [subject, setSubject] = useState("General");
  const [topic, setTopic] = useState("");
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) =>
      uploadDocument(sessionToken, { file, subject: subject.trim() || "General", topic: topic.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document uploaded successfully");
    },
    onError: (e) => toast.error(`Upload failed: ${String(e)}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteDocument(sessionToken, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["studyProgress"] });
      toast.success("Document deleted");
    },
    onError: (e) => toast.error(`Delete failed: ${String(e)}`),
  });

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
    event.currentTarget.value = "";
  };

  return (
    <Card className="bento-card flex flex-col h-[calc(100vh-9.5rem)] border-white/15 bg-white/[0.04] text-white">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-300" />
          Uploaded Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden px-2 pb-4">
        <div className="px-2 pb-3 space-y-2">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="h-8 text-xs bg-white/[0.04] border-white/15 text-white placeholder:text-white/40" />
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (optional)" className="h-8 text-xs bg-white/[0.04] border-white/15 text-white placeholder:text-white/40" />
          <label className="inline-flex items-center gap-2 text-xs text-indigo-300 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            {uploadMutation.isPending ? "Uploading..." : "Upload note"}
            <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.txt,.webp" onChange={onPickFile} disabled={uploadMutation.isPending} />
          </label>
        </div>
        <ScrollArea className="h-full">
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : documents.length === 0 ? (
            <div className="px-3 py-8 text-sm text-white/60">No notes found yet. Upload notes from the connected backend API.</div>
          ) : (
            <div className="flex flex-col gap-1 pr-2">
              {documents.map((doc) => {
                const selected = doc.id === activeDocumentId;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      onSelectDocument(doc.id);
                      onDocumentSelected?.(doc.id);
                    }}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition-all border ${selected ? "bg-white/[0.14] border-indigo-300/45" : "hover:bg-white/[0.07] border-transparent"}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${selected ? "bg-indigo-400 text-white" : "bg-white/10 text-indigo-200"}`}>
                        <FileText className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${selected ? "text-white" : "text-white/90"}`}>{doc.original_name}</p>
                        <p className="text-xs text-white/60 truncate">{doc.subject} • {doc.topic || "Untagged"}</p>
                        <p className="text-xs text-white/55 mt-0.5 flex items-center gap-1"><Layers className="w-3 h-3" />{doc.chunk_count} chunks</p>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        className="w-7 h-7 rounded-md border border-white/15 bg-white/[0.05] text-white/65 hover:text-red-300 hover:border-red-300/40 hover:bg-red-500/10 flex items-center justify-center flex-shrink-0"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteMutation.mutate(doc.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteMutation.mutate(doc.id);
                          }
                        }}
                        aria-label={`Delete ${doc.original_name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
