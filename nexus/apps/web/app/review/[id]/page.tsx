// CEO Review Screen
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">CEO Review</h1>
      <p className="text-gray-500">Review screen for product {id} will be displayed here.</p>
    </main>
  );
}
