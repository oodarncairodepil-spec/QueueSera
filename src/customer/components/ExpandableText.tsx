import { useState } from "react";

type Props = {
  text: string;
  className?: string;
};

export function ExpandableText({ text, className = "" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const needsToggle = text.trim().length > 120;

  return (
    <div className={className}>
      <p className={`text-sm text-muted-foreground ${expanded ? "" : "line-clamp-3"}`}>{text}</p>
      {needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          {expanded ? "See less" : "Read more"}
        </button>
      )}
    </div>
  );
}
