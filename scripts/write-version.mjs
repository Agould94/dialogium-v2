// Runs before `next build`: writes public/version.json with the deploy date and commit.
// On Vercel, VERCEL_GIT_COMMIT_SHA is set; locally we fall back to `git rev-parse`.
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

let commit = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
if (!commit) {
  try {
    commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    commit = "unknown";
  }
}

const payload = {
  updated: new Date().toISOString(),
  commit: commit.slice(0, 7),
};

mkdirSync("public", { recursive: true });
writeFileSync("public/version.json", JSON.stringify(payload) + "\n");
console.log("version.json:", JSON.stringify(payload));
