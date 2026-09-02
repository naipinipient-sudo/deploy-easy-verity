import { useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: Lang[] = ["en", "id"];

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <div
      role="group"
      aria-label="Language / Bahasa"
      className={cn("inline-flex border-2 border-border shadow-panel-sm", className)}
    >
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          className={cn(
            "px-2.5 py-1 font-display text-[11px] font-semibold uppercase",
            option === "id" && "border-l-2 border-border",
            lang === option ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
