// import { execSync } from "child_process";

// const labels = process.env.PR_LABELS?.split(",") || [];

// console.log("PR_LABELS:", labels);
// // 1. If label exists → skip check
// if (labels.includes("no-test-needed")) {
//   console.log("🟢 no-test-needed label found. Skipping test enforcement.");
//   process.exit(0);
// }

// // 2. Normal enforcement
// const diff = execSync("git diff --name-only origin/main...HEAD")
//   .toString()
//   .trim()
//   .split("\n");

// const srcChanged = diff.some(f => f.startsWith("src/") && !f.includes(".test."));
// const testChanged = diff.some(f => f.includes(".test."));

// if (srcChanged && !testChanged) {
//   console.error("❌ Source files changed but no test files were updated.");
//   process.exit(1);
// }
// blablaba
// console.log("✅ Test update check passed.");

// #!/usr/bin/env ts-node
/**
 * Smart Test Enforcement Script
 * 
 * Instead of just checking if test files changed, this script:
 * 1. Analyzes which functions were modified in source files (using AST)
 * 2. Checks if those specific functions have test cases in test files
 * 3. Fails if modified functions are missing test coverage
 * 
 * This is the same approach used by CodeGuard's auto test generation.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
const traverse = require("@babel/traverse").default;

// ============================================================================
// CONFIGURATION
// ============================================================================

interface Config {
  sourceExtensions: string[];  // File extensions to check
  testPatterns: string[];      // How to find test files
  excludePaths: string[];      // Paths to ignore
  skipLabel: string;          // Label to bypass check
}

const CONFIG: Config = {
  sourceExtensions: [".ts", ".tsx", ".js", ".jsx"],
  testPatterns: [
    "{name}.test.{ext}",    // foo.test.ts
    "{name}.spec.{ext}",    // foo.spec.ts
    "__tests__/{name}.{ext}", // __tests__/foo.ts
  ],
  excludePaths: [
    "node_modules/",
    "dist/",
    "build/",
    ".test.",
    ".spec.",
  ],
  skipLabel: "no-test-needed"
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
}

// ============================================================================
// AST PARSING - Extract functions from source files
// ============================================================================

/**
 * Parse a source file and extract all exported functions using AST
 */
function analyzeFileAST(filePath: string): FileAnalysis {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const functions: FunctionInfo[] = [];

    // Parse with TypeScript support
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

    // Traverse AST to find functions
    traverse(ast, {
      // Regular function declarations: function foo() {}
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

      // Arrow functions and const declarations: const foo = () => {}
      VariableDeclarator(path: any) {
        const node = path.node;
        if (
          node.id &&
          node.id.name &&
          (node.init?.type === "ArrowFunctionExpression" ||
           node.init?.type === "FunctionExpression")
        ) {
          // Check if parent is exported
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

/**
 * Get changed line numbers from git diff
 */
function getChangedLines(diff: string): Set<number> {
  const changedLines = new Set<number>();
  const lines = diff.split("\n");
  
  let currentLine = 0;
  for (const line of lines) {
    // Parse @@ line to get starting line number
    const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (match) {
      currentLine = parseInt(match[1], 10);
      continue;
    }
    
    // Track additions and context lines (skip deletions)
    if (line.startsWith("+") && !line.startsWith("+++")) {
      changedLines.add(currentLine);
      currentLine++;
    } else if (!line.startsWith("-") && !line.startsWith("---")) {
      currentLine++;
    }
  }
  
  return changedLines;
}

/**
 * Determine which functions contain changed lines
 */
function getChangedFunctions(
  filePath: string,
  diff: string
): string[] {
  const analysis = analyzeFileAST(filePath);
  
  if (!analysis.success || analysis.functions.length === 0) {
    console.log(`   ⚠️  Could not analyze ${filePath}: ${analysis.error || "no functions found"}`);
    return [];
  }

  const changedLines = getChangedLines(diff);
  if (changedLines.size === 0) {
    return [];
  }

  // Get file content to determine function boundaries
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const changedFunctionNames: string[] = [];
  const sortedFunctions = [...analysis.functions].sort((a, b) => a.line - b.line);

  for (let i = 0; i < sortedFunctions.length; i++) {
    const func = sortedFunctions[i];
    const nextFunc = sortedFunctions[i + 1];
    
    const functionStart = func.line;
    const functionEnd = nextFunc ? nextFunc.line - 1 : lines.length;

    // Check if any changed line falls within this function's range
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
// TEST FILE CHECKING - Find and analyze test files
// ============================================================================

/**
 * Find the corresponding test file for a source file
 */
function findTestFile(sourceFile: string): string | null {
  const dir = path.dirname(sourceFile);
  const basename = path.basename(sourceFile);
  const nameWithoutExt = basename.replace(/\.(ts|tsx|js|jsx)$/, "");
  const ext = path.extname(sourceFile).slice(1); // Remove the dot

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

/**
 * Check if a test file has test cases for a specific function
 * Looks for describe() blocks mentioning the function name
 */
function hasTestForFunction(testFilePath: string, functionName: string): boolean {
  try {
    const content = fs.readFileSync(testFilePath, "utf-8");
    
    // Look for describe blocks that mention this function
    // Patterns:
    // - describe("functionName", ...)
    // - describe('functionName', ...)
    // - describe(`functionName`, ...)
    // - describe("SomeContext - functionName", ...) // with prefix
    const patterns = [
      new RegExp(`describe\\s*\\(\\s*['"\`]${functionName}['"\`]\\s*,`, "g"),
      new RegExp(`describe\\s*\\(\\s*['"\`][^'"\`]*[\\s-]${functionName}['"\`]\\s*,`, "g"),
      // Also check for test/it blocks with function name
      new RegExp(`(?:test|it)\\s*\\(\\s*['"\`][^'"\`]*${functionName}[^'"\`]*['"\`]`, "gi"),
    ];

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// GIT OPERATIONS - Get changed files and diffs
// ============================================================================

/**
 * Get changed source files from git diff
 */
function getChangedSourceFiles(): Array<{ file: string; diff: string }> {
  try {
    // Get list of changed files (staged + unstaged, vs main/master)
    const diffOutput = execSync("git diff --name-only origin/main...HEAD", {
      encoding: "utf-8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);

    const changedFiles: Array<{ file: string; diff: string }> = [];

    for (const file of diffOutput) {
      // Skip if not a source file
      const ext = path.extname(file);
      if (!CONFIG.sourceExtensions.includes(ext)) {
        continue;
      }

      // Skip if in exclude paths
      if (CONFIG.excludePaths.some((exclude) => file.includes(exclude))) {
        continue;
      }

      // Skip if file doesn't exist (deleted files)
      if (!fs.existsSync(file)) {
        continue;
      }

      // Get the diff for this specific file
      try {
        const diff = execSync(`git diff origin/main...HEAD -- "${file}"`, {
          encoding: "utf-8",
        });
        
        changedFiles.push({ file, diff });
      } catch (error) {
        console.log(`   ⚠️  Could not get diff for ${file}`);
      }
    }

    return changedFiles;
  } catch (error: any) {
    console.error("❌ Error getting git changes:", error.message);
    return [];
  }
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function main() {
  console.log("🔍 Smart Test Enforcement - Checking function-level test coverage\n");

  // 1. Check for bypass label
  const labels = process.env.PR_LABELS?.split(",") || [];
  console.log("PR Labels:", labels.length > 0 ? labels.join(", ") : "(none)");
  
  if (labels.includes(CONFIG.skipLabel)) {
    console.log(`🟢 "${CONFIG.skipLabel}" label found. Skipping test enforcement.\n`);
    process.exit(0);
  }

  // 2. Get changed source files
  console.log("\n📂 Analyzing changed source files...\n");
  const changedFiles = getChangedSourceFiles();

  if (changedFiles.length === 0) {
    console.log("✅ No source files changed.\n");
    process.exit(0);
  }

  console.log(`Found ${changedFiles.length} changed source file(s):\n`);

  // 3. Analyze each file for changed functions
  const missingTests: ChangedFunction[] = [];
  const coveredFunctions: ChangedFunction[] = [];

  for (const { file, diff } of changedFiles) {
    console.log(`\n📄 ${file}`);
    
    // Get changed functions using AST
    const changedFunctionNames = getChangedFunctions(file, diff);
    
    if (changedFunctionNames.length === 0) {
      console.log("   ℹ️  No exported functions modified");
      continue;
    }

    console.log(`   📍 Changed functions: ${changedFunctionNames.join(", ")}`);

    // Find corresponding test file
    const testFile = findTestFile(file);
    
    if (!testFile) {
      console.log(`   ⚠️  No test file found!`);
      
      // All changed functions are missing tests
      for (const funcName of changedFunctionNames) {
        missingTests.push({
          file,
          functionName: funcName,
          hasTest: false,
          testFile: null,
        });
      }
      continue;
    }

    console.log(`   🧪 Test file: ${testFile}`);

    // Check if each changed function has tests
    for (const funcName of changedFunctionNames) {
      const hasTest = hasTestForFunction(testFile, funcName);
      
      if (hasTest) {
        console.log(`   ✅ ${funcName} - has test coverage`);
        coveredFunctions.push({
          file,
          functionName: funcName,
          hasTest: true,
          testFile,
        });
      } else {
        console.log(`   ❌ ${funcName} - MISSING test coverage`);
        missingTests.push({
          file,
          functionName: funcName,
          hasTest: false,
          testFile,
        });
      }
    }
  }

  // 4. Report results
  console.log("\n" + "=".repeat(70));
  console.log("📊 TEST COVERAGE REPORT");
  console.log("=".repeat(70));

  console.log(`\n✅ Functions with test coverage: ${coveredFunctions.length}`);
  if (coveredFunctions.length > 0) {
    for (const func of coveredFunctions) {
      console.log(`   • ${func.functionName} (${func.file})`);
    }
  }

  console.log(`\n❌ Functions missing test coverage: ${missingTests.length}`);
  if (missingTests.length > 0) {
    for (const func of missingTests) {
      console.log(`   • ${func.functionName} (${func.file})`);
      if (!func.testFile) {
        console.log(`     → No test file found!`);
      } else {
        console.log(`     → Add tests to: ${func.testFile}`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));

  // 5. Exit with error if any functions are missing tests
  if (missingTests.length > 0) {
    console.error("\n❌ TEST ENFORCEMENT FAILED");
    console.error(`\n${missingTests.length} function(s) were modified but don't have test coverage.`);
    console.error("\nOptions:");
    console.error(`  1. Add test cases for the missing functions`);
    console.error(`  2. Add the "${CONFIG.skipLabel}" label to bypass this check`);
    console.error(`  3. Use CodeGuard to auto-generate tests: npx codeguard auto\n`);
    process.exit(1);
  }

  console.log("\n✅ TEST ENFORCEMENT PASSED");
  console.log(`All ${coveredFunctions.length} modified function(s) have test coverage!\n`);
  process.exit(0);
}

// Run the script
main();
