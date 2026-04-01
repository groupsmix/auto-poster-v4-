import { DEFAULT_DOMAINS } from "@/lib/domains";
import DomainPageClient from "./DomainPageClient";

// Allow client-side navigation to dynamically created domains
// that weren't in DEFAULT_DOMAINS at build time
export const dynamicParams = true;

export function generateStaticParams() {
  return DEFAULT_DOMAINS.map((d) => ({ domain: d.slug }));
}

export default async function DomainPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  return <DomainPageClient domain={domain} />;
}
