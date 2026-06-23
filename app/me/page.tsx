import { MyTickets } from "@/components/MyTickets";
import { Eyebrow } from "@/components/ui";

export const metadata = { title: "My tickets — OpenSlot" };

export default function MePage() {
  return (
    <div className="shell" style={{ paddingTop: 36, maxWidth: 920 }}>
      <Eyebrow>identity + device bound · non-transferable</Eyebrow>
      <h1 className="display" style={{ fontSize: 40, marginTop: 12, marginBottom: 24 }}>
        My tickets
      </h1>
      <MyTickets />
    </div>
  );
}
