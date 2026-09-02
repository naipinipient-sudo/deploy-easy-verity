import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ShieldCheck, ShieldOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import type { Factor } from "@supabase/supabase-js";
import { AppShell } from "@/components/verity/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/verity/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { adminResetPassword, listWorkspaceMembers, type WorkspaceMemberWithProfile } from "@/lib/verity/workspaces";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useLang();
  return (
    <AppShell title={t("settings.title")} description={t("settings.description")}>
      <div className="max-w-lg space-y-6">
        <ChangePassword />
        <TwoFactor />
        <TeamMembers />
      </div>
    </AppShell>
  );
}

function ChangePassword() {
  const { t } = useLang();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error(t("resetPassword.mismatch"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("resetPassword.updated"));
    setPassword("");
    setConfirm("");
  };

  return (
    <form className="panel space-y-4 p-6" onSubmit={submit}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("settings.changePassword")}
      </h2>
      <div className="space-y-2">
        <Label htmlFor="cp-new">{t("resetPassword.newPassword")}</Label>
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
        <Label htmlFor="cp-confirm">{t("resetPassword.confirmPassword")}</Label>
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
        {t("resetPassword.updatePassword")}
      </Button>
    </form>
  );
}

function TwoFactor() {
  const { t } = useLang();
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
    toast.success(t("settings.twoFactorEnabledToast"));
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
    toast.success(t("settings.twoFactorDisabledToast"));
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
        {t("settings.twoFactor")}
      </h2>

      {active ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {t("settings.twoFactorEnabled", { name: active.friendly_name ?? t("settings.twoFactorEnabledDefault") })}
          </div>
          <Button variant="outline" size="sm" onClick={() => disable(active.id)} disabled={busy}>
            <ShieldOff className="mr-2 h-3.5 w-3.5" aria-hidden />
            {t("settings.twoFactorDisable")}
          </Button>
        </div>
      ) : enrolling ? (
        <form className="space-y-4" onSubmit={confirmEnroll}>
          <p className="text-sm text-muted-foreground">{t("settings.twoFactorScanHint")}</p>
          <img src={enrolling.qrCode} alt="TOTP QR code" className="h-40 w-40 border-2 border-border bg-white" />
          <p className="break-all border-2 border-border bg-muted px-3 py-2 font-mono text-xs">
            {enrolling.secret}
          </p>
          <div className="space-y-2">
            <Label htmlFor="mfa-enroll-code">{t("settings.sixDigitCode")}</Label>
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
              {t("settings.verifyEnable")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEnrolling(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t("settings.twoFactorOffHint")}</p>
          <Button size="sm" onClick={startEnroll} disabled={busy}>
            {t("settings.enable2fa")}
          </Button>
        </div>
      )}
    </div>
  );
}

function TeamMembers() {
  const { t } = useLang();
  const { user } = useAuth();
  const { activeWorkspace } = useActiveWorkspace();
  const [members, setMembers] = useState<WorkspaceMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState<WorkspaceMemberWithProfile | null>(null);

  async function load(workspaceId: string) {
    setLoading(true);
    try {
      setMembers(await listWorkspaceMembers(workspaceId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load members");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeWorkspace) load(activeWorkspace.id);
  }, [activeWorkspace?.id]);

  if (!activeWorkspace) return null;
  const canManage = activeWorkspace.role === "owner" || activeWorkspace.role === "admin";
  if (!canManage) return null;

  return (
    <div className="panel space-y-4 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("settings.team", { workspace: activeWorkspace.name })}
      </h2>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
      ) : resetTarget ? (
        <ResetMemberPasswordForm
          member={resetTarget}
          onDone={() => {
            setResetTarget(null);
            load(activeWorkspace.id);
          }}
          onCancel={() => setResetTarget(null)}
        />
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.displayName || m.email || m.userId}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">{m.role}</Badge>
                {m.userId !== user?.id && (
                  <Button variant="outline" size="sm" onClick={() => setResetTarget(m)}>
                    <KeyRound className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    {t("settings.resetPassword")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResetMemberPasswordForm({
  member,
  onDone,
  onCancel,
}: {
  member: WorkspaceMemberWithProfile;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error(t("resetPassword.mismatch"));
      return;
    }
    setBusy(true);
    try {
      await adminResetPassword(member.userId, password);
      toast.success(t("settings.passwordUpdatedFor", { person: member.email ?? member.displayName ?? "" }));
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <p className="text-sm">
        {t("settings.newPasswordForPrefix")} <strong>{member.email ?? member.displayName}</strong>
      </p>
      <div className="space-y-2">
        <Label htmlFor="member-new-password">{t("resetPassword.newPassword")}</Label>
        <PasswordInput
          id="member-new-password"
          autoComplete="new-password"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="member-confirm-password">{t("resetPassword.confirmPassword")}</Label>
        <PasswordInput
          id="member-confirm-password"
          autoComplete="new-password"
          minLength={6}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("settings.setPassword")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
