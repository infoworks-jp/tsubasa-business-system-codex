import { Rev2Dashboard } from "@/components/rev2-dashboard";
import { getRev2Analytics } from "@/lib/rev2/analytics";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function Page() {
  const data = await getRev2Analytics();
  return <Rev2Dashboard view="products" data={data} />;
}
