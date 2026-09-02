import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/verity/PasswordInput";
import { LangToggle } from "@/components/verity/LangToggle";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // supabase-js parses the recovery token from the URL on load and
    // establishes a (recovery) session before this resolves.
    supabase.auth.getSession().then(({ data }) => {
      setValid(!!data.session);
      setReady(true);
    });
  }, []);

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
    navigate({ to: "/overview" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center grid-noise px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
            <span className="font-display text-lg font-semibold">Verity</span>
          </Link>
          <LangToggle />
        </div>

        {!ready ? (
          <div className="panel flex justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : !valid ? (
          <div className="panel space-y-3 p-6 text-center">
            <p className="font-semibold">{t("resetPassword.invalid")}</p>
            <Button asChild size="sm">
              <Link to="/auth">{t("common.backToSignIn")}</Link>
            </Button>
          </div>
        ) : (
          <form className="panel space-y-4 p-6" onSubmit={submit}>
            <h2 className="text-lg font-bold">{t("resetPassword.setNewTitle")}</h2>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("resetPassword.newPassword")}</Label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("resetPassword.confirmPassword")}</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("resetPassword.updatePassword")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
