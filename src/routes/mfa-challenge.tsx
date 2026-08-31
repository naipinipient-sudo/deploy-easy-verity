import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RESET_INTENT_KEY } from "@/routes/auth";

export const Route = createFileRoute("/mfa-challenge")({
  component: MfaChallengePage,
});

// If this challenge was reached mid password-reset (Google-verified,
// pending 2FA), send the user back to /auth so it can pick the intent flag
// back up and show "set a new password" instead of the normal app.
function destinationAfterAal2() {
  return sessionStorage.getItem(RESET_INTENT_KEY) === "1" ? "/auth" : "/overview";
}

function MfaChallengePage() {
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aal || aal.nextLevel !== "aal2" || aal.nextLevel === aal.currentLevel) {
        // Nothing to verify here — either no session or already at aal2.
        navigate({ to: aal?.currentLevel === "aal2" ? destinationAfterAal2() : "/auth" });
        return;
      }
      const { data, error } = await supabase.auth.mfa.listFactors();
      const firstFactor = data?.totp?.[0];
      if (error || !firstFactor) {
        toast.error("No authenticator app is enrolled on this account.");
        navigate({ to: "/auth" });
        return;
      }
      setFactorId(firstFactor.id);
      setLoading(false);
    })();
  }, [navigate]);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: destinationAfterAal2() });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center grid-noise px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center grid-noise px-4 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <span className="font-display text-lg font-semibold">Verity</span>
        </Link>
        <form className="panel space-y-4 p-6" onSubmit={verify}>
          <div>
            <h2 className="text-lg font-bold">Enter your authenticator code</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open your authenticator app and enter the 6-digit code for Verity.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-[0.5em]"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Verify
          </Button>
        </form>
      </div>
    </div>
  );
}
