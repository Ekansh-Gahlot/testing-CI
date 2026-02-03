import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
const traverse = require("@babel/traverse").default;

// ============================================================================
// CONFIGURATION
// ============================================================================

interface Config {
  sourceExtensions: string[];
  testPatterns: string[];
  excludePaths: string[];
  skipLabel: string;
  coverageThreshold: number;  // Minimum coverage percentage required
  coverageReportPath: string; // Path to coverage report
  testCommand: string;        // Command to run tests with coverage
}

const CONFIG: Config = {
  sourceExtensions: [".ts", ".tsx", ".js", ".jsx"],
  testPatterns: [
    "{name}.test.{ext}",
    "{name}.spec.{ext}",
    "__tests__/{name}.{ext}",
    "tests/{name}.test.{ext}",
  ],
  excludePaths: [
    "node_modules/",
    "dist/",
    "build/",
    ".test.",
    ".spec.",
  ],
  skipLabel: "no-test-needed",
  coverageThreshold: 70,
  coverageReportPath: "coverage/coverage-summary.json",
  testCommand: "yarn test:coverage"
};

// ============================================================================
// TYPES
// ============================================================================

interface FunctionInfo {
  name: string;
  type: "FunctionDeclaration" | "ArrowFunctionExpression" | "FunctionExpression";
  exported: boolean;
  async: boolean;
  line: number;
}

interface FileAnalysis {
  functions: FunctionInfo[];
  success: boolean;
  error?: string;
}

interface ChangedFunction {
  file: string;
  functionName: string;
  hasTest: boolean;
  testFile: string | null;
  lastModifiedCommit: string;
  testLastUpdatedCommit: string | null;
  needsUpdate: boolean;
}

interface CommitInfo {
  hash: string;
  message: string;
  timestamp: number;
}

interface CoverageSummary {
  total: {
    lines: { total: number; covered: number; pct: number };
    statements: { total: number; covered: number; pct: number };
    functions: { total: number; covered: number; pct: number };
    branches: { total: number; covered: number; pct: number };
  };
}

interface TestResult {
  passed: boolean;
  output: string;
  error?: string;
}

interface CoverageResult {
  passed: boolean;
  coverage: CoverageSummary | null;
  message: string;
}

// ============================================================================
// AST PARSING - Extract functions from source files
// ============================================================================

function analyzeFileAST(filePath: string): FileAnalysis {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const functions: FunctionInfo[] = [];

    const ast = babelParser.parse(content, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx",
        "decorators-legacy",
        "classProperties",
        "objectRestSpread",
      ],
    });

    traverse(ast, {
      FunctionDeclaration(path: any) {
        const node = path.node;
        if (node.id && node.id.name) {
          functions.push({
            name: node.id.name,
            type: "FunctionDeclaration",
            exported: path.parent.type === "ExportNamedDeclaration" ||
                     path.parent.type === "ExportDefaultDeclaration",
            async: node.async || false,
            line: node.loc?.start.line || 0,
          });
        }
      },

      VariableDeclarator(path: any) {
        const node = path.node;
        if (
          node.id &&
          node.id.name &&
          (node.init?.type === "ArrowFunctionExpression" ||
           node.init?.type === "FunctionExpression")
        ) {
          let currentPath = path;
          let isExported = false;
          
          while (currentPath.parent) {
            if (
              currentPath.parent.type === "ExportNamedDeclaration" ||
              currentPath.parent.type === "ExportDefaultDeclaration"
            ) {
              isExported = true;
              break;
            }
            currentPath = currentPath.parentPath;
          }

          functions.push({
            name: node.id.name,
            type: node.init.type,
            exported: isExported,
            async: node.init.async || false,
            line: node.loc?.start.line || 0,
          });
        }
      },
    });

    return { functions, success: true };
  } catch (error: any) {
    return {
      functions: [],
      success: false,
      error: error.message,
    };
  }
}

function getChangedLines(diff: string): Set<number> {
  const changedLines = new Set<number>();
  const lines = diff.split("\n");
  
  let currentLine = 0;
  for (const line of lines) {
    const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (match) {
      currentLine = parseInt(match[1], 10);
      continue;
    }
    
    if (line.startsWith("+") && !line.startsWith("+++")) {
      changedLines.add(currentLine);
      currentLine++;
    } else if (!line.startsWith("-") && !line.startsWith("---")) {
      currentLine++;
    }
  }
  
  return changedLines;
}

function getChangedFunctions(filePath: string, diff: string): string[] {
  const analysis = analyzeFileAST(filePath);
  
  if (!analysis.success || analysis.functions.length === 0) {
    return [];
  }

  const changedLines = getChangedLines(diff);
  if (changedLines.size === 0) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const changedFunctionNames: string[] = [];
  const sortedFunctions = [...analysis.functions].sort((a, b) => a.line - b.line);

  for (let i = 0; i < sortedFunctions.length; i++) {
    const func = sortedFunctions[i];
    const nextFunc = sortedFunctions[i + 1];
    
    const functionStart = func.line;
    const functionEnd = nextFunc ? nextFunc.line - 1 : lines.length;

    for (const changedLine of changedLines) {
      if (changedLine >= functionStart && changedLine <= functionEnd) {
        if (func.exported) {
          changedFunctionNames.push(func.name);
        }
        break;
      }
    }
  }

  return changedFunctionNames;
}

// ============================================================================
// TEST FILE CHECKING
// ============================================================================

function findTestFile(sourceFile: string): string | null {
  const dir = path.dirname(sourceFile);
  const basename = path.basename(sourceFile);
  const nameWithoutExt = basename.replace(/\.(ts|tsx|js|jsx)$/, "");
  const ext = path.extname(sourceFile).slice(1);

  for (const pattern of CONFIG.testPatterns) {
    const testPath = pattern
      .replace("{name}", nameWithoutExt)
      .replace("{ext}", ext);
    
    const fullPath = path.join(dir, testPath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

function hasTestForFunction(testFilePath: string, functionName: string): boolean {
  try {
    const content = fs.readFileSync(testFilePath, "utf-8");
    
    // Parse the test file with AST
    const ast = babelParser.parse(content, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx",
        "decorators-legacy",
        "classProperties",
        "objectRestSpread",
      ],
    });

    let found = false;

    // Traverse AST to find test/describe/it calls
    traverse(ast, {
      CallExpression(path: any) {
        const node = path.node;
        
        // Check if it's a test function call (describe, test, it, etc.)
        const isTestCall = 
          (node.callee.type === "Identifier" && 
           ["describe", "test", "it", "expect"].includes(node.callee.name)) ||
          (node.callee.type === "MemberExpression" &&
           node.callee.object.type === "Identifier" &&
           ["describe", "test", "it"].includes(node.callee.object.name));

        if (isTestCall && node.arguments.length > 0) {
          const firstArg = node.arguments[0];
          
          // Check if the first argument (test description) is a string literal
          if (firstArg.type === "StringLiteral" || firstArg.type === "TemplateLiteral") {
            let testDescription = "";
            
            if (firstArg.type === "StringLiteral") {
              testDescription = firstArg.value;
            } else if (firstArg.type === "TemplateLiteral") {
              // Handle template literals
              testDescription = firstArg.quasis.map((q: any) => q.value.raw).join("");
            }
            
            // Check if the function name appears in the test description
            if (testDescription.includes(functionName)) {
              found = true;
              path.stop(); // Stop traversal once found
            }
          }
        }
      },
    });

    return found;
  } catch (error) {
    // Fallback: if AST parsing fails, return false
    return false;
  }
}

// ============================================================================
// GIT OPERATIONS - Per-commit tracking
// ============================================================================

function getCommitsInPR(): CommitInfo[] {
  try {
    const output = execSync(
      'git log origin/main..HEAD --pretty=format:"%H|%s|%at" --reverse',
      { encoding: "utf-8" }
    ).trim();

    if (!output) {
      return [];
    }

    return output.split("\n").map(line => {
      const [hash, message, timestamp] = line.split("|");
      return {
        hash,
        message,
        timestamp: parseInt(timestamp, 10)
      };
    });
  } catch (error) {
    console.error("❌ Error getting commits:", error);
    return [];
  }
}

function getLastCommitForFile(filePath: string, commits: CommitInfo[]): string | null {
  try {
    const output = execSync(
      `git log origin/main..HEAD --pretty=format:"%H" -- "${filePath}"`,
      { encoding: "utf-8" }
    ).trim();

    if (!output) {
      return null;
    }

    const commitHashes = output.split("\n");
    
    for (let i = commits.length - 1; i >= 0; i--) {
      if (commitHashes.includes(commits[i].hash)) {
        return commits[i].hash;
      }
    }

    return commitHashes[0] || null;
  } catch (error) {
    return null;
  }
}

function getFilesChangedInCommit(commitHash: string): string[] {
  try {
    const output = execSync(
      `git diff-tree --no-commit-id --name-only -r ${commitHash}`,
      { encoding: "utf-8" }
    ).trim();

    return output ? output.split("\n") : [];
  } catch (error) {
    return [];
  }
}

function getDiffForFileInCommit(commitHash: string, filePath: string): string {
  try {
    return execSync(
      `git show ${commitHash} -- "${filePath}"`,
      { encoding: "utf-8" }
    );
  } catch (error) {
    return "";
  }
}

function wasFileModifiedAfterCommit(
  filePath: string,
  afterCommitHash: string,
  commits: CommitInfo[]
): boolean {
  const lastCommit = getLastCommitForFile(filePath, commits);
  
  if (!lastCommit) {
    return false;
  }

  const afterIndex = commits.findIndex(c => c.hash === afterCommitHash);
  const lastIndex = commits.findIndex(c => c.hash === lastCommit);

  return lastIndex >= afterIndex;
}

// ============================================================================
// TEST EXECUTION AND COVERAGE
// ============================================================================

/**
 * Run all tests and generate coverage report
 */
function runTestsWithCoverage(): TestResult {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 RUNNING TESTS WITH COVERAGE");
  console.log("=".repeat(70));
  console.log(`\nExecuting: ${CONFIG.testCommand}\n`);

  try {
    const output = execSync(CONFIG.testCommand, {
      encoding: "utf-8",
      stdio: "pipe",
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    console.log(output);
    
    return {
      passed: true,
      output: output,
    };
  } catch (error: any) {
    // Tests failed or command error
    const output = error.stdout || error.stderr || error.message;
    console.error(output);
    
    return {
      passed: false,
      output: output,
      error: error.message,
    };
  }
}

/**
 * Parse coverage report and check if it meets threshold
 */
function checkCoverageThreshold(): CoverageResult {
  console.log("\n" + "=".repeat(70));
  console.log("📊 CHECKING COVERAGE THRESHOLD");
  console.log("=".repeat(70));

  // Check if coverage report exists
  if (!fs.existsSync(CONFIG.coverageReportPath)) {
    return {
      passed: false,
      coverage: null,
      message: `Coverage report not found at ${CONFIG.coverageReportPath}`,
    };
  }

  try {
    // Read and parse coverage report
    const coverageData = JSON.parse(
      fs.readFileSync(CONFIG.coverageReportPath, "utf-8")
    ) as CoverageSummary;

    const { total } = coverageData;
    
    console.log("\n📈 Coverage Summary:");
    console.log(`   Lines:      ${total.lines.pct.toFixed(2)}% (${total.lines.covered}/${total.lines.total})`);
    console.log(`   Statements: ${total.statements.pct.toFixed(2)}% (${total.statements.covered}/${total.statements.total})`);
    console.log(`   Functions:  ${total.functions.pct.toFixed(2)}% (${total.functions.covered}/${total.functions.total})`);
    console.log(`   Branches:   ${total.branches.pct.toFixed(2)}% (${total.branches.covered}/${total.branches.total})`);

    // Check all coverage metrics against threshold
    const metrics = [
      { name: "Lines", pct: total.lines.pct },
      { name: "Statements", pct: total.statements.pct },
      { name: "Functions", pct: total.functions.pct },
      { name: "Branches", pct: total.branches.pct },
    ];

    const failedMetrics = metrics.filter(m => m.pct < CONFIG.coverageThreshold);

    if (failedMetrics.length > 0) {
      const failureMessage = failedMetrics
        .map(m => `${m.name}: ${m.pct.toFixed(2)}% < ${CONFIG.coverageThreshold}%`)
        .join("\n   ");

      return {
        passed: false,
        coverage: coverageData,
        message: `Coverage below ${CONFIG.coverageThreshold}% threshold:\n   ${failureMessage}`,
      };
    }

    return {
      passed: true,
      coverage: coverageData,
      message: `All coverage metrics meet or exceed ${CONFIG.coverageThreshold}% threshold`,
    };
  } catch (error: any) {
    return {
      passed: false,
      coverage: null,
      message: `Error reading coverage report: ${error.message}`,
    };
  }
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

function analyzeCommitByCommit(): ChangedFunction[] {
  const commits = getCommitsInPR();
  
  if (commits.length === 0) {
    console.log("ℹ️  No commits found in PR");
    return [];
  }

  console.log(`\n📋 Found ${commits.length} commit(s) in PR:\n`);
  commits.forEach((commit, idx) => {
    const date = new Date(commit.timestamp * 1000).toLocaleString();
    console.log(`   ${idx + 1}. ${commit.hash.substring(0, 7)} - ${commit.message} (${date})`);
  });

  const allIssues: ChangedFunction[] = [];
  const functionLastModified = new Map<string, { commitHash: string; commitIndex: number }>();

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📝 Commit ${i + 1}/${commits.length}: ${commit.hash.substring(0, 7)} - ${commit.message}`);
    console.log("=".repeat(70));

    const filesInCommit = getFilesChangedInCommit(commit.hash);
    const sourceFilesInCommit = filesInCommit.filter(file => {
      const ext = path.extname(file);
      return CONFIG.sourceExtensions.includes(ext) &&
             !CONFIG.excludePaths.some(exclude => file.includes(exclude)) &&
             fs.existsSync(file);
    });

    if (sourceFilesInCommit.length === 0) {
      console.log("   ℹ️  No source files changed in this commit");
      continue;
    }

    for (const file of sourceFilesInCommit) {
      console.log(`\n   📄 ${file}`);
      
      const diff = getDiffForFileInCommit(commit.hash, file);
      const changedFunctions = getChangedFunctions(file, diff);

      if (changedFunctions.length === 0) {
        console.log("      ℹ️  No exported functions modified");
        continue;
      }

      console.log(`      📍 Changed functions: ${changedFunctions.join(", ")}`);

      const testFile = findTestFile(file);
      
      if (!testFile) {
        console.log(`      ⚠️  No test file found!`);
        
        for (const funcName of changedFunctions) {
          const key = `${file}::${funcName}`;
          functionLastModified.set(key, { commitHash: commit.hash, commitIndex: i });
          
          allIssues.push({
            file,
            functionName: funcName,
            hasTest: false,
            testFile: null,
            lastModifiedCommit: commit.hash,
            testLastUpdatedCommit: null,
            needsUpdate: true,
          });
        }
        continue;
      }

      console.log(`      🧪 Test file: ${testFile}`);

      const testModifiedAfter = wasFileModifiedAfterCommit(testFile, commit.hash, commits);

      for (const funcName of changedFunctions) {
        const key = `${file}::${funcName}`;
        const hasTest = hasTestForFunction(testFile, funcName);
        
        functionLastModified.set(key, { commitHash: commit.hash, commitIndex: i });

        if (hasTest && testModifiedAfter) {
          console.log(`      ✅ ${funcName} - has test and test was updated in/after this commit`);
        } else if (hasTest && !testModifiedAfter) {
          console.log(`      ❌ ${funcName} - has test but test NOT updated in/after this commit`);
        } else {
          console.log(`      ❌ ${funcName} - MISSING test coverage`);
        }
      }
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("🔍 FINAL VALIDATION - Checking current state of all modified functions");
  console.log("=".repeat(70));

  const finalIssues: ChangedFunction[] = [];
  const coveredFunctions: ChangedFunction[] = [];

  for (const [key, { commitHash, commitIndex }] of functionLastModified.entries()) {
    const [file, funcName] = key.split("::");
    const testFile = findTestFile(file);

    if (!testFile) {
      finalIssues.push({
        file,
        functionName: funcName,
        hasTest: false,
        testFile: null,
        lastModifiedCommit: commitHash,
        testLastUpdatedCommit: null,
        needsUpdate: true,
      });
      continue;
    }

    const hasTest = hasTestForFunction(testFile, funcName);
    const testLastCommit = getLastCommitForFile(testFile, commits);
    
    const testUpdatedAfter = testLastCommit ? 
      commits.findIndex(c => c.hash === testLastCommit) >= commitIndex : 
      false;

    if (hasTest && testUpdatedAfter) {
      coveredFunctions.push({
        file,
        functionName: funcName,
        hasTest: true,
        testFile,
        lastModifiedCommit: commitHash,
        testLastUpdatedCommit: testLastCommit,
        needsUpdate: false,
      });
    } else {
      finalIssues.push({
        file,
        functionName: funcName,
        hasTest,
        testFile,
        lastModifiedCommit: commitHash,
        testLastUpdatedCommit: testLastCommit,
        needsUpdate: true,
      });
    }
  }

  console.log(`\n✅ Functions with up-to-date tests: ${coveredFunctions.length}`);
  for (const func of coveredFunctions) {
    console.log(`   • ${func.functionName} (${func.file})`);
    console.log(`     Last modified: ${func.lastModifiedCommit.substring(0, 7)}`);
    console.log(`     Test updated: ${func.testLastUpdatedCommit?.substring(0, 7)}`);
  }

  console.log(`\n❌ Functions needing test updates: ${finalIssues.length}`);
  for (const func of finalIssues) {
    console.log(`   • ${func.functionName} (${func.file})`);
    console.log(`     Last modified: ${func.lastModifiedCommit.substring(0, 7)}`);
    
    if (!func.testFile) {
      console.log(`     ❌ No test file found`);
    } else if (!func.hasTest) {
      console.log(`     ❌ No test coverage in: ${func.testFile}`);
    } else if (!func.testLastUpdatedCommit) {
      console.log(`     ⚠️  Test exists but was not updated in this PR: ${func.testFile}`);
    } else {
      const funcCommitIdx = commits.findIndex(c => c.hash === func.lastModifiedCommit);
      const testCommitIdx = commits.findIndex(c => c.hash === func.testLastUpdatedCommit);
      
      if (testCommitIdx < funcCommitIdx) {
        console.log(`     ❌ Test last updated: ${func.testLastUpdatedCommit.substring(0, 7)}`);
        console.log(`     ❌ Test was updated BEFORE the function change!`);
      } else {
        console.log(`     ⚠️  Test needs update in: ${func.testFile}`);
      }
    }
  }

  return finalIssues;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log("🔍 Smart Test Enforcement - Per-Commit Validation with Coverage\n");
  console.log("This script enforces:");
  console.log("  1. Function-level test coverage tracking");
  console.log("  2. Per-commit test update validation");
  console.log(`  3. Minimum ${CONFIG.coverageThreshold}% code coverage`);
  console.log("  4. All tests must pass\n");

  // Check for bypass label
  const labels = process.env.PR_LABELS?.split(",") || [];
  console.log("PR Labels:", labels.length > 0 ? labels.join(", ") : "(none)");
  
  if (labels.includes(CONFIG.skipLabel)) {
    console.log(`🟢 "${CONFIG.skipLabel}" label found. Skipping test enforcement.\n`);
    process.exit(0);
  }

  // Step 1: Analyze commit-by-commit test coverage
  const issues = analyzeCommitByCommit();

  // Step 2: Run tests with coverage
  const testResult = runTestsWithCoverage();

  // Step 3: Check coverage threshold
  const coverageResult = checkCoverageThreshold();

  // ============================================================================
  // FINAL REPORT
  // ============================================================================

  console.log("\n" + "=".repeat(70));
  console.log("📊 FINAL ENFORCEMENT REPORT");
  console.log("=".repeat(70));

  let allPassed = true;
  const failures: string[] = [];

  // Check 1: Function-level test coverage
  console.log("\n1️⃣  Function-Level Test Coverage:");
  if (issues.length === 0) {
    console.log("   ✅ PASSED - All modified functions have up-to-date test coverage");
  } else {
    console.log(`   ❌ FAILED - ${issues.length} function(s) need test updates`);
    allPassed = false;
    failures.push("Function-level test coverage");

    const noTestFile = issues.filter(f => !f.testFile);
    const noTestCoverage = issues.filter(f => f.testFile && !f.hasTest);
    const outdatedTests = issues.filter(f => f.testFile && f.hasTest);

    if (noTestFile.length > 0) {
      console.log(`      • ${noTestFile.length} function(s) have no test file`);
    }
    if (noTestCoverage.length > 0) {
      console.log(`      • ${noTestCoverage.length} function(s) have no test coverage`);
    }
    if (outdatedTests.length > 0) {
      console.log(`      • ${outdatedTests.length} function(s) have tests but weren't updated after changes`);
    }
  }

  // Check 2: Test execution
  console.log("\n2️⃣  Test Execution:");
  if (testResult.passed) {
    console.log("   ✅ PASSED - All tests executed successfully");
  } else {
    console.log("   ❌ FAILED - Some tests failed or error occurred");
    allPassed = false;
    failures.push("Test execution");
  }

  // Check 3: Coverage threshold
  console.log("\n3️⃣  Coverage Threshold:");
  if (coverageResult.passed) {
    console.log(`   ✅ PASSED - ${coverageResult.message}`);
    if (coverageResult.coverage) {
      const { total } = coverageResult.coverage;
      console.log(`      • Lines: ${total.lines.pct.toFixed(2)}%`);
      console.log(`      • Statements: ${total.statements.pct.toFixed(2)}%`);
      console.log(`      • Functions: ${total.functions.pct.toFixed(2)}%`);
      console.log(`      • Branches: ${total.branches.pct.toFixed(2)}%`);
    }
  } else {
    console.log(`   ❌ FAILED - ${coverageResult.message}`);
    allPassed = false;
    failures.push("Coverage threshold");
  }

  console.log("\n" + "=".repeat(70));

  // Final verdict
  if (allPassed) {
    console.log("\n✅ ✅ ✅  ALL CHECKS PASSED  ✅ ✅ ✅");
    console.log("\nYour code meets all quality standards:");
    console.log("  ✓ Function-level tests are up-to-date");
    console.log("  ✓ All tests pass");
    console.log(`  ✓ Coverage is above ${CONFIG.coverageThreshold}%`);
    console.log("\nGreat work! 🎉\n");
    process.exit(0);
  } else {
    console.error("\n❌ ❌ ❌  ENFORCEMENT FAILED  ❌ ❌ ❌");
    console.error(`\nThe following check(s) failed: ${failures.join(", ")}`);
    
    console.error("\n📋 Action Items:");
    
    if (issues.length > 0) {
      console.error("\n   Function-Level Test Coverage:");
      const noTests = issues.filter(f => !f.hasTest);
      const outdatedTests = issues.filter(f => f.hasTest && !f.testLastUpdatedCommit);
      
      if (noTests.length > 0) {
        console.error(`      • Add test coverage for ${noTests.length} function(s)`);
      }
      if (outdatedTests.length > 0) {
        console.error(`      • Update tests for ${outdatedTests.length} modified function(s)`);
      }
    }

    if (!testResult.passed) {
      console.error("\n   Test Execution:");
      console.error("      • Fix failing tests");
      console.error("      • Review test output above for details");
    }

    if (!coverageResult.passed) {
      console.error("\n   Coverage Threshold:");
      console.error(`      • Increase test coverage to at least ${CONFIG.coverageThreshold}%`);
      console.error("      • Add tests for uncovered code paths");
    }

    console.error("\n🛠️  Options:");
    console.error(`   1. Fix the issues listed above`);
    console.error(`   2. Add the "${CONFIG.skipLabel}" label to bypass this check`);
    console.error(`   3. Use CodeGuard/AI to generate tests\n`);
    
    process.exit(1);
  }
}

// Run the script
main();