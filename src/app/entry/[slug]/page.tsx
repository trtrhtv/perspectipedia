import EntryView from "@/components/EntryView";
import { slugToTopic } from "@/lib/slug";

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  // הנושא: מה-query אם קיים (מדויק), אחרת נגזר מה-slug.
  const topic = q?.trim() || slugToTopic(slug);

  return <EntryView topic={topic} />;
}
