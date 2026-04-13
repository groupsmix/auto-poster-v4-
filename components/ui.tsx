import { clsx } from "clsx";
import { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
    </div>
  );
}

export function Card({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20", className)}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={clsx("inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200", className)}>
      {children}
    </span>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      {eyebrow ? <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</p> : null}
      <h2 className="text-2xl font-semibold">{title}</h2>
      {description ? <p className="max-w-3xl text-sm text-slate-300">{description}</p> : null}
    </div>
  );
}
