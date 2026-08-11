export type BuildInfo = {
  /** ISO-8601 committer date of the deployed commit. */
  commitDate: string;
  /** Short SHA of the deployed commit. */
  commitSha: string;
};

export function getBuildInfo(): BuildInfo {
  return {
    commitDate:
      process.env.NEXT_PUBLIC_BUILD_COMMIT_DATE ?? new Date().toISOString(),
    commitSha: process.env.NEXT_PUBLIC_BUILD_COMMIT_SHA ?? "dev",
  };
}

/** e.g. "Aug 11, 2026, 1:09 PM PDT" */
export function formatCommitDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
