"use client";

import { Fragment } from "react";
import { PURPOSE_THRESHOLD, PURPOSE_CANONICAL } from "@/lib/purposeStatement";
import { OrnamentDivider } from "./Ornament";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { en } from "@/lib/i18n/messages/en";
import type { MessageKey } from "@/lib/i18n/translate";

type Register = "threshold" | "canonical";

export default function PurposeStatement({
  register = "threshold",
}: {
  register?: Register;
}) {
  const { t } = useLanguage();
  const source =
    register === "canonical" ? PURPOSE_CANONICAL : PURPOSE_THRESHOLD;
  // A paragraph is shown in the seeker's language only when the catalog holds
  // that exact paragraph (same index, and the English still equals the source);
  // if the source text has since been revised and not re-translated it shows the
  // source as written rather than a stale translation.
  const paragraphs = source.map((text, i) => {
    const key = `purpose.${register}.${i}` as MessageKey;
    return key in en && (en as Record<string, string>)[key] === text ? t(key as never) : text;
  });

  return (
    <div className="purpose-statement" aria-label={t('purpose.aria')}>
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
