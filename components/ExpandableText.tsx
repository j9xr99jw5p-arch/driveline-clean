"use client";

import { useMemo, useState } from "react";

export function ExpandableText({
  text,
  className = ""
}: {
  text: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const paragraphs = useMemo(() => text.split(/\n{2,}/).map((value) => value.trim()).filter(Boolean), [text]);
  const shouldCollapse = paragraphs.length > 1;
  const visibleText = !shouldCollapse || expanded ? text : paragraphs[0];

  return (
    <div className={`expandable-text ${expanded ? "expanded" : ""} ${className}`}>
      <div className="expandable-text-content">
        {visibleText.split(/\n{2,}/).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {shouldCollapse ? (
        <button className="expandable-text-toggle" type="button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
