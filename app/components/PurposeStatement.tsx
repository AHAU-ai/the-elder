"use client";

import { Fragment } from "react";
import { PURPOSE_THRESHOLD, PURPOSE_CANONICAL } from "@/lib/purposeStatement";
import { OrnamentDivider } from "./Ornament";

type Register = "threshold" | "canonical";

export default function PurposeStatement({
  register = "threshold",
}: {
  register?: Register;
}) {
  const paragraphs =
    register === "canonical" ? PURPOSE_CANONICAL : PURPOSE_THRESHOLD;

  return (
    <div className="purpose-statement" aria-label="What the Elder says of itself">
      {paragraphs.map((text, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <div className="purpose-statement__ornament">
              <OrnamentDivider width={150} eye={false} />
            </div>
          )}
          <p className="purpose-statement__para">{text}</p>
        </Fragment>
      ))}
    </div>
  );
}
