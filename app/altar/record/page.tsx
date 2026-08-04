// app/altar/record/page.tsx
// Route: /altar/record?key=<ALTAR_SECRET>
// Internal diagnostic only — not linked from the public UI.

import AltarRecord from "@/app/components/AltarRecord";

const ALTAR_SECRET = process.env.ALTAR_SECRET ?? "elder-altar";

interface Props {
  searchParams: Promise<{ key?: string }>;
}

export default async function AltarRecordPage({ searchParams }: Props) {
  const { key } = await searchParams;

  if (key !== ALTAR_SECRET) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0e0b08",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(210,175,100,0.3)",
        fontFamily: "'Gentium Plus', Georgia, serif",
        fontSize: "0.7rem",
        letterSpacing: "0.3em",
        textTransform: "uppercase",
      }}>
        not found
      </div>
    );
  }

  return <AltarRecord />;
}
