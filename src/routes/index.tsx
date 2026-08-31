import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileSearch, GitCompare, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const PILLARS = [
  {
    icon: FileSearch,
    title: "Evidence first",
    body: "Every aggregate, match and finding traces back to the source rows and rules that produced it.",
  },
  {
    icon: GitCompare,
    title: "Reconcile with control",
    body: "Compare versions by business keys, review scored matches, and approve every resolution yourself.",
  },
  {
    icon: ShieldCheck,
    title: "Read-only sources",
    body: "Verity imports immutable copies. It never writes back to your ERP, dispatch or payroll systems.",
  },
  {
    icon: Sparkles,
    title: "AI that cites",
    body: "Ask questions in plain language and get answers bound to a dataset version, filters and rows.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen grid-noise">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <span className="font-display text-lg font-semibold">Verity</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="pt-16 sm:pt-24">
          <span className="inline-flex rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
            Data intelligence for operations teams
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
            A governed workspace for data you can actually defend.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Verity reads, understands, reconciles and explains fragmented operational exports —
            without ever modifying the systems they came from.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/overview">Open workspace</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2">
          {PILLARS.map((p) => {
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
