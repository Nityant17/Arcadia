import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Loader2, MessageSquare, Send, User, Volume2, StopCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getSupportedLanguages, textToSpeech, translateText, type ArcadiaDocument, type SupportedLanguages, type UserSession } from "../lib/api";
import { useAskQuestion, useGetMessages } from "../hooks/useQueries";

type Props = {
  session: UserSession;
  activeDocument: ArcadiaDocument | null;
};

export default function ChatArea({ session, activeDocument }: Props) {
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("en");
  const [supportedLanguages, setSupportedLanguages] = useState<SupportedLanguages>({ en: "English" });
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const [translating, setTranslating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const audioPlayRequestRef = useRef(0);
  const translationCacheRef = useRef<Record<string, string>>({});
  const [translationVersion, setTranslationVersion] = useState(0);
  const [audioVisible, setAudioVisible] = useState(false);
  const { data: messages = [], isLoading: messagesLoading } = useGetMessages(session.token, activeDocument?.id);
  const { mutateAsync: askQuestion, isPending } = useAskQuestion();

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const langs = await getSupportedLanguages(session.token);
        setSupportedLanguages(langs);
      } catch {
        setSupportedLanguages({ en: "English", hi: "Hindi", es: "Spanish", fr: "French" });
      }
    };
    void loadLanguages();
  }, [session.token]);

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.currentTime = 0;
        playerRef.current.src = "";
        playerRef.current.load();
      }
    };
  }, []);

  const stopCurrentAudio = (cancelPendingRequests = true) => {
    if (cancelPendingRequests) {
      audioPlayRequestRef.current += 1;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (playerRef.current) {
      playerRef.current.onended = null;
      playerRef.current.pause();
      playerRef.current.currentTime = 0;
      playerRef.current.src = "";
      playerRef.current.load();
    }
    audioRef.current = null;
    setAudioVisible(false);
    setPlayingMessageIndex(null);
  };

  useEffect(() => {
    let cancelled = false;

    const translateExistingMessages = async () => {
      if (language === "en") {
        setTranslating(false);
        return;
      }

      const assistantMessages = messages.filter((msg: { role: string }) => msg.role === "assistant");
      if (assistantMessages.length === 0) return;

      setTranslating(true);
      try {
        for (let index = 0; index < messages.length; index += 1) {
          const msg = messages[index] as { role: string; content: string };
          if (msg.role !== "assistant") continue;

          const cacheKey = `${language}::${index}::${msg.content}`;
          if (translationCacheRef.current[cacheKey]) continue;

          const translated = await translateText(session.token, {
            text: msg.content,
            target_language: language,
            source_language: "en",
          });

          if (cancelled) return;
          translationCacheRef.current[cacheKey] = translated.translated_text || msg.content;
          setTranslationVersion((v) => v + 1);
        }
      } catch {
        toast.error("Could not translate all existing messages.");
      } finally {
        if (!cancelled) setTranslating(false);
      }
    };

    void translateExistingMessages();

    return () => {
      cancelled = true;
    };
  }, [language, messages, session.token]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isPending || !activeDocument) return;
    setInput("");
    try {
      await askQuestion({
        token: session.token,
        question: text,
        documentId: activeDocument.id,
        userId: session.user_id,
        language: "en",
      });
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch {
      toast.error("Failed to send message. Please try again.");
    }
  };

  const toggleSpeak = async (text: string, index: number) => {
    if (playingMessageIndex === index && (audioRef.current || playerRef.current)) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio(false);

    const requestId = audioPlayRequestRef.current + 1;
    audioPlayRequestRef.current = requestId;

    const resolvedLanguage = supportedLanguages[language]
      ? language
      : (Object.entries(supportedLanguages).find(([, label]) => label === language)?.[0] ?? "en");

    try {
      const data = await textToSpeech(session.token, {
        text: text.length > 500 ? text.slice(0, 500) : text,
        language: resolvedLanguage,
      });

      if (audioPlayRequestRef.current !== requestId) return;

      const player = playerRef.current;
      if (!player) {
        throw new Error("Audio player unavailable");
      }

      const streamUrl = `${data.audio_url}${data.audio_url.includes("?") ? "&" : "?"}ts=${Date.now()}`;
      player.src = streamUrl;
      player.volume = 1;
      player.muted = false;
      player.load();
      setAudioVisible(true);

      player.onended = () => {
        if (audioPlayRequestRef.current === requestId) {
          setPlayingMessageIndex(null);
        }
      };

      audioRef.current = player;
      setPlayingMessageIndex(index);
      try {
        await player.play();
      } catch {
        toast.info("Audio ready. Press play in the audio bar below.");
      }
    } catch (error) {
      if (audioPlayRequestRef.current === requestId && typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = resolvedLanguage === "en" ? "en-US" : `${resolvedLanguage}`;
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.onend = () => {
          if (audioPlayRequestRef.current === requestId) {
            setPlayingMessageIndex(null);
          }
        };
        setPlayingMessageIndex(index);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } else if (audioPlayRequestRef.current === requestId) {
        stopCurrentAudio();
      }
      toast.error("Audio stream failed; switched to browser voice fallback.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <Card className="bento-card flex flex-col h-[calc(100vh-9.5rem)] border-white/15 bg-white/[0.04] text-white min-w-0">
      <CardHeader className="pb-2 pt-4 px-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-300" />
            {activeDocument ? `Chat · ${activeDocument.original_name}` : "Chat"}
          </CardTitle>
          <select
            className="rounded-lg px-2 py-1.5 text-xs bg-white/[0.08] border border-white/15 text-white"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {Object.entries(supportedLanguages).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 px-4">
        <CardContent className="py-4 px-0">
          {!activeDocument ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-white/60 text-sm">
              Select a document to start chatting.
            </div>
          ) : messagesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-white/70" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-blue-light flex items-center justify-center">
                <Bot className="w-6 h-6 text-indigo-300" />
              </div>
              <p className="font-medium text-white text-sm">Start a conversation from this note</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg: { role: string; content: string }, i: number) => {
                const cacheKey = `${language}::${i}::${msg.content}`;
                const displayed = msg.role === "assistant" && language !== "en"
                  ? (translationCacheRef.current[cacheKey] ?? msg.content)
                  : msg.content;

                return (
                <div key={`${i}-${translationVersion}`} className="flex flex-col gap-3">
                  {msg.role === "user" ? (
                    <div className="w-full flex justify-end">
                      <div className="flex items-start gap-2 max-w-[92%] lg:max-w-[86%] w-fit flex-row-reverse min-w-0">
                        <span className="w-6 h-6 rounded-full bg-brand-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User className="w-3.5 h-3.5 text-white" />
                        </span>
                        <div className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl rounded-tr-sm px-3.5 py-2.5 text-sm leading-6 break-words [overflow-wrap:anywhere] whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full flex justify-start">
                      <div className="flex items-start gap-2 max-w-[92%] lg:max-w-[86%] w-fit min-w-0">
                        <span className="w-6 h-6 rounded-full bg-white/8 border border-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5 text-indigo-300" />
                        </span>
                        <div className="space-y-1">
                          <div className="bg-white/[0.06] border border-white/12 rounded-xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-6 text-white/90 break-words [overflow-wrap:anywhere] whitespace-pre-wrap">{displayed}</div>
                          <button
                            type="button"
                            className="text-xs text-white/60 hover:text-white inline-flex items-center gap-1"
                            onClick={() => void toggleSpeak(displayed, i)}
                          >
                            {playingMessageIndex === i ? <StopCircle className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            {playingMessageIndex === i ? "Stop" : "Read aloud"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );})}
            </div>
          )}
          {translating && (
            <div className="text-xs text-white/55 mt-2">Translating existing responses...</div>
          )}
          {isPending && (
            <div className="flex justify-start mt-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-white/8 border border-white/15 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-indigo-300" />
                </span>
                <div className="bg-white/[0.06] border border-white/12 rounded-xl rounded-tl-sm px-3.5 py-2.5">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </CardContent>
      </ScrollArea>

      <div className="px-4 pb-4 pt-2 border-t border-white/10">
        <div className={audioVisible ? "mb-2 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2" : "hidden"}>
          <p className="text-[11px] text-white/60 mb-1">TTS Player</p>
          <audio ref={playerRef} controls className="w-full h-8" />
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            placeholder={activeDocument ? "Ask from selected notes…" : "Select a document first"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="resize-none min-h-[40px] max-h-[120px] text-sm flex-1 bg-white/[0.04] border-white/15 text-white placeholder:text-white/40"
            disabled={isPending || !activeDocument}
          />
          <Button
            size="icon"
            className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 text-white h-10 w-10 flex-shrink-0"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isPending || !activeDocument}
            aria-label="Send message"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
