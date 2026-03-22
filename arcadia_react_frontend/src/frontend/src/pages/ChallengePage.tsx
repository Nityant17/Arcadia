import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { CheckCircle2, Clock, Copy, LogOut, Users, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Screen = "menu" | "create" | "join";

interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  status: "waiting" | "ready";
}

const MOCK_NAMES = ["Yuki", "Carlos", "Sophie", "Min-jun", "Amara", "Luca"];

function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function ParticipantRow({ p }: { p: Participant }) {
  return (
    <div className="flex items-center justify-between glass-card rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[oklch(0.78_0.16_196)]/40 to-[oklch(0.60_0.20_264)]/40 flex items-center justify-center text-sm font-bold text-foreground">
          {p.name.charAt(0)}
        </div>
        <div>
          <span className="text-sm font-medium text-foreground">{p.name}</span>
          {p.isHost && (
            <span className="ml-2 text-[10px] text-arcadia-teal">HOST</span>
          )}
        </div>
      </div>
      <Badge
        className={
          p.status === "ready"
            ? "bg-[oklch(0.78_0.16_196)]/20 text-arcadia-teal border-[oklch(0.78_0.16_196)]/30"
            : "bg-white/5 text-muted-foreground border-white/10"
        }
      >
        {p.status === "ready" ? (
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
    </div>
  );
}

export default function ChallengePage() {
  const { currentUser } = useAppStore();
  const [screen, setScreen] = useState<Screen>("menu");
  const [code, setCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selfReady, setSelfReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function startCreate() {
    const newCode = genCode();
    setCode(newCode);
    setSelfReady(false);
    const host: Participant = {
      id: "self",
      name: currentUser?.name ?? "You",
      isHost: true,
      ready: false,
      status: "waiting",
    };
    setParticipants([host]);
    setScreen("create");
    let added = 0;
    function addOne() {
      if (added >= 2) return;
      added++;
      const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
      const np: Participant = {
        id: `p${Date.now()}`,
        name,
        isHost: false,
        ready: false,
        status: "waiting",
      };
      setParticipants((prev) => [...prev, np]);
      toast(`${name} joined the room`, { icon: "\ud83d\udc65" });
      timerRef.current = setTimeout(
        () => {
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === np.id ? { ...p, ready: true, status: "ready" } : p,
            ),
          );
          timerRef.current = setTimeout(addOne, 1500 + Math.random() * 2000);
        },
        1500 + Math.random() * 2000,
      );
    }
    timerRef.current = setTimeout(addOne, 2000 + Math.random() * 1500);
  }

  function toggleReady() {
    const next = !selfReady;
    setSelfReady(next);
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === "self"
          ? { ...p, ready: next, status: next ? "ready" : "waiting" }
          : p,
      ),
    );
  }

  async function handleJoin() {
    if (joinInput.length !== 6) {
      toast.error("Room code must be 6 characters");
      return;
    }
    setJoinLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setJoinLoading(false);
    setCode(joinInput.toUpperCase());
    setSelfReady(false);
    const self: Participant = {
      id: "self",
      name: currentUser?.name ?? "You",
      isHost: false,
      ready: false,
      status: "waiting",
    };
    const others: Participant[] = MOCK_NAMES.slice(0, 2).map((name, i) => ({
      id: `o${i}`,
      name,
      isHost: i === 0,
      ready: i === 0,
      status: (i === 0 ? "ready" : "waiting") as "ready" | "waiting",
    }));
    setParticipants([...others, self]);
    setScreen("join");
    toast.success("Joined room!");
  }

  function leave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setScreen("menu");
    setParticipants([]);
    setSelfReady(false);
    setJoinInput("");
  }

  function startChallenge() {
    toast.success("Challenge started! Good luck!");
    leave();
  }

  if (screen === "menu")
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        data-ocid="challenge.page"
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Challenge Lobby
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
          Compete in real-time language challenges with others
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <button
            type="button"
            onClick={startCreate}
            className="glass-card glass-card-hover rounded-3xl p-8 text-left border border-white/10"
            data-ocid="challenge.create.button"
          >
            <div className="w-12 h-12 rounded-2xl bg-[oklch(0.78_0.16_196)]/20 flex items-center justify-center mb-4 border border-[oklch(0.78_0.16_196)]/25">
              <Zap className="w-6 h-6 text-arcadia-teal" />
            </div>
            <h3 className="font-semibold text-foreground text-lg mb-2">
              Create Room
            </h3>
            <p className="text-sm text-muted-foreground">
              Start a new challenge room and invite others with a code
            </p>
          </button>
          <button
            type="button"
            onClick={() => setScreen("join")}
            className="glass-card glass-card-hover rounded-3xl p-8 text-left border border-white/10"
            data-ocid="challenge.join.button"
          >
            <div className="w-12 h-12 rounded-2xl bg-[oklch(0.60_0.20_264)]/20 flex items-center justify-center mb-4 border border-[oklch(0.60_0.20_264)]/25">
              <Users className="w-6 h-6 text-arcadia-purple" />
            </div>
            <h3 className="font-semibold text-foreground text-lg mb-2">
              Join Room
            </h3>
            <p className="text-sm text-muted-foreground">
              Enter a room code to join an existing challenge
            </p>
          </button>
        </div>
      </motion.div>
    );

  if (screen === "join" && participants.length === 0)
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md mx-auto"
        data-ocid="challenge.join.form"
      >
        <button
          type="button"
          onClick={leave}
          className="text-sm text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1"
        >
          <LogOut className="w-4 h-4" /> Back
        </button>
        <div className="glass rounded-3xl p-8 space-y-4">
          <h2 className="text-xl font-bold text-foreground">Join a Room</h2>
          <input
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-bold tracking-[0.4em] text-foreground placeholder:text-muted-foreground placeholder:tracking-normal focus:outline-none focus:border-[oklch(0.78_0.16_196)] uppercase"
            placeholder="ROOM CODE"
            value={joinInput}
            onChange={(e) =>
              setJoinInput(e.target.value.toUpperCase().slice(0, 6))
            }
            maxLength={6}
            data-ocid="challenge.join.input"
          />
          <Button
            onClick={handleJoin}
            disabled={joinLoading || joinInput.length !== 6}
            className="w-full bg-arcadia-teal text-[#0B1020] font-semibold hover:bg-arcadia-cyan"
            data-ocid="challenge.join.submit"
          >
            {joinLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-[#0B1020]/30 border-t-[#0B1020] rounded-full animate-spin" />
                Joining...
              </span>
            ) : (
              "Join Room"
            )}
          </Button>
        </div>
      </motion.div>
    );

  const isHost = screen === "create";
  const allReady = participants.every((p) => p.status === "ready");
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-md mx-auto space-y-4"
      data-ocid="challenge.room"
    >
      <div className="glass rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-foreground">
            {isHost ? "Your Room" : "Room"}
          </h2>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(code);
              toast.success("Code copied!");
            }}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 transition-all"
            data-ocid="challenge.copy.code"
          >
            <span className="text-sm font-bold tracking-widest text-arcadia-teal">
              {code}
            </span>
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-2">
          {participants.map((p) => (
            <ParticipantRow key={p.id} p={p} />
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={toggleReady}
            className={`flex-1 border transition-all ${selfReady ? "border-[oklch(0.78_0.16_196)]/50 bg-[oklch(0.78_0.16_196)]/10 text-arcadia-teal" : "border-white/10"}`}
            data-ocid="challenge.ready.button"
          >
            {selfReady ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Ready
              </>
            ) : (
              "Mark Ready"
            )}
          </Button>
          {isHost && (
            <Button
              onClick={startChallenge}
              disabled={!allReady}
              className="flex-1 bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan disabled:opacity-40"
              data-ocid="challenge.start.button"
            >
              Start Challenge
            </Button>
          )}
          <Button
            variant="outline"
            onClick={leave}
            className="border-white/10 text-destructive hover:bg-destructive/10"
            data-ocid="challenge.leave.button"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
