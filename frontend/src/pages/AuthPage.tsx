import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextHoverEffect } from "@/components/ui/text-hover-effect";
import { Meteors } from "@/components/ui/meteors";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/services/api";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

export default function AuthPage() {
  const navigate = useNavigate();
  const { setAuthToken, setCurrentUser } = useAppStore();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!loginEmail || !loginPassword)
        throw new Error("Please fill in all fields.");

      const response = await apiClient.login(loginEmail, loginPassword);
      const data = response.data;
      setAuthToken(data.token);
      setCurrentUser({ id: data.user_id, name: data.name, email: data.email });
      toast.success("Signed in successfully");
      navigate({ to: "/home" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to sign in";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!regName || !regEmail || !regPassword)
        throw new Error("Please fill in all fields.");

      const response = await apiClient.register(regName, regEmail, regPassword);
      const data = response.data;
      setAuthToken(data.token);
      setCurrentUser({ id: data.user_id, name: data.name, email: data.email });
      toast.success("Account created successfully");
      navigate({ to: "/home" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create account";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-slate-950">
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
        <Meteors number={90} className="z-0" />
      </div>

      {/* Background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#070A12] via-[#0B1020] to-[#0F172A]" />
      <div className="blob-teal absolute -z-10 top-[-100px] left-[-100px] w-[500px] h-[500px]" />
      <div className="blob-purple absolute -z-10 bottom-[-100px] right-[-100px] w-[600px] h-[600px]" />

      <div className="relative z-10 w-full px-4 flex flex-col items-center">
        <div className="h-[12rem] md:h-[16rem] w-full max-w-3xl flex items-center justify-center mb-4">
          <TextHoverEffect text="ARCADIA" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md rounded-3xl p-8 bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-2xl hover:border-cyan-500/20 transition-all duration-500"
        >
          <Tabs
            defaultValue="login"
            onValueChange={() => setError(null)}
            data-ocid="auth.tab"
          >
            <TabsList className="w-full bg-white/5 border border-white/10 mb-6">
              <TabsTrigger
                value="login"
                className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-foreground"
                data-ocid="auth.login.tab"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-foreground"
                data-ocid="auth.register.tab"
              >
                Create Account
              </TabsTrigger>
            </TabsList>

            {/* Error */}
            {error && (
              <div
                className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mb-4"
                data-ocid="auth.error_state"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Login */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-sm">Email</Label>
                  <Input
                    type="email"
                    placeholder="alex@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    data-ocid="auth.login.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-sm">
                    Password
                  </Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    data-ocid="auth.password.input"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-90 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all mt-2"
                  data-ocid="auth.login.submit_button"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            {/* Register */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-sm">
                    Full Name
                  </Label>
                  <Input
                    type="text"
                    placeholder="Alex Chen"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    data-ocid="auth.register.name.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-sm">Email</Label>
                  <Input
                    type="email"
                    placeholder="alex@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    data-ocid="auth.register.email.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-sm">
                    Password
                  </Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    data-ocid="auth.register.password.input"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-90 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all mt-2"
                  data-ocid="auth.register.submit_button"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </motion.div>

        <p className="text-center text-muted-foreground text-xs mt-6">
          © {new Date().getFullYear()} Arcadia
        </p>
      </div>
    </div>
  );
}
