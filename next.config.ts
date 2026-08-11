import type { NextConfig } from "next";
import { execSync } from "node:child_process";

function git(command: string): string | null {
  try {
    return execSync(command, { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

// Baked in at build time so the homepage can show when this deploy's
// commit landed. On Vercel that matches the push that triggered the build.
const commitDate =
  git("git log -1 --format=%cI") ?? new Date().toISOString();
const commitSha =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  git("git rev-parse --short HEAD") ??
  "dev";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_COMMIT_DATE: commitDate,
    NEXT_PUBLIC_BUILD_COMMIT_SHA: commitSha,
  },
};

export default nextConfig;
