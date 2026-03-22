import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { type ChatMessage, useChatMessages } from "@/hooks/useChatMessages";
import { api } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import {
  Loader2,
  MessageSquare,
  Send,
  StopCircle,
  Volume2,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MOCK_INITIAL: ChatMessage[] = [
  {
    id: "init1",
    role: "assistant",
    content:
      "こんにちは！今日は何を練習しますか？ (Hello! What would you like to practice today?)",
  },
];

export default function ChatPage() {
  const { currentLanguage } = useAppStore();
  const { messages, addMessage, retranslateAll } =
    useChatMessages(MOCK_INITIAL);
  const { play, stop, isPlaying, playingId } = useAudioPlayer();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLangRef = useRef(currentLanguage?.id ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (prevLangRef.current !== currentLanguage?.id) {
      prevLangRef.current = currentLanguage?.id ?? "";
      retranslateAll(currentLanguage?.id ?? "en");
    }
  }, [currentLanguage, retranslateAll]);

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

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      let content =
        "面白いですね！その点についてもっと詳しく話しましょう。";

      const response = await api.chat.query({
        message: userMsg.content,
        language: currentLanguage?.id ?? "en",
      });
      content = response.data?.answer ?? content;

      addMessage({ id: `a${Date.now()}`, role: "assistant", content });
    } catch {
      toast.error("Chat request failed");
      addMessage({
        id: `a${Date.now()}`,
        role: "assistant",
        content: "申し訳ありません、接続に問題があります。",
      });
    } finally {
      setSending(false);
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col h-[calc(100vh-120px)] glass rounded-2xl overflow-hidden"
      data-ocid="chat.page"
    >
      <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[oklch(0.78_0.16_196)]/30 to-[oklch(0.60_0.20_264)]/30 flex items-center justify-center border border-white/10">
          <MessageSquare className="w-4 h-4 text-arcadia-teal" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">
            AI Tutor Chat
          </h1>
          <p className="text-xs text-muted-foreground">
            {currentLanguage?.flag} {currentLanguage?.name} session
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-6">
        <div className="py-4 flex flex-col gap-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.isTranslating ? (
                <Skeleton className="h-10 w-56 rounded-2xl bg-white/10" />
              ) : (
                <div
                  className={`group relative max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-[oklch(0.78_0.16_196)]/50 to-[oklch(0.62_0.18_240)]/40 text-foreground"
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
                          : play(msg.content, msg.id, currentLanguage?.id ?? "en")
                      }
                      className="absolute -right-8 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-arcadia-teal"
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
          {sending && (
            <div className="flex justify-start">
              <div className="glass-card rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-arcadia-teal animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-arcadia-teal animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-arcadia-teal animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-white/10 px-6 py-4 flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[oklch(0.78_0.16_196)] resize-none min-h-[40px] max-h-[120px] leading-relaxed"
          placeholder="Type a message…"
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          rows={1}
          data-ocid="chat.input"
        />
        <Button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan h-10 w-10 p-0 shrink-0"
          data-ocid="chat.send.button"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </motion.div>
  );
}
