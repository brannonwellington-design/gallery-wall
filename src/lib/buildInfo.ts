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

export { formatAbsolute as formatCommitDate } from "./dates";
