// Small, dependency-free UI primitives (a shadcn-style kit, hand-rolled with
// Tailwind so the build needs no component CLI or network fetch).

import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Select({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <select
        className={cn(
          "h-9 min-w-[9rem] rounded-md border border-line bg-surface px-2 text-sm text-ink",
          "focus:outline-none focus:ring-2 focus:ring-brand/40",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-line/60", className)} />
  );
}
