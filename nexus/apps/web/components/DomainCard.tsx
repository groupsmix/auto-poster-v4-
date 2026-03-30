"use client";

import DomainIcon from "@/components/icons/DomainIcon";

interface DomainCardProps {
  name: string;
  icon?: string;
  subtitle?: string;
  onClick?: () => void;
}

export default function DomainCard({ name, icon, subtitle, onClick }: DomainCardProps) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-card-border bg-card-bg p-6 hover:bg-card-hover hover:border-accent/30 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {icon && (
            <span className="mb-3 block text-accent">
              <DomainIcon slug={icon} className="w-8 h-8" />
            </span>
          )}
          <h3 className="text-base font-semibold text-foreground group-hover:text-accent transition-colors">
            {name}
          </h3>
          {subtitle && (
            <p className="text-xs text-muted mt-1">{subtitle}</p>
          )}
        </div>
        <span className="text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all text-lg mt-1">
          &rarr;
        </span>
      </div>
    </button>
  );
}

export function AddDomainCard({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl border-2 border-dashed border-card-border bg-transparent p-6 hover:border-accent/50 hover:bg-card-hover transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-center justify-center h-full min-h-[72px]">
        <div className="text-center">
          <span className="text-2xl text-muted group-hover:text-accent transition-colors block mb-1">
            +
          </span>
          <span className="text-sm font-medium text-muted group-hover:text-accent transition-colors">
            Add New Domain
          </span>
        </div>
      </div>
    </button>
  );
}
