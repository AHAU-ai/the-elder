"use client";

import { PURPOSE_THRESHOLD, PURPOSE_CANONICAL } from "@/lib/purposeStatement";

type Register = "threshold" | "canonical";

export default function PurposeStatement({
  register = "threshold",
}: {
  register?: Register;
}) {
  const paragraphs =
    register === "canonical" ? PURPOSE_CANONICAL : PURPOSE_THRESHOLD;

  return (
    <div className="purpose-statement" aria-label="Purpose">
      {paragraphs.map((text, i) => (
        <p key={i} className="purpose-statement__para">
          {text}
        </p>
      ))}
    </div>
  );
}
