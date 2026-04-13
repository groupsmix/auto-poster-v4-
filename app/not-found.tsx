import Link from "next/link";
import { PageShell, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <PageShell>
      <Card className="space-y-4">
        <h1 className="text-2xl font-semibold">Project not found</h1>
        <p className="text-sm text-slate-300">The project you opened does not exist or has been removed.</p>
        <Link href="/" className="inline-flex rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/10">
          Back to dashboard
        </Link>
      </Card>
    </PageShell>
  );
}
