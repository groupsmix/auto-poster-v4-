"use client";

interface CategoryCardProps {
  name: string;
  onClick?: () => void;
}

export default function CategoryCard({ name, onClick }: CategoryCardProps) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-card-border bg-card-bg p-6 hover:bg-card-hover hover:border-accent/30 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground group-hover:text-accent transition-colors">
            {name}
          </h3>
        </div>
        <span className="text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all text-lg mt-1">
          &rarr;
        </span>
      </div>
    </button>
  );
}

export function AddCategoryCard({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl border-2 border-dashed border-card-border bg-transparent p-6 hover:border-accent/50 hover:bg-card-hover transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-center justify-center h-full min-h-[40px]">
        <div className="text-center">
          <span className="text-2xl text-muted group-hover:text-accent transition-colors block mb-1">
            +
          </span>
          <span className="text-sm font-medium text-muted group-hover:text-accent transition-colors">
            Add New Category
          </span>
        </div>
      </div>
    </button>
  );
}
