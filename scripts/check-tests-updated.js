import { execSync } from "child_process";

const labels = process.env.PR_LABELS?.split(",") || [];

console.log("PR_LABELS:", labels);
// 1. If label exists → skip check
if (labels.includes("no-test-needed")) {
  console.log("🟢 no-test-needed label found. Skipping test enforcement.");
  process.exit(0);
}

// 2. Normal enforcement
const diff = execSync("git diff --name-only origin/main...HEAD")
  .toString()
  .trim()
  .split("\n");

const srcChanged = diff.some(f => f.startsWith("src/") && !f.includes(".test."));
const testChanged = diff.some(f => f.includes(".test."));

if (srcChanged && !testChanged) {
  console.error("❌ Source files changed but no test files were updated.");
  process.exit(1);
}

console.log("✅ Test update check passed.");
