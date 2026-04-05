import WorkflowPageClient from "./WorkflowPageClient";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkflowPageClient id={id} />;
}
