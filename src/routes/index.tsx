import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileSearch, GitCompare, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/verity/LangToggle";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verity — Trusted, explainable operational data" },
      {
        name: "description",
        content:
          "Verity turns fragmented CSV and spreadsheet exports into a governed workspace: standardize, reconcile, and explain operational data with full lineage.",
      },
      { property: "og:title", content: "Verity — Trusted, explainable operational data" },
      {
        property: "og:description",
        content:
          "Standardize heterogeneous exports, surface quality issues, reconcile discrepancies, and publish a master dataset with evidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PILLAR_ICONS = [FileSearch, GitCompare, ShieldCheck, Sparkles];

function Landing() {
  const { t } = useLang();
  const pillars = [1, 2, 3, 4].map((n) => ({
    icon: PILLAR_ICONS[n - 1]!,
    title: t(`landing.pillar${n}Title`),
    body: t(`landing.pillar${n}Body`),
  }));

  return (
    <div className="min-h-screen grid-noise">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <span className="font-display text-lg font-semibold">Verity</span>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">{t("landing.signIn")}</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="pt-16 sm:pt-24">
          <span className="inline-flex rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
            {t("landing.eyebrow")}
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
            {t("landing.heroTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">{t("landing.heroBody")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                {t("landing.getStarted")}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/overview">{t("landing.openWorkspace")}</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <article key={p.title} className="panel p-6">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
                <h2 className="mt-4 text-lg font-semibold">{p.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
