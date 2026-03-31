import ProjectBuilderDetailClient from "./ProjectBuilderDetailClient";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default async function ProjectBuilderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectBuilderDetailClient id={id} />;
}
