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



// PART 2

// import { execSync } from "child_process";
// import * as fs from "fs";
// import * as path from "path";
// import * as babelParser from "@babel/parser";
// const traverse = require("@babel/traverse").default;

// // ============================================================================
// // CONFIGURATION
// // ============================================================================

// interface Config {
//   sourceExtensions: string[];  // File extensions to check
//   testPatterns: string[];      // How to find test files
//   excludePaths: string[];      // Paths to ignore
//   skipLabel: string;          // Label to bypass check
// }

// const CONFIG: Config = {
//   sourceExtensions: [".ts", ".tsx", ".js", ".jsx"],
//   testPatterns: [
//     "{name}.test.{ext}",    // foo.test.ts
//     "{name}.spec.{ext}",    // foo.spec.ts
//     "__tests__/{name}.{ext}", // __tests__/foo.ts
//     "tests/{name}.test.{ext}", // tests/foo.test.ts
//   ],
//   excludePaths: [
//     "node_modules/",
//     "dist/",
//     "build/",
//     ".test.",
//     ".spec.",
//   ],
//   skipLabel: "no-test-needed"
// };

// // ============================================================================
// // TYPES
// // ============================================================================

// interface FunctionInfo {
//   name: string;
//   type: "FunctionDeclaration" | "ArrowFunctionExpression" | "FunctionExpression";
//   exported: boolean;
//   async: boolean;
//   line: number;
// }

// interface FileAnalysis {
//   functions: FunctionInfo[];
//   success: boolean;
//   error?: string;
// }

// interface ChangedFunction {
//   file: string;
//   functionName: string;
//   hasTest: boolean;
//   testFile: string | null;
//   testWasUpdated: boolean;
// }

// // ============================================================================
// // AST PARSING - Extract functions from source files
// // ============================================================================

// /**
//  * Parse a source file and extract all exported functions using AST
//  */
// function analyzeFileAST(filePath: string): FileAnalysis {
//   try {
//     const content = fs.readFileSync(filePath, "utf-8");
//     const functions: FunctionInfo[] = [];

//     // Parse with TypeScript support
//     const ast = babelParser.parse(content, {
//       sourceType: "module",
//       plugins: [
//         "typescript",
//         "jsx",
//         "decorators-legacy",
//         "classProperties",
//         "objectRestSpread",
//       ],
//     });

//     // Traverse AST to find functions
//     traverse(ast, {
//       // Regular function declarations: function foo() {}
//       FunctionDeclaration(path: any) {
//         const node = path.node;
//         if (node.id && node.id.name) {
//           functions.push({
//             name: node.id.name,
//             type: "FunctionDeclaration",
//             exported: path.parent.type === "ExportNamedDeclaration" ||
//                      path.parent.type === "ExportDefaultDeclaration",
//             async: node.async || false,
//             line: node.loc?.start.line || 0,
//           });
//         }
//       },

//       // Arrow functions and const declarations: const foo = () => {}
//       VariableDeclarator(path: any) {
//         const node = path.node;
//         if (
//           node.id &&
//           node.id.name &&
//           (node.init?.type === "ArrowFunctionExpression" ||
//            node.init?.type === "FunctionExpression")
//         ) {
//           // Check if parent is exported
//           let currentPath = path;
//           let isExported = false;
          
//           while (currentPath.parent) {
//             if (
//               currentPath.parent.type === "ExportNamedDeclaration" ||
//               currentPath.parent.type === "ExportDefaultDeclaration"
//             ) {
//               isExported = true;
//               break;
//             }
//             currentPath = currentPath.parentPath;
//           }

//           functions.push({
//             name: node.id.name,
//             type: node.init.type,
//             exported: isExported,
//             async: node.init.async || false,
//             line: node.loc?.start.line || 0,
//           });
//         }
//       },
//     });

//     return { functions, success: true };
//   } catch (error: any) {
//     return {
//       functions: [],
//       success: false,
//       error: error.message,
//     };
//   }
// }

// /**
//  * Get changed line numbers from git diff
//  */
// function getChangedLines(diff: string): Set<number> {
//   const changedLines = new Set<number>();
//   const lines = diff.split("\n");
  
//   let currentLine = 0;
//   for (const line of lines) {
//     // Parse @@ line to get starting line number
//     const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
//     if (match) {
//       currentLine = parseInt(match[1], 10);
//       continue;
//     }
    
//     // Track additions and context lines (skip deletions)
//     if (line.startsWith("+") && !line.startsWith("+++")) {
//       changedLines.add(currentLine);
//       currentLine++;
//     } else if (!line.startsWith("-") && !line.startsWith("---")) {
//       currentLine++;
//     }
//   }
  
//   return changedLines;
// }

// /**
//  * Determine which functions contain changed lines
//  */
// function getChangedFunctions(
//   filePath: string,
//   diff: string
// ): string[] {
//   const analysis = analyzeFileAST(filePath);
  
//   if (!analysis.success || analysis.functions.length === 0) {
//     console.log(`   ⚠️  Could not analyze ${filePath}: ${analysis.error || "no functions found"}`);
//     return [];
//   }

//   const changedLines = getChangedLines(diff);
//   if (changedLines.size === 0) {
//     return [];
//   }

//   // Get file content to determine function boundaries
//   const content = fs.readFileSync(filePath, "utf-8");
//   const lines = content.split("\n");

//   const changedFunctionNames: string[] = [];
//   const sortedFunctions = [...analysis.functions].sort((a, b) => a.line - b.line);

//   for (let i = 0; i < sortedFunctions.length; i++) {
//     const func = sortedFunctions[i];
//     const nextFunc = sortedFunctions[i + 1];
    
//     const functionStart = func.line;
//     const functionEnd = nextFunc ? nextFunc.line - 1 : lines.length;

//     // Check if any changed line falls within this function's range
//     for (const changedLine of changedLines) {
//       if (changedLine >= functionStart && changedLine <= functionEnd) {
//         if (func.exported) {
//           changedFunctionNames.push(func.name);
//         }
//         break;
//       }
//     }
//   }

//   return changedFunctionNames;
// }

// // ============================================================================
// // TEST FILE CHECKING - Find and analyze test files
// // ============================================================================

// /**
//  * Find the corresponding test file for a source file
//  */
// function findTestFile(sourceFile: string): string | null {
//   const dir = path.dirname(sourceFile);
//   const basename = path.basename(sourceFile);
//   const nameWithoutExt = basename.replace(/\.(ts|tsx|js|jsx)$/, "");
//   const ext = path.extname(sourceFile).slice(1); // Remove the dot

//   for (const pattern of CONFIG.testPatterns) {
//     const testPath = pattern
//       .replace("{name}", nameWithoutExt)
//       .replace("{ext}", ext);
    
//     const fullPath = path.join(dir, testPath);
//     if (fs.existsSync(fullPath)) {
//       return fullPath;
//     }
//   }

//   return null;
// }

// /**
//  * Check if a test file has test cases for a specific function
//  * Looks for describe() blocks mentioning the function name
//  */
// function hasTestForFunction(testFilePath: string, functionName: string): boolean {
//   try {
//     const content = fs.readFileSync(testFilePath, "utf-8");
    
//     // Look for describe blocks that mention this function
//     // Patterns:
//     // - describe("functionName", ...)
//     // - describe('functionName', ...)
//     // - describe(`functionName`, ...)
//     // - describe("SomeContext - functionName", ...) // with prefix
//     const patterns = [
//       new RegExp(`describe\\s*\\(\\s*['"\`]${functionName}['"\`]\\s*,`, "g"),
//       new RegExp(`describe\\s*\\(\\s*['"\`][^'"\`]*[\\s-]${functionName}['"\`]\\s*,`, "g"),
//       // Also check for test/it blocks with function name
//       new RegExp(`(?:test|it)\\s*\\(\\s*['"\`][^'"\`]*${functionName}[^'"\`]*['"\`]`, "gi"),
//     ];

//     for (const pattern of patterns) {
//       if (pattern.test(content)) {
//         return true;
//       }
//     }

//     return false;
//   } catch (error) {
//     return false;
//   }
// }

// // ============================================================================
// // GIT OPERATIONS - Get changed files and diffs
// // ============================================================================

// /**
//  * Get ALL changed files from git diff (including test files)
//  */
// function getAllChangedFiles(): string[] {
//   try {
//     const diffOutput = execSync("git diff --name-only origin/main...HEAD", {
//       encoding: "utf-8",
//     })
//       .trim()
//       .split("\n")
//       .filter(Boolean);

//     return diffOutput;
//   } catch (error: any) {
//     console.error("❌ Error getting git changes:", error.message);
//     return [];
//   }
// }

// /**
//  * Get changed source files from git diff
//  */
// function getChangedSourceFiles(): Array<{ file: string; diff: string }> {
//   try {
//     const allFiles = getAllChangedFiles();
//     const changedFiles: Array<{ file: string; diff: string }> = [];

//     for (const file of allFiles) {
//       // Skip if not a source file
//       const ext = path.extname(file);
//       if (!CONFIG.sourceExtensions.includes(ext)) {
//         continue;
//       }

//       // Skip if in exclude paths
//       if (CONFIG.excludePaths.some((exclude) => file.includes(exclude))) {
//         continue;
//       }

//       // Skip if file doesn't exist (deleted files)
//       if (!fs.existsSync(file)) {
//         continue;
//       }

//       // Get the diff for this specific file
//       try {
//         const diff = execSync(`git diff origin/main...HEAD -- "${file}"`, {
//           encoding: "utf-8",
//         });
        
//         changedFiles.push({ file, diff });
//       } catch (error) {
//         console.log(`   ⚠️  Could not get diff for ${file}`);
//       }
//     }

//     return changedFiles;
//   } catch (error: any) {
//     console.error("❌ Error getting git changes:", error.message);
//     return [];
//   }
// }

// // ============================================================================
// // MAIN LOGIC
// // ============================================================================

// function main() {
//   console.log("🔍 Smart Test Enforcement - Checking function-level test coverage\n");

//   // 1. Check for bypass label
//   const labels = process.env.PR_LABELS?.split(",") || [];
//   console.log("PR Labels:", labels.length > 0 ? labels.join(", ") : "(none)");
  
//   if (labels.includes(CONFIG.skipLabel)) {
//     console.log(`🟢 "${CONFIG.skipLabel}" label found. Skipping test enforcement.\n`);
//     process.exit(0);
//   }

//   // 2. Get changed source files and all changed files
//   console.log("\n📂 Analyzing changed source files...\n");
//   const changedFiles = getChangedSourceFiles();
//   const allChangedFiles = getAllChangedFiles();

//   if (changedFiles.length === 0) {
//     console.log("✅ No source files changed.\n");
//     process.exit(0);
//   }

//   console.log(`Found ${changedFiles.length} changed source file(s):\n`);

//   // 3. Analyze each file for changed functions
//   const missingTests: ChangedFunction[] = [];
//   const coveredFunctions: ChangedFunction[] = [];

//   for (const { file, diff } of changedFiles) {
//     console.log(`\n📄 ${file}`);
    
//     // Get changed functions using AST
//     const changedFunctionNames = getChangedFunctions(file, diff);
    
//     if (changedFunctionNames.length === 0) {
//       console.log("   ℹ️  No exported functions modified");
//       continue;
//     }

//     console.log(`   📍 Changed functions: ${changedFunctionNames.join(", ")}`);

//     // Find corresponding test file
//     const testFile = findTestFile(file);
    
//     if (!testFile) {
//       console.log(`   ⚠️  No test file found!`);
      
//       // All changed functions are missing tests
//       for (const funcName of changedFunctionNames) {
//         missingTests.push({
//           file,
//           functionName: funcName,
//           hasTest: false,
//           testFile: null,
//           testWasUpdated: false,
//         });
//       }
//       continue;
//     }

//     console.log(`   🧪 Test file: ${testFile}`);

//     // Check if the test file was also modified in this PR
//     const testFileWasUpdated = allChangedFiles.includes(testFile);
    
//     if (testFileWasUpdated) {
//       console.log(`   📝 Test file was updated in this PR`);
//     } else {
//       console.log(`   ⚠️  Test file was NOT updated in this PR`);
//     }

//     // Check if each changed function has tests
//     for (const funcName of changedFunctionNames) {
//       const hasTest = hasTestForFunction(testFile, funcName);
      
//       if (hasTest && testFileWasUpdated) {
//         console.log(`   ✅ ${funcName} - has test coverage AND tests were updated`);
//         coveredFunctions.push({
//           file,
//           functionName: funcName,
//           hasTest: true,
//           testFile,
//           testWasUpdated: true,
//         });
//       } else if (hasTest && !testFileWasUpdated) {
//         console.log(`   ⚠️  ${funcName} - has test coverage but tests were NOT updated`);
//         missingTests.push({
//           file,
//           functionName: funcName,
//           hasTest: true,
//           testFile,
//           testWasUpdated: false,
//         });
//       } else {
//         console.log(`   ❌ ${funcName} - MISSING test coverage`);
//         missingTests.push({
//           file,
//           functionName: funcName,
//           hasTest: false,
//           testFile,
//           testWasUpdated: false,
//         });
//       }
//     }
//   }

//   // 4. Report results
//   console.log("\n" + "=".repeat(70));
//   console.log("📊 TEST COVERAGE REPORT");
//   console.log("=".repeat(70));

//   console.log(`\n✅ Functions with test coverage: ${coveredFunctions.length}`);
//   if (coveredFunctions.length > 0) {
//     for (const func of coveredFunctions) {
//       console.log(`   • ${func.functionName} (${func.file})`);
//     }
//   }

//   console.log(`\n❌ Functions missing test coverage or outdated tests: ${missingTests.length}`);
//   if (missingTests.length > 0) {
//     for (const func of missingTests) {
//       console.log(`   • ${func.functionName} (${func.file})`);
//       if (!func.testFile) {
//         console.log(`     → No test file found!`);
//       } else if (func.hasTest && !func.testWasUpdated) {
//         console.log(`     → Test exists but was NOT updated: ${func.testFile}`);
//         console.log(`     → Update the test to reflect the function changes`);
//       } else {
//         console.log(`     → Add tests to: ${func.testFile}`);
//       }
//     }
//   }

//   console.log("\n" + "=".repeat(70));

//   // 5. Exit with error if any functions are missing tests or tests weren't updated
//   if (missingTests.length > 0) {
//     console.error("\n❌ TEST ENFORCEMENT FAILED");
    
//     const noTests = missingTests.filter(f => !f.hasTest);
//     const outdatedTests = missingTests.filter(f => f.hasTest && !f.testWasUpdated);
    
//     if (noTests.length > 0) {
//       console.error(`\n${noTests.length} function(s) were modified but don't have test coverage.`);
//     }
    
//     if (outdatedTests.length > 0) {
//       console.error(`\n${outdatedTests.length} function(s) were modified but their tests were NOT updated.`);
//       console.error(`When you modify a function, you must also update its tests to ensure they still validate the new behavior.`);
//     }
    
//     console.error("\nOptions:");
//     console.error(`  1. Add or update test cases for the affected functions`);
//     console.error(`  2. Add the "${CONFIG.skipLabel}" label to bypass this check`);
//     console.error(`  3. Use CodeGuard to auto-generate tests: npx codeguard auto\n`);
//     process.exit(1);
//   }

//   console.log("\n✅ TEST ENFORCEMENT PASSED");
//   console.log(`All ${coveredFunctions.length} modified function(s) have up-to-date test coverage!\n`);
//   process.exit(0);
// }

// // Run the script
// main();




// PART 3
// import { execSync } from "child_process";
// import * as fs from "fs";
// import * as path from "path";
// import * as babelParser from "@babel/parser";
// const traverse = require("@babel/traverse").default;

// // ============================================================================
// // CONFIGURATION
// // ============================================================================

// interface Config {
//   sourceExtensions: string[];
//   testPatterns: string[];
//   excludePaths: string[];
//   skipLabel: string;
// }

// const CONFIG: Config = {
//   sourceExtensions: [".ts", ".tsx", ".js", ".jsx"],
//   testPatterns: [
//     "{name}.test.{ext}",
//     "{name}.spec.{ext}",
//     "__tests__/{name}.{ext}",
//     "tests/{name}.test.{ext}",
//   ],
//   excludePaths: [
//     "node_modules/",
//     "dist/",
//     "build/",
//     ".test.",
//     ".spec.",
//   ],
//   skipLabel: "no-test-needed"
// };

// // ============================================================================
// // TYPES
// // ============================================================================

// interface FunctionInfo {
//   name: string;
//   type: "FunctionDeclaration" | "ArrowFunctionExpression" | "FunctionExpression";
//   exported: boolean;
//   async: boolean;
//   line: number;
// }

// interface FileAnalysis {
//   functions: FunctionInfo[];
//   success: boolean;
//   error?: string;
// }

// interface ChangedFunction {
//   file: string;
//   functionName: string;
//   hasTest: boolean;
//   testFile: string | null;
//   lastModifiedCommit: string;
//   testLastUpdatedCommit: string | null;
//   needsUpdate: boolean;
// }

// interface CommitInfo {
//   hash: string;
//   message: string;
//   timestamp: number;
// }

// // ============================================================================
// // AST PARSING - Extract functions from source files
// // ============================================================================

// function analyzeFileAST(filePath: string): FileAnalysis {
//   try {
//     const content = fs.readFileSync(filePath, "utf-8");
//     const functions: FunctionInfo[] = [];

//     const ast = babelParser.parse(content, {
//       sourceType: "module",
//       plugins: [
//         "typescript",
//         "jsx",
//         "decorators-legacy",
//         "classProperties",
//         "objectRestSpread",
//       ],
//     });

//     traverse(ast, {
//       FunctionDeclaration(path: any) {
//         const node = path.node;
//         if (node.id && node.id.name) {
//           functions.push({
//             name: node.id.name,
//             type: "FunctionDeclaration",
//             exported: path.parent.type === "ExportNamedDeclaration" ||
//                      path.parent.type === "ExportDefaultDeclaration",
//             async: node.async || false,
//             line: node.loc?.start.line || 0,
//           });
//         }
//       },

//       VariableDeclarator(path: any) {
//         const node = path.node;
//         if (
//           node.id &&
//           node.id.name &&
//           (node.init?.type === "ArrowFunctionExpression" ||
//            node.init?.type === "FunctionExpression")
//         ) {
//           let currentPath = path;
//           let isExported = false;
          
//           while (currentPath.parent) {
//             if (
//               currentPath.parent.type === "ExportNamedDeclaration" ||
//               currentPath.parent.type === "ExportDefaultDeclaration"
//             ) {
//               isExported = true;
//               break;
//             }
//             currentPath = currentPath.parentPath;
//           }

//           functions.push({
//             name: node.id.name,
//             type: node.init.type,
//             exported: isExported,
//             async: node.init.async || false,
//             line: node.loc?.start.line || 0,
//           });
//         }
//       },
//     });

//     return { functions, success: true };
//   } catch (error: any) {
//     return {
//       functions: [],
//       success: false,
//       error: error.message,
//     };
//   }
// }

// function getChangedLines(diff: string): Set<number> {
//   const changedLines = new Set<number>();
//   const lines = diff.split("\n");
  
//   let currentLine = 0;
//   for (const line of lines) {
//     const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
//     if (match) {
//       currentLine = parseInt(match[1], 10);
//       continue;
//     }
    
//     if (line.startsWith("+") && !line.startsWith("+++")) {
//       changedLines.add(currentLine);
//       currentLine++;
//     } else if (!line.startsWith("-") && !line.startsWith("---")) {
//       currentLine++;
//     }
//   }
  
//   return changedLines;
// }

// function getChangedFunctions(filePath: string, diff: string): string[] {
//   const analysis = analyzeFileAST(filePath);
  
//   if (!analysis.success || analysis.functions.length === 0) {
//     return [];
//   }

//   const changedLines = getChangedLines(diff);
//   if (changedLines.size === 0) {
//     return [];
//   }

//   const content = fs.readFileSync(filePath, "utf-8");
//   const lines = content.split("\n");

//   const changedFunctionNames: string[] = [];
//   const sortedFunctions = [...analysis.functions].sort((a, b) => a.line - b.line);

//   for (let i = 0; i < sortedFunctions.length; i++) {
//     const func = sortedFunctions[i];
//     const nextFunc = sortedFunctions[i + 1];
    
//     const functionStart = func.line;
//     const functionEnd = nextFunc ? nextFunc.line - 1 : lines.length;

//     for (const changedLine of changedLines) {
//       if (changedLine >= functionStart && changedLine <= functionEnd) {
//         if (func.exported) {
//           changedFunctionNames.push(func.name);
//         }
//         break;
//       }
//     }
//   }

//   return changedFunctionNames;
// }

// // ============================================================================
// // TEST FILE CHECKING
// // ============================================================================

// function findTestFile(sourceFile: string): string | null {
//   const dir = path.dirname(sourceFile);
//   const basename = path.basename(sourceFile);
//   const nameWithoutExt = basename.replace(/\.(ts|tsx|js|jsx)$/, "");
//   const ext = path.extname(sourceFile).slice(1);

//   for (const pattern of CONFIG.testPatterns) {
//     const testPath = pattern
//       .replace("{name}", nameWithoutExt)
//       .replace("{ext}", ext);
    
//     const fullPath = path.join(dir, testPath);
//     if (fs.existsSync(fullPath)) {
//       return fullPath;
//     }
//   }

//   return null;
// }

// function hasTestForFunction(testFilePath: string, functionName: string): boolean {
//   try {
//     const content = fs.readFileSync(testFilePath, "utf-8");
    
//     const patterns = [
//       new RegExp(`describe\\s*\\(\\s*['"\`]${functionName}['"\`]\\s*,`, "g"),
//       new RegExp(`describe\\s*\\(\\s*['"\`][^'"\`]*[\\s-]${functionName}['"\`]\\s*,`, "g"),
//       new RegExp(`(?:test|it)\\s*\\(\\s*['"\`][^'"\`]*${functionName}[^'"\`]*['"\`]`, "gi"),
//     ];

//     for (const pattern of patterns) {
//       if (pattern.test(content)) {
//         return true;
//       }
//     }

//     return false;
//   } catch (error) {
//     return false;
//   }
// }

// // ============================================================================
// // GIT OPERATIONS - Per-commit tracking
// // ============================================================================

// /**
//  * Get all commits in the PR in chronological order (oldest to newest)
//  */
// function getCommitsInPR(): CommitInfo[] {
//   try {
//     const output = execSync(
//       'git log origin/main..HEAD --pretty=format:"%H|%s|%at" --reverse',
//       { encoding: "utf-8" }
//     ).trim();

//     if (!output) {
//       return [];
//     }

//     return output.split("\n").map(line => {
//       const [hash, message, timestamp] = line.split("|");
//       return {
//         hash,
//         message,
//         timestamp: parseInt(timestamp, 10)
//       };
//     });
//   } catch (error) {
//     console.error("❌ Error getting commits:", error);
//     return [];
//   }
// }

// /**
//  * Get the last commit that modified a specific file
//  */
// function getLastCommitForFile(filePath: string, commits: CommitInfo[]): string | null {
//   try {
//     // Get all commits that touched this file in the PR
//     const output = execSync(
//       `git log origin/main..HEAD --pretty=format:"%H" -- "${filePath}"`,
//       { encoding: "utf-8" }
//     ).trim();

//     if (!output) {
//       return null;
//     }

//     const commitHashes = output.split("\n");
    
//     // Find the most recent commit (last in our chronological list)
//     for (let i = commits.length - 1; i >= 0; i--) {
//       if (commitHashes.includes(commits[i].hash)) {
//         return commits[i].hash;
//       }
//     }

//     return commitHashes[0] || null;
//   } catch (error) {
//     return null;
//   }
// }

// /**
//  * Get files changed in a specific commit
//  */
// function getFilesChangedInCommit(commitHash: string): string[] {
//   try {
//     const output = execSync(
//       `git diff-tree --no-commit-id --name-only -r ${commitHash}`,
//       { encoding: "utf-8" }
//     ).trim();

//     return output ? output.split("\n") : [];
//   } catch (error) {
//     return [];
//   }
// }

// /**
//  * Get the diff for a specific file in a specific commit
//  */
// function getDiffForFileInCommit(commitHash: string, filePath: string): string {
//   try {
//     return execSync(
//       `git show ${commitHash} -- "${filePath}"`,
//       { encoding: "utf-8" }
//     );
//   } catch (error) {
//     return "";
//   }
// }

// /**
//  * Check if a file was modified in or after a specific commit
//  */
// function wasFileModifiedAfterCommit(
//   filePath: string,
//   afterCommitHash: string,
//   commits: CommitInfo[]
// ): boolean {
//   const lastCommit = getLastCommitForFile(filePath, commits);
  
//   if (!lastCommit) {
//     return false;
//   }

//   // Find indices of both commits
//   const afterIndex = commits.findIndex(c => c.hash === afterCommitHash);
//   const lastIndex = commits.findIndex(c => c.hash === lastCommit);

//   // Test file was modified at or after the source file commit
//   return lastIndex >= afterIndex;
// }

// // ============================================================================
// // MAIN ANALYSIS
// // ============================================================================

// function analyzeCommitByCommit(): ChangedFunction[] {
//   const commits = getCommitsInPR();
  
//   if (commits.length === 0) {
//     console.log("ℹ️  No commits found in PR");
//     return [];
//   }

//   console.log(`\n📋 Found ${commits.length} commit(s) in PR:\n`);
//   commits.forEach((commit, idx) => {
//     const date = new Date(commit.timestamp * 1000).toLocaleString();
//     console.log(`   ${idx + 1}. ${commit.hash.substring(0, 7)} - ${commit.message} (${date})`);
//   });

//   const allIssues: ChangedFunction[] = [];
//   const functionLastModified = new Map<string, { commitHash: string; commitIndex: number }>();

//   // Process commits in chronological order
//   for (let i = 0; i < commits.length; i++) {
//     const commit = commits[i];
//     console.log(`\n${"=".repeat(70)}`);
//     console.log(`📝 Commit ${i + 1}/${commits.length}: ${commit.hash.substring(0, 7)} - ${commit.message}`);
//     console.log("=".repeat(70));

//     const filesInCommit = getFilesChangedInCommit(commit.hash);
//     const sourceFilesInCommit = filesInCommit.filter(file => {
//       const ext = path.extname(file);
//       return CONFIG.sourceExtensions.includes(ext) &&
//              !CONFIG.excludePaths.some(exclude => file.includes(exclude)) &&
//              fs.existsSync(file);
//     });

//     if (sourceFilesInCommit.length === 0) {
//       console.log("   ℹ️  No source files changed in this commit");
//       continue;
//     }

//     for (const file of sourceFilesInCommit) {
//       console.log(`\n   📄 ${file}`);
      
//       const diff = getDiffForFileInCommit(commit.hash, file);
//       const changedFunctions = getChangedFunctions(file, diff);

//       if (changedFunctions.length === 0) {
//         console.log("      ℹ️  No exported functions modified");
//         continue;
//       }

//       console.log(`      📍 Changed functions: ${changedFunctions.join(", ")}`);

//       const testFile = findTestFile(file);
      
//       if (!testFile) {
//         console.log(`      ⚠️  No test file found!`);
        
//         for (const funcName of changedFunctions) {
//           const key = `${file}::${funcName}`;
//           functionLastModified.set(key, { commitHash: commit.hash, commitIndex: i });
          
//           allIssues.push({
//             file,
//             functionName: funcName,
//             hasTest: false,
//             testFile: null,
//             lastModifiedCommit: commit.hash,
//             testLastUpdatedCommit: null,
//             needsUpdate: true,
//           });
//         }
//         continue;
//       }

//       console.log(`      🧪 Test file: ${testFile}`);

//       // Check if test file was modified in this commit or any later commit
//       const testModifiedAfter = wasFileModifiedAfterCommit(testFile, commit.hash, commits);

//       for (const funcName of changedFunctions) {
//         const key = `${file}::${funcName}`;
//         const hasTest = hasTestForFunction(testFile, funcName);
        
//         // Update the last modified commit for this function
//         functionLastModified.set(key, { commitHash: commit.hash, commitIndex: i });

//         if (hasTest && testModifiedAfter) {
//           console.log(`      ✅ ${funcName} - has test and test was updated in/after this commit`);
//         } else if (hasTest && !testModifiedAfter) {
//           console.log(`      ❌ ${funcName} - has test but test NOT updated in/after this commit`);
//         } else {
//           console.log(`      ❌ ${funcName} - MISSING test coverage`);
//         }
//       }
//     }
//   }

//   // Final validation: check current state of all modified functions
//   console.log(`\n${"=".repeat(70)}`);
//   console.log("🔍 FINAL VALIDATION - Checking current state of all modified functions");
//   console.log("=".repeat(70));

//   const finalIssues: ChangedFunction[] = [];
//   const coveredFunctions: ChangedFunction[] = [];

//   for (const [key, { commitHash, commitIndex }] of functionLastModified.entries()) {
//     const [file, funcName] = key.split("::");
//     const testFile = findTestFile(file);

//     if (!testFile) {
//       finalIssues.push({
//         file,
//         functionName: funcName,
//         hasTest: false,
//         testFile: null,
//         lastModifiedCommit: commitHash,
//         testLastUpdatedCommit: null,
//         needsUpdate: true,
//       });
//       continue;
//     }

//     const hasTest = hasTestForFunction(testFile, funcName);
//     const testLastCommit = getLastCommitForFile(testFile, commits);
    
//     // Test must be updated at or after the function's last modification
//     const testUpdatedAfter = testLastCommit ? 
//       commits.findIndex(c => c.hash === testLastCommit) >= commitIndex : 
//       false;

//     if (hasTest && testUpdatedAfter) {
//       coveredFunctions.push({
//         file,
//         functionName: funcName,
//         hasTest: true,
//         testFile,
//         lastModifiedCommit: commitHash,
//         testLastUpdatedCommit: testLastCommit,
//         needsUpdate: false,
//       });
//     } else {
//       finalIssues.push({
//         file,
//         functionName: funcName,
//         hasTest,
//         testFile,
//         lastModifiedCommit: commitHash,
//         testLastUpdatedCommit: testLastCommit,
//         needsUpdate: true,
//       });
//     }
//   }

//   // Print summary
//   console.log(`\n✅ Functions with up-to-date tests: ${coveredFunctions.length}`);
//   for (const func of coveredFunctions) {
//     console.log(`   • ${func.functionName} (${func.file})`);
//     console.log(`     Last modified: ${func.lastModifiedCommit.substring(0, 7)}`);
//     console.log(`     Test updated: ${func.testLastUpdatedCommit?.substring(0, 7)}`);
//   }

//   console.log(`\n❌ Functions needing test updates: ${finalIssues.length}`);
//   for (const func of finalIssues) {
//     console.log(`   • ${func.functionName} (${func.file})`);
//     console.log(`     Last modified: ${func.lastModifiedCommit.substring(0, 7)}`);
    
//     if (!func.testFile) {
//       console.log(`     ❌ No test file found`);
//     } else if (!func.hasTest) {
//       console.log(`     ❌ No test coverage in: ${func.testFile}`);
//     } else if (!func.testLastUpdatedCommit) {
//       console.log(`     ⚠️  Test exists but was not updated in this PR: ${func.testFile}`);
//     } else {
//       const funcCommitIdx = commits.findIndex(c => c.hash === func.lastModifiedCommit);
//       const testCommitIdx = commits.findIndex(c => c.hash === func.testLastUpdatedCommit);
      
//       if (testCommitIdx < funcCommitIdx) {
//         console.log(`     ❌ Test last updated: ${func.testLastUpdatedCommit.substring(0, 7)}`);
//         console.log(`     ❌ Test was updated BEFORE the function change!`);
//       } else {
//         console.log(`     ⚠️  Test needs update in: ${func.testFile}`);
//       }
//     }
//   }

//   return finalIssues;
// }

// // ============================================================================
// // MAIN
// // ============================================================================

// function main() {
//   console.log("🔍 Smart Test Enforcement - Per-Commit Validation\n");

//   // Check for bypass label
//   const labels = process.env.PR_LABELS?.split(",") || [];
//   console.log("PR Labels:", labels.length > 0 ? labels.join(", ") : "(none)");
  
//   if (labels.includes(CONFIG.skipLabel)) {
//     console.log(`🟢 "${CONFIG.skipLabel}" label found. Skipping test enforcement.\n`);
//     process.exit(0);
//   }

//   const issues = analyzeCommitByCommit();

//   console.log("\n" + "=".repeat(70));
//   console.log("📊 FINAL REPORT");
//   console.log("=".repeat(70));

//   if (issues.length === 0) {
//     console.log("\n✅ TEST ENFORCEMENT PASSED");
//     console.log("All modified functions have up-to-date test coverage!\n");
//     process.exit(0);
//   }

//   console.error("\n❌ TEST ENFORCEMENT FAILED\n");
  
//   const noTestFile = issues.filter(f => !f.testFile);
//   const noTestCoverage = issues.filter(f => f.testFile && !f.hasTest);
//   const outdatedTests = issues.filter(f => f.testFile && f.hasTest);

//   if (noTestFile.length > 0) {
//     console.error(`${noTestFile.length} function(s) have no test file`);
//   }
  
//   if (noTestCoverage.length > 0) {
//     console.error(`${noTestCoverage.length} function(s) have no test coverage`);
//   }
  
//   if (outdatedTests.length > 0) {
//     console.error(`${outdatedTests.length} function(s) have tests but they weren't updated after the function changed`);
//     console.error("\n⚠️  IMPORTANT: When you modify a function, you MUST update its tests in the same commit or a later commit.");
//     console.error("This ensures tests always reflect the current behavior of the code.");
//   }

//   console.error("\nOptions:");
//   console.error(`  1. Add or update test cases for the affected functions`);
//   console.error(`  2. Add the "${CONFIG.skipLabel}" label to bypass this check`);
//   console.error(`  3. Use CodeGuard to auto-generate tests: npx codeguard auto\n`);
  
//   process.exit(1);
// }

// main();


// PART4


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
    
    const patterns = [
      new RegExp(`describe\\s*\\(\\s*['"\`]${functionName}['"\`]\\s*,`, "g"),
      new RegExp(`describe\\s*\\(\\s*['"\`][^'"\`]*[\\s-]${functionName}['"\`]\\s*,`, "g"),
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
    console.error(`   3. Use CodeGuard to auto-generate tests: npx codeguard auto\n`);
    
    process.exit(1);
  }
}

// Run the script
main();