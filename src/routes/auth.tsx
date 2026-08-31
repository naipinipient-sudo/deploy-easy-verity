import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/verity/PasswordInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Verity" },
      {
        name: "description",
        content:
          "Sign in or create a Verity account to open your governed data workspace for reconciliation and evidence-backed analysis.",
      },
      { property: "og:title", content: "Sign in to Verity" },
      {
        property: "og:description",
        content: "Access your Verity workspace for trusted, explainable operational data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

// After a first-factor sign-in, route to the MFA challenge if the account
// has a verified second factor and this session hasn't cleared it yet.
async function goPastSignIn(navigate: ReturnType<typeof useNavigate>) {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data && data.nextLevel === "aal2" && data.nextLevel !== data.currentLevel) {
    navigate({ to: "/mfa-challenge" });
  } else {
    navigate({ to: "/overview" });
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goPastSignIn(navigate);
    });
  }, [navigate]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await goPastSignIn(navigate);
  };

  const signUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/overview`,
        data: { full_name: displayName },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. You can sign in now.");
    navigate({ to: "/overview" });
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    await goPastSignIn(navigate);
  };

  return (
    <div className="flex min-h-screen items-center justify-center grid-noise px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <span className="font-display text-lg font-semibold">Verity</span>
        </Link>

        <div className="panel p-6">
          {mode === "forgot" ? (
            <ForgotPasswordPanel onDone={() => goPastSignIn(navigate)} onCancel={() => setMode("signin")} />
          ) : (
          <>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form className="mt-5 space-y-4" onSubmit={signIn}>
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Work email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs font-medium normal-case text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <PasswordInput
                    id="signin-password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="mt-5 space-y-4" onSubmit={signUp}>
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Name</Label>
                  <Input
                    id="signup-name"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Work email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <PasswordInput
                    id="signup-password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={signInWithGoogle} disabled={busy}>
            Continue with Google
          </Button>
          </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Verity never writes back to your source systems.
        </p>
      </div>
    </div>
  );
}

function ForgotPasswordPanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Code sent to ${email}.`);
    setCodeSent(true);
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
    if (verifyError) {
      setBusy(false);
      toast.error(verifyError.message);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    toast.success("Password updated.");
    onDone();
  };

  return (
    <form className="space-y-4" onSubmit={codeSent ? resetPassword : sendCode}>
      <div>
        <h2 className="text-2xl font-bold">Reset password</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {codeSent
            ? `Enter the code we sent to ${email} and your new password.`
            : "Enter your email and we'll send a verification code."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          disabled={codeSent}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {codeSent && (
        <>
          <div className="space-y-2">
            <Label htmlFor="forgot-code">Verification code</Label>
            <Input
              id="forgot-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-[0.5em]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="forgot-new-password">New password</Label>
            <PasswordInput
              id="forgot-new-password"
              autoComplete="new-password"
              minLength={6}
              required
              placeholder="Min. 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="forgot-confirm-password">Confirm new password</Label>
            <PasswordInput
              id="forgot-confirm-password"
              autoComplete="new-password"
              minLength={6}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={busy || (codeSent && code.length !== 6)}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
        {codeSent ? "Reset password" : "Send code"}
      </Button>
      <button
        type="button"
        onClick={onCancel}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Back to sign in
      </button>
    </form>
  );
}
