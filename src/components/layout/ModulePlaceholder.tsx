import { Construction } from "lucide-react";

/** Temporary shell for modules that land in a later build stage. */
export function ModulePlaceholder({
  title,
  description,
  stage,
}: {
  title: string;
  description: string;
  stage: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Construction className="size-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{stage}</p>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
