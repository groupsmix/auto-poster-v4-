// Live Workflow Progress (with AI + cost tracking)
export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Workflow Progress</h1>
      <p className="text-gray-500">Workflow {id} progress will be displayed here.</p>
    </main>
  );
}
