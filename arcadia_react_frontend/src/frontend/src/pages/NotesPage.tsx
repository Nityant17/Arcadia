import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { type ChatMessage, useChatMessages } from "@/hooks/useChatMessages";
import { api } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import {
  FileText,
  Loader2,
  Plus,
  Send,
  StopCircle,
  Trash2,
  Volume2,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Note {
  id: string;
  title: string;
  content: string;
}

const MOCK_NOTES: Note[] = [
  {
    id: "1",
    title: "\u3066-form conjugation rules",
    content: "The \u3066-form is used to connect verbs...",
  },
  {
    id: "2",
    title: "N3 Kanji: \u6a5f\u4f1a\u30fb\u7d4c\u9a13\u30fb\u611f\u8b1d",
    content: "\u6a5f\u4f1a (\u304d\u304b\u3044) = opportunity...",
  },
  {
    id: "3",
    title: "Conditional forms: \u301c\u305f\u3089 vs \u301c\u3070",
    content: "\u301c\u305f\u3089 is used for if/when...",
  },
];

const MOCK_INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    role: "assistant",
    content:
      "\u3053\u3093\u306b\u3061\u306f\uff01\u3053\u306e\u30ce\u30fc\u30c8\u306b\u3064\u3044\u3066\u4f55\u304b\u8cea\u554f\u306f\u3042\u308a\u307e\u3059\u304b\uff1f",
  },
];

function NoteChat({
  note,
  currentLangId,
}: { note: Note; currentLangId: string }) {
  const { messages, addMessage, retranslateAll } = useChatMessages(
    MOCK_INITIAL_MESSAGES,
  );
  const { play, stop, isPlaying, playingId } = useAudioPlayer();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLangRef = useRef(currentLangId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (prevLangRef.current !== currentLangId) {
      prevLangRef.current = currentLangId;
      retranslateAll(currentLangId);
    }
  }, [currentLangId, retranslateAll]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const userMsg: ChatMessage = {
      id: `u${Date.now()}`,
      role: "user",
      content: input.trim(),
    };
    addMessage(userMsg);
    setInput("");
    setSending(true);
    try {
      const response = await api.chat.query({
        message: userMsg.content,
        document_id: note.id,
        language: currentLangId,
      });
      let content =
        "\u305d\u308c\u306f\u826f\u3044\u8cea\u554f\u3067\u3059\uff01\u8a73\u3057\u304f\u8aac\u660e\u3057\u307e\u3057\u3087\u3046\u3002";
      content = response.data?.answer ?? content;
      addMessage({ id: `a${Date.now()}`, role: "assistant", content });
    } catch {
      toast.error("Unable to fetch note chat response");
      addMessage({
        id: `a${Date.now()}`,
        role: "assistant",
        content:
          "\u7533\u3057\u8a33\u3042\u308a\u307e\u305b\u3093\u3001\u5c11\u3057\u5f8c\u3067\u307e\u305f\u8a66\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.isTranslating ? (
                <Skeleton className="h-8 w-48 rounded-xl bg-white/10" />
              ) : (
                <div
                  className={`group max-w-[75%] rounded-2xl px-4 py-2.5 text-sm relative ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-[oklch(0.78_0.16_196)]/40 to-[oklch(0.62_0.18_240)]/40 text-foreground ml-auto"
                      : "glass-card text-foreground"
                  }`}
                >
                  {msg.content}
                  {msg.role === "assistant" && (
                    <button
                      type="button"
                      onClick={() =>
                        playingId === msg.id
                          ? stop()
                          : play(msg.content, msg.id, currentLangId)
                      }
                      className="absolute -right-7 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-arcadia-teal"
                      data-ocid={`chat.tts.${msg.id}`}
                    >
                      {playingId === msg.id && isPlaying ? (
                        <StopCircle className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="border-t border-white/10 px-4 py-3 flex gap-2">
        <input
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[oklch(0.78_0.16_196)]"
          placeholder="Ask about this note\u2026"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) handleSend();
          }}
          data-ocid="notes.chat.input"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan h-9 w-9 p-0"
          data-ocid="notes.chat.send"
        >
          {sending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

export default function NotesPage() {
  const { currentLanguage } = useAppStore();
  const [notes, setNotes] = useState<Note[]>(MOCK_NOTES);
  const [selectedId, setSelectedId] = useState<string>(MOCK_NOTES[0].id);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: sync editor fields when note ID changes
  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content);
    }
  }, [selectedId]);

  function createNote() {
    const id = `n${Date.now()}`;
    const note: Note = { id, title: "New Note", content: "" };
    setNotes((prev) => [note, ...prev]);
    setSelectedId(id);
  }

  function deleteNote(id: string) {
    const remaining = notes.filter((n) => n.id !== id);
    setNotes(remaining);
    if (selectedId === id) setSelectedId(remaining[0]?.id ?? "");
    toast.success("Note deleted");
  }

  function saveNote() {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedId
          ? { ...n, title: editTitle, content: editContent }
          : n,
      ),
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex gap-4 h-[calc(100vh-120px)]"
      data-ocid="notes.page"
    >
      {/* Left panel */}
      <div className="w-72 shrink-0 glass rounded-2xl flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-white/10">
          <span className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-arcadia-teal" /> Notes
          </span>
          <Button
            size="sm"
            onClick={createNote}
            className="h-7 w-7 p-0 bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan"
            data-ocid="notes.create.button"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 flex flex-col gap-1">
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                className={`group w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all ${
                  note.id === selectedId
                    ? "bg-[oklch(0.78_0.16_196)]/15 border border-[oklch(0.78_0.16_196)]/30"
                    : "hover:bg-white/5 border border-transparent"
                }`}
                onClick={() => setSelectedId(note.id)}
                data-ocid={`notes.item.${note.id}`}
              >
                <span className="text-sm text-foreground truncate flex-1 text-left">
                  {note.title}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNote(note.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all ml-1 shrink-0"
                  data-ocid={`notes.delete.${note.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col glass rounded-2xl overflow-hidden">
        {selectedNote ? (
          <>
            <div className="flex-1 flex flex-col border-b border-white/10 p-4 gap-3">
              <input
                className="bg-transparent text-xl font-bold text-foreground border-none outline-none placeholder:text-muted-foreground w-full"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={saveNote}
                placeholder="Note title\u2026"
                data-ocid="notes.editor.title"
              />
              <textarea
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none leading-relaxed"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onBlur={saveNote}
                placeholder="Start writing\u2026"
                data-ocid="notes.editor.content"
              />
            </div>
            <div className="h-80 flex flex-col">
              <div className="px-4 pt-2 pb-1 text-xs text-muted-foreground font-medium border-b border-white/10 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-arcadia-teal" />
                Note Chat &middot; {currentLanguage?.name}
              </div>
              <NoteChat
                note={selectedNote}
                currentLangId={currentLanguage?.id ?? "en"}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select or create a note</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
