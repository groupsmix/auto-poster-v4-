// History — All past workflow runs
export default function HistoryPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">History</h1>
        <p className="text-muted text-sm mt-1">Past workflow runs and revision history</p>
      </div>
      <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
        <p className="text-muted text-sm">Past workflow runs, tokens used, and revision history will be rendered here.</p>
      </div>
    </div>
  );
}
