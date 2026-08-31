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

// Set right before the redirect to Google when it was triggered from the
// "forgot password" panel, so the page knows -- once the OAuth round trip
// lands back here with a session -- to show "set a new password" instead
// of sending the user straight into the app.
export const RESET_INTENT_KEY = "verity:pwreset-intent";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleVerifiedForReset, setGoogleVerifiedForReset] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;

      if (sessionStorage.getItem(RESET_INTENT_KEY) === "1") {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
          navigate({ to: "/mfa-challenge" }); // intent flag stays set for when it comes back
          return;
        }
        sessionStorage.removeItem(RESET_INTENT_KEY);
        setMode("forgot");
        setGoogleVerifiedForReset(true);
        return;
      }

      await goPastSignIn(navigate);
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

  const verifyWithGoogleForReset = async () => {
    setBusy(true);
    sessionStorage.setItem(RESET_INTENT_KEY, "1");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      sessionStorage.removeItem(RESET_INTENT_KEY);
      setBusy(false);
      toast.error("Google verification failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    // Same-tab success (no full redirect) -- the effect above only runs on
    // mount, so re-check here directly.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setBusy(false);
    if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      navigate({ to: "/mfa-challenge" });
      return;
    }
    sessionStorage.removeItem(RESET_INTENT_KEY);
    setGoogleVerifiedForReset(true);
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
            <ForgotPasswordPanel
              googleVerified={googleVerifiedForReset}
              busy={busy}
              onVerifyWithGoogle={verifyWithGoogleForReset}
              onDone={() => goPastSignIn(navigate)}
              onCancel={() => {
                sessionStorage.removeItem(RESET_INTENT_KEY);
                setGoogleVerifiedForReset(false);
                setMode("signin");
              }}
            />
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

function ForgotPasswordPanel({
  googleVerified,
  busy,
  onVerifyWithGoogle,
  onDone,
  onCancel,
}: {
  googleVerified: boolean;
  busy: boolean;
  onVerifyWithGoogle: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localBusy, setLocalBusy] = useState(false);

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    setLocalBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLocalBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    onDone();
  };

  if (!googleVerified) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Reset password</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verify it's you with Google, then set a new password. No email round-trip.
          </p>
        </div>
        <Button className="w-full" onClick={onVerifyWithGoogle} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          Continue with Google to verify
        </Button>
        <p className="text-xs text-muted-foreground">
          Only works if this account's email matches a Google account. If you have 2FA on, you'll be
          asked for your authenticator code too.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={resetPassword}>
      <div>
        <h2 className="text-2xl font-bold">Set a new password</h2>
        <p className="mt-1 text-sm text-muted-foreground">Verified with Google. Pick a new password.</p>
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
      <Button type="submit" className="w-full" disabled={localBusy}>
        {localBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
        Reset password
      </Button>
    </form>
  );
}
