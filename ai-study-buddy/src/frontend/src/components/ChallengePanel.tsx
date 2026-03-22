import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ArcadiaDocument, SupportedLanguages, UserSession } from "../lib/api";
import {
  createChallengeRoom,
  extractTopics,
  getChallengeRoom,
  getSupportedLanguages,
  joinChallengeRoom,
  startChallengeRoom,
  submitChallenge,
} from "../lib/api";

type Props = {
  session: UserSession;
  activeDocument: ArcadiaDocument | null;
};

export default function ChallengePanel({ session, activeDocument }: Props) {
  const [codeInput, setCodeInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<Record<string, unknown> | null>(null);
  const [tier, setTier] = useState(1);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [language, setLanguage] = useState("en");
  const [topics, setTopics] = useState<string[]>([]);
  const [focusTopic, setFocusTopic] = useState("");
  const [supportedLanguages, setSupportedLanguages] = useState<SupportedLanguages>({ en: "English" });

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

  const refreshRoom = async (code?: string) => {
    const useCode = (code ?? roomCode).toUpperCase();
    if (!useCode) return;
    try {
      const data = await getChallengeRoom(session.token, useCode);
      setRoom(data);
      setRoomCode(useCode);
    } catch (e) {
      toast.error(`Room fetch failed: ${String(e)}`);
    }
  };

  const createRoom = async () => {
    if (!activeDocument) {
      toast.error("Select a document first");
      return;
    }
    try {
      const data = await createChallengeRoom(session.token, {
        document_id: activeDocument.id,
        tier,
        num_questions: 5,
        language,
        focus_topic: focusTopic,
      });
      const code = String(data.code || "");
      setRoomCode(code);
      await refreshRoom(code);
    } catch (e) {
      toast.error(`Create room failed: ${String(e)}`);
    }
  };

  const loadTopics = async () => {
    if (!activeDocument) {
      toast.error("Select a document first");
      return;
    }
    try {
      const data = await extractTopics(session.token, activeDocument.id);
      setTopics((data.topics ?? []).map((t: { title: string }) => t.title));
      toast.success("Topics extracted");
    } catch (e) {
      toast.error(`Topic extraction failed: ${String(e)}`);
    }
  };

  const joinRoom = async () => {
    if (!codeInput.trim()) return;
    try {
      const data = await joinChallengeRoom(session.token, codeInput.trim().toUpperCase());
      const code = String(data.code || "");
      setRoomCode(code);
      await refreshRoom(code);
    } catch (e) {
      toast.error(`Join room failed: ${String(e)}`);
    }
  };

  const submit = async () => {
    if (!roomCode || !room) return;
    const qs = (room.questions as Array<{ id: number; options: string[] }> | undefined) ?? [];
    if (Object.keys(answers).length < qs.length) {
      toast.error("Answer all questions first");
      return;
    }
    try {
      const payload = qs.map((q) => ({ question_id: q.id, selected_option: answers[q.id] }));
      await submitChallenge(session.token, roomCode, payload);
      toast.success("Challenge submitted");
      await refreshRoom(roomCode);
    } catch (e) {
      toast.error(`Submit failed: ${String(e)}`);
    }
  };

  const status = String(room?.status || "");
  const participants = (room?.participants as Array<{ name: string; score: number; submitted: boolean }> | undefined) ?? [];
  const questions = (room?.questions as Array<{ id: number; question: string; options: string[] }> | undefined) ?? [];

  return (
    <Card className="bento-card h-[calc(100vh-9.5rem)] overflow-auto border-white/15 bg-white/[0.04] text-white">
      <CardHeader>
        <CardTitle className="text-white">Challenge Rooms</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-center">
          <select className="rounded-lg px-2 py-2 text-sm bg-white/[0.08] border border-white/15 text-white" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
            <option value={1}>Tier 1</option>
            <option value={2}>Tier 2</option>
            <option value={3}>Tier 3</option>
          </select>
          <select className="rounded-lg px-2 py-2 text-sm bg-white/[0.08] border border-white/15 text-white" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {Object.entries(supportedLanguages).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <Button variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={loadTopics}>Extract topics</Button>
          <select className="rounded-lg px-2 py-2 text-sm bg-white/[0.08] border border-white/15 text-white" value={focusTopic} onChange={(e) => setFocusTopic(e.target.value)}>
            <option value="">All topics</option>
            {topics.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
          <Button className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-0" onClick={createRoom}>Create room</Button>
        </div>

        <div className="flex gap-2 items-center">
          <Input className="bg-white/[0.05] border-white/20 text-white placeholder:text-white/45" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Room code" />
          <Button variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={joinRoom}>Join</Button>
          <Button variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={() => refreshRoom()}>Refresh</Button>
        </div>

        {roomCode && (
          <div className="text-sm bg-white/[0.08] border border-white/15 rounded-lg p-2">
            Room: <b>{roomCode}</b> · Status: <b>{status || "waiting"}</b>
            {status === "waiting" && (
              <Button className="ml-2 border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" size="sm" variant="outline" onClick={() => startChallengeRoom(session.token, roomCode).then(() => refreshRoom(roomCode))}>Start</Button>
            )}
          </div>
        )}

        {participants.length > 0 && (
          <div className="border border-white/15 bg-white/[0.06] rounded-lg p-2">
            <p className="font-medium text-sm mb-1">Participants</p>
            <div className="space-y-1 text-sm">
              {participants.map((p, idx) => (
                <div key={idx} className="flex justify-between"><span>{p.name}</span><span>{Math.round((p.score || 0) * 100)}%</span></div>
              ))}
            </div>
          </div>
        )}

        {status === "active" && questions.length > 0 && (
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="border border-white/15 bg-white/[0.06] rounded-lg p-2">
                <p className="text-sm font-medium mb-2">{q.question}</p>
                <div className="space-y-1">
                  {q.options.map((opt, idx) => (
                    <label key={idx} className="flex items-center gap-2 text-sm">
                      <input type="radio" checked={answers[q.id] === idx} onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0" onClick={submit}>Submit challenge</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
