import { DiscoverClient } from "@/components/DiscoverClient";

export const metadata = { title: "Discover events — OpenSlot" };

// The consumer storefront fans use. Clean product surface — no infra labels.
export default function DiscoverPage() {
  return <DiscoverClient />;
}
