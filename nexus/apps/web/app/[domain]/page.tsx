// Domain -> Category Cards
export default async function DomainPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8 capitalize">{domain}</h1>
      <p className="text-gray-500">Category cards for this domain will be rendered here.</p>
    </main>
  );
}
