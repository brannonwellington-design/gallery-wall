/** e.g. "Aug 11, 2026, 1:09 PM PDT"
 *
 * Always formats in the *runtime* local timezone (no fixed zone). Call from
 * client components so each viewer sees their own local time — never from a
 * server component, which would bake in the server's zone.
 */
export function formatAbsolute(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/** e.g. "just now", "12m ago", "3h ago", "Aug 11, 2026" — viewer-local clock. */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/** Design-level label for when a room was last saved. */
export function formatEditedLabel(iso: string): string {
  const relative = formatRelative(iso);
  return relative ? `Edited ${relative}` : "";
}
