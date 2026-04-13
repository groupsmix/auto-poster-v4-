import { ProjectForm } from "@/components/project-form";
import { OpportunityGrid } from "@/components/opportunity-grid";
import { ProjectList } from "@/components/project-list";
import { Card, PageShell, SectionTitle } from "@/components/ui";
import { getOpportunities } from "@/lib/opportunities";
import { listProjects } from "@/lib/projects";

export default async function HomePage() {
  const [opportunities, projects] = await Promise.all([getOpportunities(), listProjects()]);

  return (
    <PageShell>
      <div className="grid gap-6">
        <Card className="space-y-6">
          <SectionTitle
            eyebrow="Command center"
            title="One dashboard for products and sites"
            description="Discover opportunities, launch one-click workflows, and export finished packages for digital products or simple sites."
          />
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">What should I build today?</h3>
              <p className="text-sm text-slate-300">
                The opportunity engine ranks ideas by demand, authority value, monetization, and production speed.
              </p>
              <OpportunityGrid opportunities={opportunities.slice(0, 3)} />
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Start a new build</h3>
              <ProjectForm />
            </div>
          </div>
        </Card>

        <section className="space-y-4">
          <SectionTitle
            eyebrow="Project library"
            title="Recent projects"
            description="Each project stores the full run history, generated artifacts, and exportable ZIP package."
          />
          <ProjectList projects={projects} />
        </section>

        <section className="space-y-4">
          <SectionTitle
            eyebrow="Engine design"
            title="What this app runs end to end"
            description="Every project goes through the same production line: opportunity -> brief -> main build -> brand assets -> sales assets -> export package."
          />
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <h3 className="mb-2 text-lg font-semibold">Opportunity engine</h3>
              <p className="text-sm text-slate-300">Suggests what to build and which format fits the goal best.</p>
            </Card>
            <Card>
              <h3 className="mb-2 text-lg font-semibold">Builder engine</h3>
              <p className="text-sm text-slate-300">Creates the digital product or site blueprint from a single project brief.</p>
            </Card>
            <Card>
              <h3 className="mb-2 text-lg font-semibold">Packaging engine</h3>
              <p className="text-sm text-slate-300">Stores artifacts and exports a structured ZIP you can sell or refine.</p>
            </Card>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
