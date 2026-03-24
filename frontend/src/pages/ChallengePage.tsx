import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient, type DocumentItem } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { CheckCircle2, Clock, Copy, Loader2, LogOut, Users, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Screen = "menu" | "join-form" | "room";

interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  status: "waiting" | "ready";
  score: number;
}

function ParticipantRow({ participant }: { participant: Participant }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-950/40 backdrop-blur-xl border border-white/10 px-4 py-3 hover:border-cyan-500/30 transition-all">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[oklch(0.78_0.16_196)]/40 to-[oklch(0.60_0.20_264)]/40 flex items-center justify-center text-sm font-bold text-foreground">
          {participant.name.charAt(0)}
        </div>
        <div>
          <span className="text-sm font-medium text-foreground">{participant.name}</span>
          {participant.isHost && (
            <span className="ml-2 text-[10px] text-arcadia-teal">HOST</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          className={
            participant.status === "ready"
              ? "bg-[oklch(0.78_0.16_196)]/20 text-arcadia-teal border-[oklch(0.78_0.16_196)]/30"
              : "bg-white/5 text-muted-foreground border-white/10"
          }
        >
          {participant.status === "ready" ? (
            <>
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Ready
            </>
          ) : (
            <>
              <Clock className="w-3 h-3 mr-1" />
              Waiting
            </>
          )}
        </Badge>
        <span className="text-xs text-muted-foreground min-w-10 text-right">
          {Math.round(participant.score * 100)}%
        </span>
      </div>
    </div>
  );
}

export default function ChallengePage() {
  const { currentUser, currentLanguage } = useAppStore();

  const [screen, setScreen] = useState<Screen>("menu");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [code, setCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [roomStatus, setRoomStatus] = useState<"waiting" | "active" | "finished">("waiting");
  const [loading, setLoading] = useState(false);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await apiClient.listDocuments();
        setDocuments(response.data.documents);
        if (response.data.documents.length > 0) {
          setDocumentId(response.data.documents[0].id);
        }
      } catch {
        toast.error("Failed to load documents for challenge room");
      }
    };

    loadDocuments();
  }, []);

  useEffect(() => {
    if (screen !== "room" || !code) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const pollRoom = async () => {
      try {
        const response = await apiClient.getChallengeRoom(code);
        setRoomStatus(response.data.status);

        const mappedParticipants: Participant[] = response.data.participants.map(
          (
            participant: { name: string; score: number; submitted: boolean },
            index: number,
          ) => ({
            id: `${participant.name}-${index}`,
            name: participant.name,
            isHost: index === 0,
            status: participant.submitted ? "ready" : "waiting",
            score: participant.score,
          }),
        );

        setParticipants(mappedParticipants);
      } catch {
        toast.error("Failed to refresh challenge room");
      }
    };

    pollRoom();
    timer = setInterval(pollRoom, 3000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [screen, code]);

  async function createRoom() {
    if (!documentId) {
      toast.error("Upload a note first to create a challenge");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.createChallengeRoom({
        document_id: documentId,
        tier: 1,
        num_questions: 5,
        language: currentLanguage?.id ?? "en",
        focus_topic: "",
      });

      setCode(response.data.code);
      setScreen("room");
      setIsHost(true);
      toast.success("Challenge room created");
    } catch {
      toast.error("Failed to create challenge room");
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    if (joinInput.trim().length !== 6) {
      toast.error("Room code must be 6 characters");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.joinChallengeRoom(joinInput.trim().toUpperCase());
      setCode(response.data.code);
      setScreen("room");
      setIsHost(false);
      toast.success("Joined challenge room");
    } catch {
      toast.error("Failed to join challenge room");
    } finally {
      setLoading(false);
    }
  }

  async function startRoom() {
    setLoading(true);
    try {
      await apiClient.startChallengeRoom(code);
      setRoomStatus("active");
      toast.success("Challenge started");
    } catch {
      toast.error("Failed to start challenge room");
    } finally {
      setLoading(false);
    }
  }

  function leaveRoom() {
    setScreen("menu");
    setParticipants([]);
    setCode("");
    setJoinInput("");
    setRoomStatus("waiting");
    setIsHost(false);
  }

  if (screen === "menu") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent mb-2">Challenge Lobby</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Create or join a multiplayer quiz room.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
          <div className="rounded-3xl bg-slate-950/40 backdrop-blur-xl border border-white/10 p-6 space-y-4 hover:border-cyan-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[oklch(0.78_0.16_196)]/20 flex items-center justify-center border border-[oklch(0.78_0.16_196)]/25">
              <Zap className="w-6 h-6 text-arcadia-teal" />
            </div>
            <h3 className="font-semibold text-foreground text-lg">Create Room</h3>

            <select
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
              className="arc-select w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground"
            >
              {documents.length === 0 ? (
                <option value="">No documents uploaded</option>
              ) : (
                documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.original_name || document.filename}
                  </option>
                ))
              )}
            </select>

            <Button
              onClick={createRoom}
              disabled={loading || !documentId}
              className="w-full bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Challenge Room
            </Button>
          </div>

          <div className="rounded-3xl bg-slate-950/40 backdrop-blur-xl border border-white/10 p-6 space-y-4 hover:border-cyan-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[oklch(0.60_0.20_264)]/20 flex items-center justify-center border border-[oklch(0.60_0.20_264)]/25">
              <Users className="w-6 h-6 text-arcadia-purple" />
            </div>
            <h3 className="font-semibold text-foreground text-lg">Join Room</h3>

            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-bold tracking-[0.4em] text-foreground placeholder:text-muted-foreground placeholder:tracking-normal focus:outline-none focus:border-[oklch(0.78_0.16_196)] uppercase"
              placeholder="ROOM CODE"
              value={joinInput}
              onChange={(event) =>
                setJoinInput(event.target.value.toUpperCase().slice(0, 6))
              }
              maxLength={6}
            />

            <Button
              onClick={joinRoom}
              disabled={loading || joinInput.length !== 6}
              className="w-full bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Join Challenge Room
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  const canStart = isHost && participants.length > 1 && roomStatus === "waiting";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-xl mx-auto space-y-4"
    >
      <div className="rounded-3xl bg-slate-950/40 backdrop-blur-xl border border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">Room {code}</h2>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(code);
              toast.success("Room code copied");
            }}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 transition-all"
          >
            <span className="text-sm font-bold tracking-widest text-arcadia-teal">{code}</span>
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          Status: <span className="text-foreground">{roomStatus}</span>
        </div>

        <div className="space-y-2">
          {participants.map((participant) => (
            <ParticipantRow key={participant.id} participant={participant} />
          ))}
          {participants.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/20 bg-slate-950/40 p-4 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-5 w-5 text-cyan-300/60 drop-shadow-[0_0_14px_rgba(6,182,212,0.3)]" />
              Waiting for participants...
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          {isHost && (
            <Button
              onClick={startRoom}
              disabled={!canStart || loading}
              className="flex-1 bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan disabled:opacity-40"
            >
              Start Challenge
            </Button>
          )}
          <Button
            variant="outline"
            onClick={leaveRoom}
            className="border-white/10 text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        {isHost && roomStatus === "waiting" && participants.length < 2 && (
          <p className="text-xs text-muted-foreground">
            At least 2 participants are required to start.
          </p>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Signed in as {currentUser?.name ?? "Guest"}
      </div>
    </motion.div>
  );
}
