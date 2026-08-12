"use client";

import { formatAbsolute } from "@/lib/dates";

/** Formats an ISO timestamp in the viewer's local timezone. */
export default function LocalTime({
  iso,
  prefix = "",
  className,
  title,
}: {
  iso: string;
  prefix?: string;
  className?: string;
  title?: string;
}) {
  const label = formatAbsolute(iso);
  return (
    <span className={className} title={title ?? label}>
      {prefix}
      {label}
    </span>
  );
}
