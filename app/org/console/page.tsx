import { OrgConsole } from "@/components/OrgConsole";
import { getData } from "@/lib/data";

export const metadata = { title: "Console — OpenSlot" };
export const dynamic = "force-dynamic";

export default async function OrgPage() {
  const data = getData();
  const evs = await data.listEvents();
  const events = await Promise.all(
    evs.map(async (e) => {
      const slot = await data.slotForEvent(e.id);
      return {
        id: e.id,
        title: e.title,
        capacity: slot?.capacity ?? 0,
        price: e.price,
        organizer: e.organizer_name,
      };
    }),
  );

  return <OrgConsole events={events} />;
}
