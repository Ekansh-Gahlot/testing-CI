import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Octokit } from "@octokit/rest";
import { createProvider, resolveApiKey, getDefaultModel, AIProvider, AIProviderConfig } from "./ai-providers";

// ============================================================================
// CONFIGURATION
// ============================================================================

interface AIReviewConfig {
  provider: string;
  model: string;
  maxTokens: number;
  temperature: number;
  criticalSeverities: string[];
  maxDiffTokens: number;
  // Only review files under these directories. Empty array means review all source files.
  reviewRoots: string[];
  // Never review files under these directories, even if they match reviewRoots.
  excludePaths: string[];
}

function loadCiPolicy(key: "testExcludePaths" | "aiReviewExcludePaths"): string[] {
  try {
    const policyPath = path.resolve(__dirname, "../.github/ci-policy.json");
    const policy = JSON.parse(fs.readFileSync(policyPath, "utf-8"));
    if (Array.isArray(policy[key])) return policy[key];
  } catch {
    // ci-policy.json not found or malformed — fall back to empty
  }
  return [];
}

const AI_PROVIDER = (process.env.AI_PROVIDER || "openai").toLowerCase();

const CONFIG: AIReviewConfig = {
  provider: AI_PROVIDER,
  model: process.env.AI_MODEL || getDefaultModel(AI_PROVIDER),
  maxTokens: 4096,
  temperature: 0.2,
  criticalSeverities: ["critical", "high"],
  maxDiffTokens: 30000,
  reviewRoots: process.env.REVIEW_ROOTS
    ? process.env.REVIEW_ROOTS.split(",").map((r) => r.trim())
    : ["src"],
  excludePaths: loadCiPolicy("aiReviewExcludePaths"),
};

// ============================================================================
// TYPES
// ============================================================================

interface ReviewIssue {
  file: string;
  line: number;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  message: string;
  suggestion?: string;
}

interface ReviewResult {
  issues: ReviewIssue[];
  summary: string;
  overallAssessment: "approve" | "request-changes" | "comment";
}

interface PRInfo {
  owner: string;
  repo: string;
  pullNumber: number;
  baseSha: string;
  headSha: string;
}

interface DiffHunk {
  file: string;
  content: string;
}

interface DiffPositionMap {
  [key: string]: number;
}

// ============================================================================
// PR INFO
// ============================================================================

function getPRInfo(): PRInfo {
  const repository = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!repository || !eventPath) {
    throw new Error("Missing GITHUB_REPOSITORY or GITHUB_EVENT_PATH");
  }

  const [owner, repo] = repository.split("/");
  const event = JSON.parse(fs.readFileSync(eventPath, "utf-8"));

  return {
    owner,
    repo,
    pullNumber: event.pull_request.number,
    baseSha: event.pull_request.base.sha,
    headSha: event.pull_request.head.sha,
  };
}

// ============================================================================
// DIFF PARSING
// ============================================================================

function getPRDiff(prInfo: PRInfo): string {
  return execSync(
    `git diff ${prInfo.baseSha}...${prInfo.headSha}`,
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
  );
}

function parseDiffIntoFileHunks(rawDiff: string): DiffHunk[] {
  const fileSections = rawDiff.split(/^diff --git /m).filter(Boolean);
  const hunks: DiffHunk[] = [];

  for (const section of fileSections) {
    const fileMatch = section.match(/a\/.+ b\/(.+)/);
    if (!fileMatch) continue;

    const file = fileMatch[1];
    // Skip binary files and non-source files
    if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;
    // Skip files outside the configured review roots (if any roots are set)
    if (
      CONFIG.reviewRoots.length > 0 &&
      !CONFIG.reviewRoots.some((root) => file.startsWith(root + "/") || file === root)
    ) {
      continue;
    }
    // Skip explicitly excluded paths
    if (CONFIG.excludePaths.some((ex) => file.startsWith(ex + "/") || file === ex || file.includes("/" + ex + "/"))) {
      continue;
    }

    hunks.push({ file, content: `diff --git ${section}` });
  }

  return hunks;
}

function buildDiffPositionMap(rawDiff: string): DiffPositionMap {
  const map: DiffPositionMap = {};
  let currentFile = "";
  let diffPosition = 0;
  let newLineNum = 0;

  for (const line of rawDiff.split("\n")) {
    if (line.startsWith("diff --git")) {
      const match = line.match(/diff --git a\/.+ b\/(.+)/);
      if (match) currentFile = match[1];
      diffPosition = 0;
      continue;
    }

    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }

    if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) newLineNum = parseInt(match[1], 10) - 1;
      diffPosition++;
      continue;
    }

    if (currentFile && diffPosition > 0) {
      diffPosition++;
      if (line.startsWith("+") || line.startsWith(" ")) {
        newLineNum++;
        map[`${currentFile}:${newLineNum}`] = diffPosition;
      }
      // Lines starting with "-" don't increment newLineNum
    }
  }

  return map;
}

// ============================================================================
// AI PROVIDER INTEGRATION
// ============================================================================

const GUIDELINES_PATH = process.env.REVIEW_GUIDELINES_PATH || ".github/AI_REVIEW_GUIDELINES.md";

const FALLBACK_SYSTEM_PROMPT = `You are an expert code reviewer for a TypeScript/Node.js project.
Review the following code changes from a pull request for production readiness.
Check for: security issues, missing error handling, hardcoded secrets, performance problems, and TypeScript best practices.
Respond ONLY with valid JSON matching this schema:
{
  "issues": [{ "file": "...", "line": <number>, "severity": "critical|high|medium|low|info", "category": "security|performance|error-handling|best-practice|production-readiness", "message": "...", "suggestion": "..." }],
  "summary": "2-4 sentence summary.",
  "overallAssessment": "approve|request-changes|comment"
}
Use "request-changes" only for critical or high severity issues. No markdown outside the JSON.`;

function loadSystemPrompt(): string {
  try {
    const content = fs.readFileSync(GUIDELINES_PATH, "utf-8");
    console.log(`  📋 Loaded review guidelines from ${GUIDELINES_PATH}`);
    return content;
  } catch {
    console.warn(`  ⚠️  ${GUIDELINES_PATH} not found, using built-in guidelines.`);
    return FALLBACK_SYSTEM_PROMPT;
  }
}

function buildUserPrompt(hunks: DiffHunk[]): string {
  let prompt = "Review the following code changes:\n\n";

  for (const hunk of hunks) {
    prompt += `### File: ${hunk.file}\n\`\`\`diff\n${hunk.content}\n\`\`\`\n\n`;
  }

  return prompt;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function chunkHunks(hunks: DiffHunk[]): DiffHunk[][] {
  const chunks: DiffHunk[][] = [];
  let currentChunk: DiffHunk[] = [];
  let currentTokens = 0;

  for (const hunk of hunks) {
    const hunkTokens = estimateTokens(hunk.content);

    if (currentTokens + hunkTokens > CONFIG.maxDiffTokens && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }

    currentChunk.push(hunk);
    currentTokens += hunkTokens;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function initProvider(): AIProvider {
  const apiKey = resolveApiKey(CONFIG.provider);
  if (!apiKey) {
    throw new Error(
      `No API key found for provider "${CONFIG.provider}". ` +
      `Set AI_API_KEY or the provider-specific key (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY).`
    );
  }
  return createProvider(CONFIG.provider, apiKey);
}

async function callAI(provider: AIProvider, userPrompt: string): Promise<ReviewResult> {
  const systemPrompt = loadSystemPrompt();
  const providerConfig: AIProviderConfig = {
    model: CONFIG.model,
    maxTokens: CONFIG.maxTokens,
    temperature: CONFIG.temperature,
  };

  const content = await provider.review(systemPrompt, userPrompt, providerConfig);
  const parsed = JSON.parse(content) as ReviewResult;

  if (!Array.isArray(parsed.issues) || typeof parsed.summary !== "string") {
    throw new Error(`Invalid response structure from ${CONFIG.provider}`);
  }

  return parsed;
}

async function reviewDiff(provider: AIProvider, hunks: DiffHunk[]): Promise<ReviewResult> {
  const chunks = chunkHunks(hunks);

  if (chunks.length === 1) {
    const userPrompt = buildUserPrompt(chunks[0]);
    return callAI(provider, userPrompt);
  }

  // Multiple chunks: review each and merge results
  console.log(`  Diff is large, splitting into ${chunks.length} chunks...`);

  const allIssues: ReviewIssue[] = [];
  const summaries: string[] = [];
  let worstAssessment: ReviewResult["overallAssessment"] = "approve";

  for (let i = 0; i < chunks.length; i++) {
    console.log(`  Reviewing chunk ${i + 1}/${chunks.length}...`);
    const userPrompt = buildUserPrompt(chunks[i]);
    const result = await callAI(provider, userPrompt);

    allIssues.push(...result.issues);
    summaries.push(result.summary);

    if (result.overallAssessment === "request-changes") {
      worstAssessment = "request-changes";
    } else if (result.overallAssessment === "comment" && worstAssessment === "approve") {
      worstAssessment = "comment";
    }
  }

  return {
    issues: allIssues,
    summary: summaries.join("\n\n"),
    overallAssessment: worstAssessment,
  };
}

// ============================================================================
// GITHUB COMMENT POSTING
// ============================================================================

function formatIssueComment(issue: ReviewIssue): string {
  const severityEmoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🔵",
    info: "ℹ️",
  };

  let body = `${severityEmoji[issue.severity] || "❓"} **${issue.severity.toUpperCase()}** - ${issue.category}\n\n`;
  body += `${issue.message}\n`;

  if (issue.suggestion) {
    body += `\n**Suggestion**:\n\`\`\`\n${issue.suggestion}\n\`\`\`\n`;
  }

  return body;
}

async function postReviewComments(
  prInfo: PRInfo,
  result: ReviewResult,
  rawDiff: string
): Promise<void> {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const positionMap = buildDiffPositionMap(rawDiff);

  const criticalCount = result.issues.filter(
    (i) => CONFIG.criticalSeverities.includes(i.severity)
  ).length;

  // Separate issues into mapped (can be inline) and unmapped (summary only)
  const mappedIssues: Array<{ issue: ReviewIssue; position: number }> = [];
  const unmappedIssues: ReviewIssue[] = [];

  for (const issue of result.issues) {
    const position = positionMap[`${issue.file}:${issue.line}`];
    if (position) {
      mappedIssues.push({ issue, position });
    } else {
      unmappedIssues.push(issue);
    }
  }

  // Build summary body (includes unmapped issues + overview)
  let summaryBody = `## 🤖 AI Code Review\n\n${result.summary}\n\n`;
  summaryBody += `**Provider**: ${CONFIG.provider} | **Model**: ${CONFIG.model} | **Issues found**: ${result.issues.length}\n`;

  if (criticalCount > 0) {
    summaryBody += `**Critical/High issues**: ${criticalCount} ⛔ (CI will fail)\n`;
  }

  if (unmappedIssues.length > 0) {
    summaryBody += `\n### Issues (could not be mapped to diff lines)\n\n`;
    for (const issue of unmappedIssues) {
      summaryBody += `- **[${issue.severity.toUpperCase()}]** \`${issue.file}:${issue.line}\` — ${issue.message}\n`;
      if (issue.suggestion) {
        summaryBody += `  > Suggestion: ${issue.suggestion}\n`;
      }
    }
  }

  // Post summary review (no inline comments — avoids batch 422 failures)
  await octokit.pulls.createReview({
    owner: prInfo.owner,
    repo: prInfo.repo,
    pull_number: prInfo.pullNumber,
    commit_id: prInfo.headSha,
    body: summaryBody,
    event: "COMMENT" as const,
  });

  // Post each inline comment individually so a bad position skips only that comment
  let inlinePosted = 0;
  for (const { issue, position } of mappedIssues) {
    try {
      await octokit.pulls.createReviewComment({
        owner: prInfo.owner,
        repo: prInfo.repo,
        pull_number: prInfo.pullNumber,
        commit_id: prInfo.headSha,
        path: issue.file,
        position,
        body: formatIssueComment(issue),
      });
      inlinePosted++;
    } catch (err: any) {
      // Position couldn't be resolved — silently skip, already visible in summary
      console.warn(`  ⚠️  Skipped inline comment for ${issue.file}:${issue.line} — ${err.message}`);
    }
  }

  console.log(`  📝 Summary posted. Inline comments: ${inlinePosted}/${mappedIssues.length} placed.`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log("🤖 AI Code Review - Starting...\n");
  console.log(`   Provider: ${CONFIG.provider} | Model: ${CONFIG.model}\n`);

  // Validate environment
  if (!resolveApiKey(CONFIG.provider)) {
    console.log(`⚠️  No API key found for provider "${CONFIG.provider}". Skipping AI review.`);
    process.exit(0);
  }
  if (!process.env.GITHUB_TOKEN) {
    console.log("⚠️  GITHUB_TOKEN is not set. Skipping AI review.");
    process.exit(0);
  }
  if (!process.env.GITHUB_EVENT_PATH) {
    console.log("ℹ️  Not running in GitHub Actions. Skipping AI review.");
    process.exit(0);
  }

  // Initialize AI provider
  const provider = initProvider();

  // Get PR info
  const prInfo = getPRInfo();
  console.log(`📋 Reviewing PR #${prInfo.pullNumber} in ${prInfo.owner}/${prInfo.repo}\n`);

  // Get diff
  const rawDiff = getPRDiff(prInfo);
  if (!rawDiff.trim()) {
    console.log("ℹ️  No diff found. Nothing to review.");
    process.exit(0);
  }

  // Parse diff into file hunks
  const hunks = parseDiffIntoFileHunks(rawDiff);
  if (hunks.length === 0) {
    console.log("ℹ️  No source file changes found. Nothing to review.");
    process.exit(0);
  }
  console.log(`📄 Found changes in ${hunks.length} source file(s)\n`);

  // Send to AI for review
  console.log(`🔍 Sending code to ${CONFIG.provider} (${CONFIG.model}) for review...`);
  let result: ReviewResult;
  try {
    result = await reviewDiff(provider, hunks);
  } catch (error: any) {
    console.error(`⚠️  AI review failed: ${error.message}`);
    console.log("Skipping AI review due to API error. CI will not fail.");
    process.exit(0);
  }

  console.log(`\n✍️  AI Review complete. Found ${result.issues.length} issue(s).`);
  console.log(`   Assessment: ${result.overallAssessment}\n`);

  // Post comments to PR
  try {
    await postReviewComments(prInfo, result, rawDiff);
    console.log("💬 Review comments posted to PR.\n");
  } catch (error: any) {
    console.error(`⚠️  Failed to post review comments: ${error.message}`);
  }

  // Check for blocking issues
  const criticalIssues = result.issues.filter((i) =>
    CONFIG.criticalSeverities.includes(i.severity)
  );

  if (criticalIssues.length > 0) {
    console.error(`❌ AI Review found ${criticalIssues.length} critical/high issue(s):\n`);
    for (const issue of criticalIssues) {
      console.error(`  [${issue.severity.toUpperCase()}] ${issue.file}:${issue.line} - ${issue.message}`);
    }
    console.error("\n❌ CI failed due to critical issues found by AI review.");
    process.exit(1);
  }

  console.log("✅ AI Review passed. No critical issues found.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error in AI review:", err);
  process.exit(0); // Don't block CI on unexpected errors
});
