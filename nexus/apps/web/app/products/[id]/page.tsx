import ProductDetailPageClient from "./ProductDetailPageClient";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailPageClient id={id} />;
}
