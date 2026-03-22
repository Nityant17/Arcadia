import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, Brain, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { login, register, type UserSession } from "../lib/api";

type Props = {
  onAuthSuccess: (session: UserSession) => void;
};

export default function LandingPage({ onAuthSuccess }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Email and password are required");
      return;
    }
    if (isRegister && !name.trim()) {
      toast.error("Name is required");
      return;
    }

    setLoading(true);
    try {
      const session = isRegister
        ? await register(name.trim(), email.trim(), password)
        : await login(email.trim(), password);
      onAuthSuccess(session);
      toast.success(isRegister ? "Account created" : "Logged in");
    } catch (e) {
      toast.error(`Auth failed: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <header className="glass-panel rounded-2xl px-5 py-3 flex items-center justify-between sticky top-4 z-30">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </span>
            <span className="font-semibold">Arcadia</span>
          </div>
          <div className="text-xs text-white/60">AI Study Buddy</div>
        </header>

        <div className="mt-6 grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
          <section className="space-y-6">
            <div className="bento-card p-8 min-h-[420px] flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-indigo-200 mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  Linear-style productivity + Reflect-style learning flow
                </div>
                <h1 className="font-display text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
                  Your futuristic
                  <br />
                  AI study cockpit
                </h1>
                <p className="mt-4 text-white/70 text-lg max-w-2xl">
                  Upload your own notes, chat deeply, generate adaptive quizzes, plan time blocks, and challenge friends in one premium workspace.
                </p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="glass-panel rounded-xl p-3">
                  <p className="text-xs text-white/60">Smart Chat</p>
                  <p className="font-semibold mt-1">Source-grounded answers</p>
                </div>
                <div className="glass-panel rounded-xl p-3">
                  <p className="text-xs text-white/60">Adaptive Quiz</p>
                  <p className="font-semibold mt-1">Tiered mastery engine</p>
                </div>
                <div className="glass-panel rounded-xl p-3">
                  <p className="text-xs text-white/60">Time Planner</p>
                  <p className="font-semibold mt-1">Auto study blocks</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bento-card p-5 min-h-[170px]">
                <p className="text-xs uppercase tracking-wide text-white/50">Scroll Story</p>
                <p className="mt-2 text-lg font-semibold">Capture knowledge</p>
                <p className="mt-1 text-sm text-white/65">Drag your PDFs or photos of notes. Arcadia extracts, chunks, and indexes automatically.</p>
              </div>
              <div className="bento-card p-5 min-h-[170px]">
                <p className="text-xs uppercase tracking-wide text-white/50">Scroll Story</p>
                <p className="mt-2 text-lg font-semibold">Iterate understanding</p>
                <p className="mt-1 text-sm text-white/65">Run chat, quiz, and hints as a single loop to turn confusion into mastery.</p>
              </div>
            </div>
          </section>

          <Card className="glass-panel border-white/15 bg-white/[0.05] text-white sticky top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <span className="w-8 h-8 rounded-md bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </span>
                {isRegister ? "Create account" : "Sign in"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isRegister && (
                <Input className="bg-white/5 border-white/15 text-white placeholder:text-white/40" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              )}
              <Input className="bg-white/5 border-white/15 text-white placeholder:text-white/40" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input className="bg-white/5 border-white/15 text-white placeholder:text-white/40" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

              <Button className="w-full bg-gradient-to-r from-indigo-400 to-violet-500 text-white border-0" onClick={submit} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isRegister ? "Create account" : "Enter workspace"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <Button
                variant="ghost"
                className="w-full text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => setIsRegister((prev) => !prev)}
                disabled={loading}
              >
                {isRegister ? "Already have an account? Sign in" : "No account? Create one"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
