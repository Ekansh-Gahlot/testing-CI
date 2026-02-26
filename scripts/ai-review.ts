import { execSync } from "child_process";
import * as fs from "fs";
import OpenAI from "openai";
import { Octokit } from "@octokit/rest";

// ============================================================================
// CONFIGURATION
// ============================================================================

interface AIReviewConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  criticalSeverities: string[];
  maxDiffTokens: number;
}

const CONFIG: AIReviewConfig = {
  model: "gpt-5.2",
  maxTokens: 4096,
  temperature: 0.2,
  criticalSeverities: ["critical", "high"],
  maxDiffTokens: 30000,
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
// OPENAI INTEGRATION
// ============================================================================

const SYSTEM_PROMPT = `You are an expert code reviewer for a TypeScript/Node.js project using Vitest.
Review the following code changes from a pull request for production readiness.

For each issue found, respond with a JSON object in the following exact schema:
{
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": <line number in the new file>,
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "security" | "performance" | "error-handling" | "best-practice" | "production-readiness",
      "message": "Description of the issue",
      "suggestion": "Optional suggested fix"
    }
  ],
  "summary": "Overall summary of the review in 2-4 sentences.",
  "overallAssessment": "approve" | "request-changes" | "comment"
}

Severity definitions:
- critical: Security vulnerabilities, data loss risks, crashes in production. MUST be fixed before merge.
- high: Serious bugs, missing error handling that will cause failures, exposed secrets. Should be fixed before merge.
- medium: Performance issues, code smells, missing edge cases. Should be addressed.
- low: Style issues, minor improvements, optional refactoring.
- info: Observations, positive feedback, educational notes.

Rules:
- Only flag real issues. Do not invent problems.
- "line" must reference a line number that exists in the NEW version of the file (the + side of the diff).
- Use "request-changes" as overallAssessment only if there are critical or high severity issues.
- If the code looks good, use "approve" with an empty issues array.
- Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`;

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

async function callOpenAI(userPrompt: string): Promise<ReviewResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: CONFIG.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: CONFIG.maxTokens,
    temperature: CONFIG.temperature,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  const parsed = JSON.parse(content) as ReviewResult;

  if (!Array.isArray(parsed.issues) || typeof parsed.summary !== "string") {
    throw new Error("Invalid response structure from OpenAI");
  }

  return parsed;
}

async function reviewDiff(hunks: DiffHunk[]): Promise<ReviewResult> {
  const chunks = chunkHunks(hunks);

  if (chunks.length === 1) {
    const userPrompt = buildUserPrompt(chunks[0]);
    return callOpenAI(userPrompt);
  }

  // Multiple chunks: review each and merge results
  console.log(`  Diff is large, splitting into ${chunks.length} chunks...`);

  const allIssues: ReviewIssue[] = [];
  const summaries: string[] = [];
  let worstAssessment: ReviewResult["overallAssessment"] = "approve";

  for (let i = 0; i < chunks.length; i++) {
    console.log(`  Reviewing chunk ${i + 1}/${chunks.length}...`);
    const userPrompt = buildUserPrompt(chunks[i]);
    const result = await callOpenAI(userPrompt);

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

  const inlineComments: Array<{ path: string; position: number; body: string }> = [];
  const unmappedIssues: ReviewIssue[] = [];

  for (const issue of result.issues) {
    const key = `${issue.file}:${issue.line}`;
    const position = positionMap[key];
    const commentBody = formatIssueComment(issue);

    if (position) {
      inlineComments.push({
        path: issue.file,
        position,
        body: commentBody,
      });
    } else {
      unmappedIssues.push(issue);
    }
  }

  // Build summary body
  let summaryBody = `## 🤖 AI Code Review\n\n${result.summary}\n\n`;
  summaryBody += `**Model**: ${CONFIG.model}\n`;
  summaryBody += `**Issues found**: ${result.issues.length}\n`;

  const criticalCount = result.issues.filter(
    (i) => CONFIG.criticalSeverities.includes(i.severity)
  ).length;

  if (criticalCount > 0) {
    summaryBody += `**Critical/High issues**: ${criticalCount} ⛔ (CI will fail)\n`;
  }

  if (unmappedIssues.length > 0) {
    summaryBody += `\n### Additional Issues\n\n`;
    for (const issue of unmappedIssues) {
      summaryBody += `- ${formatIssueComment(issue)}\n`;
    }
  }

  const event = criticalCount > 0 ? "REQUEST_CHANGES" as const : "COMMENT" as const;

  await octokit.pulls.createReview({
    owner: prInfo.owner,
    repo: prInfo.repo,
    pull_number: prInfo.pullNumber,
    commit_id: prInfo.headSha,
    body: summaryBody,
    event,
    comments: inlineComments,
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log("🤖 AI Code Review - Starting...\n");

  // Validate environment
  if (!process.env.OPENAI_API_KEY) {
    console.log("⚠️  OPENAI_API_KEY is not set. Skipping AI review.");
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

  // Call OpenAI for review
  console.log("🔍 Sending code to AI for review...");
  let result: ReviewResult;
  try {
    result = await reviewDiff(hunks);
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
