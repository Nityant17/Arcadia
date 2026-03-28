import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextHoverEffect } from "@/components/ui/text-hover-effect";
import { Meteors } from "@/components/ui/meteors";
import { useAppStore } from "@/store/useAppStore";
import { apiClient, getApiErrorMessage } from "@/services/api";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export default function AuthPage() {
  const navigate = useNavigate();
  const { setAuthToken, setCurrentUser } = useAppStore();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationOtp, setVerificationOtp] = useState("");
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oauthRedirectData = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("oauth_token") || "";
    const name = params.get("oauth_name") || "";
    const email = params.get("oauth_email") || "";
    const provider = params.get("oauth_provider") || "";
    const oauthError = params.get("oauth_error") || "";
    const newStar = params.get("oauth_new_star") === "true";
    const streak = Number(params.get("oauth_streak") || "");
    return { token, name, email, provider, oauthError, newStar, streak: Number.isNaN(streak) ? 0 : streak };
  }, []);

  useEffect(() => {
    if (oauthRedirectData.oauthError) {
      toast.error(`OAuth sign-in failed: ${oauthRedirectData.oauthError}`);
      window.history.replaceState({}, "", "/auth");
      return;
    }
    if (!oauthRedirectData.token) return;

    setAuthToken(oauthRedirectData.token);
    setCurrentUser({
      id: `oauth:${oauthRedirectData.email || "user"}`,
      name: oauthRedirectData.name || "Arcadia User",
      email: oauthRedirectData.email || "",
      authProvider: oauthRedirectData.provider || "oauth",
      emailVerified: true,
    });
    toast.success(`Signed in with ${oauthRedirectData.provider || "OAuth"}`);
    if (oauthRedirectData.newStar) {
      toast.success(`New star appeared. Streak: ${oauthRedirectData.streak || 1} days`);
    }
    window.history.replaceState({}, "", "/auth");
    void navigate({ to: "/home" });
  }, [oauthRedirectData, navigate, setAuthToken, setCurrentUser]);

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
      setCurrentUser({
        id: data.user_id,
        name: data.name,
        email: data.email,
        authProvider: data.auth_provider || "local",
        emailVerified: !data.verification_required,
      });
      toast.success("Signed in successfully");
      if (data.new_star) {
        toast.success(`New star appeared. Streak: ${data.streak || 1} days`);
      }
      navigate({ to: "/home" });
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to sign in");
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
      if (data.verification_required || !data.token) {
        setVerificationEmail(data.email || regEmail);
        setShowVerification(true);
        setVerificationOtp("");
        setDevOtpHint(data.dev_otp || null);
        toast.success(data.message || "Verification code sent");
        return;
      }

      setAuthToken(data.token);
      setCurrentUser({
        id: data.user_id,
        name: data.name,
        email: data.email,
        authProvider: data.auth_provider || "local",
        emailVerified: true,
      });
      toast.success("Account created successfully");
      if (data.new_star) {
        toast.success(`New star appeared. Streak: ${data.streak || 1} days`);
      }
      navigate({ to: "/home" });
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to create account");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!verificationEmail || !verificationOtp.trim()) {
      toast.error("Enter your email and OTP");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      const response = await apiClient.verifyEmailOtp(verificationEmail, verificationOtp.trim());
      const data = response.data;
      setAuthToken(data.token);
      setCurrentUser({
        id: data.user_id,
        name: data.name,
        email: data.email,
        authProvider: data.auth_provider || "local",
        emailVerified: true,
      });
      setShowVerification(false);
      toast.success("Email verified. Welcome to Arcadia!");
      if (data.new_star) {
        toast.success(`New star appeared. Streak: ${data.streak || 1} days`);
      }
      void navigate({ to: "/home" });
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to verify OTP");
      setError(message);
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  }

  async function handleResendOtp() {
    if (!verificationEmail.trim()) {
      toast.error("Enter your email first");
      return;
    }
    setResending(true);
    try {
      const response = await apiClient.resendEmailOtp(verificationEmail.trim());
      setDevOtpHint(response.data.dev_otp || null);
      toast.success("Verification code sent");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to resend OTP"));
    } finally {
      setResending(false);
    }
  }

  if (showVerification) {
    return (
      <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-slate-950">
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
          <Meteors number={90} className="z-0" />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#070A12] via-[#0B1020] to-[#0F172A]" />
        <div className="blob-teal absolute -z-10 top-[-100px] left-[-100px] w-[500px] h-[500px]" />
        <div className="blob-purple absolute -z-10 bottom-[-100px] right-[-100px] w-[600px] h-[600px]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md rounded-3xl p-8 bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-2xl"
        >
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <MailCheck className="h-5 w-5 text-cyan-300" />
              Verify Email
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the OTP sent to your email to finish account setup.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Email</Label>
              <Input
                type="email"
                value={verificationEmail}
                onChange={(e) => setVerificationEmail(e.target.value)}
                className="bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">OTP</Label>
              <Input
                type="text"
                value={verificationOtp}
                onChange={(e) => setVerificationOtp(e.target.value)}
                className="bg-white/5 border border-white/10 text-white tracking-[0.22em] font-semibold text-center placeholder:text-neutral-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                placeholder="123456"
                maxLength={8}
              />
            </div>

            {devOtpHint ? (
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-300" />
                Dev OTP (SMTP not configured): <span className="font-semibold tracking-widest ml-1">{devOtpHint}</span>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={verifying}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-90"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Verify & Continue
            </Button>
          </form>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={resending}
              onClick={handleResendOtp}
              className="border-white/10"
            >
              {resending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Resend OTP
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowVerification(false);
                setVerificationOtp("");
                setDevOtpHint(null);
                setError(null);
              }}
              className="border-white/10"
            >
              Back
            </Button>
          </div>
        </motion.div>
      </div>
    );
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
              <div className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                OAuth backend is ready. Provider environment variables are currently not set.
              </div>
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
