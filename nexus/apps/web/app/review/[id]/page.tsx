import ReviewPageClient from "./ReviewPageClient";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewPageClient id={id} />;
}
