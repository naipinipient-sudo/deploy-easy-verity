import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import type { Factor } from "@supabase/supabase-js";
import { AppShell } from "@/components/verity/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/verity/PasswordInput";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell title="Settings" description="Manage your account security.">
      <div className="max-w-lg space-y-6">
        <ChangePassword />
        <TwoFactor />
      </div>
    </AppShell>
  );
}

function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    setPassword("");
    setConfirm("");
  };

  return (
    <form className="panel space-y-4 p-6" onSubmit={submit}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Change password
      </h2>
      <div className="space-y-2">
        <Label htmlFor="cp-new">New password</Label>
        <PasswordInput
          id="cp-new"
          autoComplete="new-password"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cp-confirm">Confirm password</Label>
        <PasswordInput
          id="cp-confirm"
          autoComplete="new-password"
          minLength={6}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
        Update password
      </Button>
    </form>
  );
}

function TwoFactor() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) toast.error(error.message);
    setFactors(data?.totp ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const startEnroll = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not start enrollment.");
      return;
    }
    setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  };

  const confirmEnroll = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!enrolling) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.factorId,
      code,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor authentication enabled.");
    setEnrolling(null);
    setCode("");
    await load();
  };

  const disable = async (factorId: string) => {
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor authentication disabled.");
    await load();
  };

  if (loading) {
    return (
      <div className="panel p-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  const active = factors.find((f) => f.status === "verified");

  return (
    <div className="panel space-y-4 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Two-factor authentication
      </h2>

      {active ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Enabled — {active.friendly_name ?? "Authenticator app"}
          </div>
          <Button variant="outline" size="sm" onClick={() => disable(active.id)} disabled={busy}>
            <ShieldOff className="mr-2 h-3.5 w-3.5" aria-hidden />
            Disable
          </Button>
        </div>
      ) : enrolling ? (
        <form className="space-y-4" onSubmit={confirmEnroll}>
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app (Google Authenticator, 1Password, Authy…),
            or enter the secret manually.
          </p>
          <img src={enrolling.qrCode} alt="TOTP QR code" className="h-40 w-40 border-2 border-border bg-white" />
          <p className="break-all border-2 border-border bg-muted px-3 py-2 font-mono text-xs">
            {enrolling.secret}
          </p>
          <div className="space-y-2">
            <Label htmlFor="mfa-enroll-code">6-digit code</Label>
            <Input
              id="mfa-enroll-code"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="max-w-32 text-center tracking-[0.4em]"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || code.length !== 6}>
              Verify &amp; enable
            </Button>
            <Button type="button" variant="outline" onClick={() => setEnrolling(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Not enabled. Add an authenticator app for a second sign-in step.
          </p>
          <Button size="sm" onClick={startEnroll} disabled={busy}>
            Enable 2FA
          </Button>
        </div>
      )}
    </div>
  );
}
