// Category -> Product Setup Form
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ domain: string; category: string }>;
}) {
  const { domain, category } = await params;
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4 capitalize">{domain}</h1>
      <h2 className="text-xl text-gray-600 mb-8 capitalize">{category}</h2>
      <p className="text-gray-500">Product setup form will be rendered here.</p>
    </main>
  );
}
