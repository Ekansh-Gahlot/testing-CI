import { execSync, exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
const traverse = require("@babel/traverse").default;

const execAsync = promisify(exec);

// ============================================================================
// CONFIGURATION
// ============================================================================

interface Config {
    sourceExtensions: string[];
    testPatterns: string[];
    testSearchRoots: string[];
    excludePaths: string[];
    skipLabel: string;
    coverageThreshold: number;
    coverageReportPath: string;
    testCommand: string;
    maxCommits: number;
}

const CONFIG: Config = {
    sourceExtensions: [".ts", ".tsx", ".js", ".jsx"],
    testPatterns: [
        "{name}.test.{ext}",
        "{name}.spec.{ext}",
        "__tests__/{name}.{ext}",
        "tests/{name}.test.{ext}",
    ],
    testSearchRoots: [".", "src", "packages/*/src"],
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
    testCommand: process.env.TEST_COMMAND || "yarn test:coverage",
    maxCommits: 50,
};

// ============================================================================
// TYPES
// ============================================================================

interface FunctionInfo {
    name: string;
    type: "FunctionDeclaration" | "ArrowFunctionExpression" | "FunctionExpression" | "ClassMethod";
    exported: boolean;
    async: boolean;
    startLine: number;
    endLine: number;
}

interface FileAnalysis {
    functions: FunctionInfo[];
    success: boolean;
    error?: string;
}

interface FileChange {
    status: "A" | "M" | "D" | "R";
    file: string;
    oldFile?: string;
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
// CACHING
// ============================================================================

const astCache = new Map<string, FileAnalysis>();
const fileContentCache = new Map<string, string | null>();

function getFileContentAtCommit(commitHash: string, filePath: string): string | null {
    const cacheKey = `${commitHash}:${filePath}`;
    if (fileContentCache.has(cacheKey)) {
        return fileContentCache.get(cacheKey)!;
    }
    try {
        const content = execSync(
            `git show ${commitHash}:"${filePath}"`,
            { encoding: "utf-8" }
        );
        fileContentCache.set(cacheKey, content);
        return content;
    } catch {
        fileContentCache.set(cacheKey, null);
        return null;
    }
}

// ============================================================================
// AST PARSING - Extract functions from source files
// ============================================================================

const BABEL_PLUGINS: babelParser.ParserPlugin[] = [
    "typescript",
    "jsx",
    "decorators-legacy",
    "classProperties",
    "objectRestSpread",
];

function analyzeFileAST(filePath: string, content?: string): FileAnalysis {
    try {
        if (!content) {
            content = fs.readFileSync(filePath, "utf-8");
        }
        const functions: FunctionInfo[] = [];

        const ast = babelParser.parse(content, {
            sourceType: "module",
            plugins: BABEL_PLUGINS,
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
                        startLine: node.loc?.start.line || 0,
                        endLine: node.loc?.end.line || 0,
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
                        startLine: node.loc?.start.line || 0,
                        endLine: node.init.loc?.end.line || node.loc?.end.line || 0,
                    });
                }
            },

            ClassMethod(path: any) {
                const node = path.node;
                const key = node.key;
                if (!key || key.type !== "Identifier") return;

                let classPath = path.parentPath; // ClassBody
                if (classPath) classPath = classPath.parentPath; // ClassDeclaration

                let isExported = false;
                if (classPath) {
                    const parent = classPath.parent;
                    if (
                        parent?.type === "ExportNamedDeclaration" ||
                        parent?.type === "ExportDefaultDeclaration"
                    ) {
                        isExported = true;
                    }
                }

                const className = classPath?.node?.id?.name || "AnonymousClass";

                functions.push({
                    name: `${className}.${key.name}`,
                    type: "ClassMethod",
                    exported: isExported,
                    async: node.async || false,
                    startLine: node.loc?.start.line || 0,
                    endLine: node.loc?.end.line || 0,
                });
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

function analyzeFileASTCached(filePath: string, commitHash: string): FileAnalysis {
    const cacheKey = `${commitHash}:${filePath}`;
    if (astCache.has(cacheKey)) {
        return astCache.get(cacheKey)!;
    }

    const content = getFileContentAtCommit(commitHash, filePath);
    if (!content) {
        const result: FileAnalysis = { functions: [], success: false, error: "File not found at commit" };
        astCache.set(cacheKey, result);
        return result;
    }

    const result = analyzeFileAST(filePath, content);
    astCache.set(cacheKey, result);
    return result;
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

function getChangedFunctions(filePath: string, diff: string, commitHash: string): string[] {
    const analysis = analyzeFileASTCached(filePath, commitHash);

    if (!analysis.success || analysis.functions.length === 0) {
        return [];
    }

    const changedLines = getChangedLines(diff);
    if (changedLines.size === 0) {
        return [];
    }

    const changedFunctionNames: string[] = [];

    const changedLinesArr = Array.from(changedLines);

    for (const func of analysis.functions) {
        if (!func.exported) continue;

        for (const changedLine of changedLinesArr) {
            if (changedLine >= func.startLine && changedLine <= func.endLine) {
                changedFunctionNames.push(func.name);
                break;
            }
        }
    }

    // Filter out cosmetic-only changes (quote style, trailing commas, etc.)
    return filterCosmeticChanges(filePath, changedFunctionNames, commitHash);
}

/**
 * Extract a function's AST subtree from source content and normalize it
 * to a structure string (stripping locations, whitespace, formatting).
 * Returns null if the function cannot be found.
 */
function extractNormalizedFunctionAST(content: string, funcName: string): string | null {
    try {
        const ast = babelParser.parse(content, {
            sourceType: "module",
            plugins: BABEL_PLUGINS,
        });

        let result: string | null = null;

        traverse(ast, {
            enter(path: any) {
                if (result) return;
                const node = path.node;

                let name: string | null = null;

                if (node.type === "FunctionDeclaration" && node.id?.name) {
                    name = node.id.name;
                } else if (
                    node.type === "VariableDeclarator" &&
                    node.id?.name &&
                    (node.init?.type === "ArrowFunctionExpression" || node.init?.type === "FunctionExpression")
                ) {
                    name = node.id.name;
                } else if (node.type === "ClassMethod" && node.key?.type === "Identifier") {
                    const classPath = path.parentPath?.parentPath;
                    const className = classPath?.node?.id?.name || "AnonymousClass";
                    name = `${className}.${node.key.name}`;
                }

                if (name === funcName) {
                    result = normalizeAST(node);
                    path.stop();
                }
            },
        });

        return result;
    } catch {
        return null;
    }
}

/**
 * Recursively normalize an AST node by stripping location info, extra
 * metadata, and formatting artifacts so two semantically identical nodes
 * produce the same string.
 */
function normalizeAST(node: any): string {
    if (node === null || node === undefined) return "null";
    if (typeof node !== "object") return JSON.stringify(node);
    if (Array.isArray(node)) {
        return "[" + node.map(normalizeAST).join(",") + "]";
    }

    // Skip location/formatting keys
    const skipKeys = new Set([
        "start", "end", "loc", "range",
        "leadingComments", "trailingComments", "innerComments",
        "extra", // Babel stores quote style, parenthesization, etc. in "extra"
    ]);

    const entries = Object.keys(node)
        .filter(k => !skipKeys.has(k))
        .sort()
        .map(k => `${k}:${normalizeAST(node[k])}`);

    return "{" + entries.join(",") + "}";
}

/**
 * Filter out functions whose changes are purely cosmetic (formatting, quotes,
 * trailing commas, etc.) by comparing their normalized ASTs before and after.
 */
function filterCosmeticChanges(
    filePath: string,
    functionNames: string[],
    commitHash: string
): string[] {
    if (functionNames.length === 0) return [];

    // Get file content at this commit (after the change)
    const afterContent = getFileContentAtCommit(commitHash, filePath);
    if (!afterContent) return functionNames; // can't verify, keep all

    // Get file content before this commit
    const beforeContent = getFileContentAtCommit(`${commitHash}~1`, filePath);
    if (!beforeContent) return functionNames; // new file, all changes are real

    return functionNames.filter(funcName => {
        const beforeAST = extractNormalizedFunctionAST(beforeContent, funcName);
        const afterAST = extractNormalizedFunctionAST(afterContent, funcName);

        if (beforeAST === null || afterAST === null) {
            // Can't extract one side — treat as a real change
            return true;
        }

        // If the normalized ASTs differ, it's a real change
        return beforeAST !== afterAST;
    });
}

// ============================================================================
// TEST FILE CHECKING
// ============================================================================

function findTestFile(sourceFile: string): string | null {
    const dir = path.dirname(sourceFile);
    const basename = path.basename(sourceFile);
    const nameWithoutExt = basename.replace(/\.(ts|tsx|js|jsx)$/, "");
    const ext = path.extname(sourceFile).slice(1);

    // Search relative to the source file directory
    for (const pattern of CONFIG.testPatterns) {
        const testPath = pattern
            .replace("{name}", nameWithoutExt)
            .replace("{ext}", ext);

        const fullPath = path.join(dir, testPath);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }

    // Search from configured roots (monorepo support)
    for (const root of CONFIG.testSearchRoots) {
        for (const pattern of CONFIG.testPatterns) {
            const testPath = pattern
                .replace("{name}", nameWithoutExt)
                .replace("{ext}", ext);
            const fullPath = path.join(root, testPath);
            if (fullPath !== path.join(dir, pattern.replace("{name}", nameWithoutExt).replace("{ext}", ext)) &&
                fs.existsSync(fullPath)) {
                return fullPath;
            }
        }
    }

    // Check co-located tests/ directory
    const testsDir = path.join(dir, "tests");
    if (fs.existsSync(testsDir)) {
        for (const srcExt of CONFIG.sourceExtensions) {
            const testFile = path.join(testsDir, `${nameWithoutExt}.test${srcExt}`);
            if (fs.existsSync(testFile)) return testFile;
            const specFile = path.join(testsDir, `${nameWithoutExt}.spec${srcExt}`);
            if (fs.existsSync(specFile)) return specFile;
        }
    }

    return null;
}

function hasTestForFunction(testFilePath: string, functionName: string): boolean {
    try {
        const content = fs.readFileSync(testFilePath, "utf-8");

        const ast = babelParser.parse(content, {
            sourceType: "module",
            plugins: BABEL_PLUGINS,
        });

        let found = false;

        // For class methods stored as "ClassName.methodName", check both forms
        const nameParts = functionName.split(".");
        const shortName = nameParts[nameParts.length - 1];
        const namesToCheck = nameParts.length > 1
            ? [functionName, shortName]
            : [functionName];

        traverse(ast, {
            CallExpression(path: any) {
                if (found) return;
                const node = path.node;

                // Check 1: Function name in test description strings
                const isTestCall =
                    (node.callee.type === "Identifier" &&
                        ["describe", "test", "it", "expect"].includes(node.callee.name)) ||
                    (node.callee.type === "MemberExpression" &&
                        node.callee.object?.type === "Identifier" &&
                        ["describe", "test", "it"].includes(node.callee.object.name));

                if (isTestCall && node.arguments.length > 0) {
                    const firstArg = node.arguments[0];

                    if (firstArg.type === "StringLiteral" || firstArg.type === "TemplateLiteral") {
                        let testDescription = "";

                        if (firstArg.type === "StringLiteral") {
                            testDescription = firstArg.value;
                        } else if (firstArg.type === "TemplateLiteral") {
                            testDescription = firstArg.quasis.map((q: any) => q.value.raw).join("");
                        }

                        for (const name of namesToCheck) {
                            if (testDescription.includes(name)) {
                                found = true;
                                path.stop();
                                return;
                            }
                        }
                    }
                }

                // Check 2: Direct function call (e.g., add(1, 2))
                if (node.callee.type === "Identifier" && namesToCheck.includes(node.callee.name)) {
                    found = true;
                    path.stop();
                    return;
                }

                // Check 3: Method call (e.g., instance.methodName())
                if (
                    node.callee.type === "MemberExpression" &&
                    node.callee.property?.type === "Identifier" &&
                    namesToCheck.includes(node.callee.property.name)
                ) {
                    found = true;
                    path.stop();
                    return;
                }
            },
        });

        return found;
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

async function getFilesChangedInCommit(commitHash: string): Promise<FileChange[]> {
    try {
        const { stdout } = await execAsync(
            `git diff-tree --no-commit-id --name-status -r ${commitHash}`,
            { encoding: "utf-8" }
        );

        if (!stdout.trim()) return [];

        return stdout.trim().split("\n").map(line => {
            const parts = line.split("\t");
            const statusChar = parts[0].charAt(0) as FileChange["status"];

            if (statusChar === "R") {
                return { status: statusChar, oldFile: parts[1], file: parts[2] };
            }
            return { status: statusChar, file: parts[1] };
        });
    } catch {
        return [];
    }
}

async function getDiffForFileInCommit(commitHash: string, filePath: string, ignoreWhitespace = true): Promise<string> {
    try {
        // Use -w flag to ignore whitespace-only changes as a fast path
        const wFlag = ignoreWhitespace ? "-w " : "";
        const { stdout } = await execAsync(
            `git show ${wFlag}${commitHash} -- "${filePath}"`,
            { encoding: "utf-8" }
        );
        return stdout;
    } catch {
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

async function runTestsWithCoverage(): Promise<TestResult> {
    console.log("\n" + "=".repeat(70));
    console.log("🧪 RUNNING TESTS WITH COVERAGE");
    console.log("=".repeat(70));
    console.log(`\nExecuting: ${CONFIG.testCommand}\n`);

    try {
        const { stdout } = await execAsync(CONFIG.testCommand, {
            encoding: "utf-8",
            maxBuffer: 10 * 1024 * 1024,
        });

        console.log(stdout);

        return {
            passed: true,
            output: stdout,
        };
    } catch (error: any) {
        const output = error.stdout || error.stderr || error.message;
        console.error(output);

        return {
            passed: false,
            output: output,
            error: error.message,
        };
    }
}

function checkCoverageThreshold(): CoverageResult {
    console.log("\n" + "=".repeat(70));
    console.log("📊 CHECKING COVERAGE THRESHOLD");
    console.log("=".repeat(70));

    if (!fs.existsSync(CONFIG.coverageReportPath)) {
        return {
            passed: false,
            coverage: null,
            message: `Coverage report not found at ${CONFIG.coverageReportPath}`,
        };
    }

    try {
        const coverageData = JSON.parse(
            fs.readFileSync(CONFIG.coverageReportPath, "utf-8")
        ) as CoverageSummary;

        const { total } = coverageData;

        console.log("\n📈 Coverage Summary:");
        console.log(`   Lines:      ${total.lines.pct.toFixed(2)}% (${total.lines.covered}/${total.lines.total})`);
        console.log(`   Statements: ${total.statements.pct.toFixed(2)}% (${total.statements.covered}/${total.statements.total})`);
        console.log(`   Functions:  ${total.functions.pct.toFixed(2)}% (${total.functions.covered}/${total.functions.total})`);
        console.log(`   Branches:   ${total.branches.pct.toFixed(2)}% (${total.branches.covered}/${total.branches.total})`);

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

async function analyzeCommitByCommit(): Promise<ChangedFunction[]> {
    let commits = getCommitsInPR();

    if (commits.length === 0) {
        console.log("ℹ️  No commits found in PR");
        return [];
    }

    if (commits.length > CONFIG.maxCommits) {
        console.log(`\n⚠️  PR has ${commits.length} commits, processing only the last ${CONFIG.maxCommits}`);
        commits = commits.slice(commits.length - CONFIG.maxCommits);
    }

    console.log(`\n📋 Found ${commits.length} commit(s) in PR:\n`);
    commits.forEach((commit, idx) => {
        const date = new Date(commit.timestamp * 1000).toLocaleString();
        console.log(`   ${idx + 1}. ${commit.hash.substring(0, 7)} - ${commit.message} (${date})`);
    });

    // Nested map: file -> functionName -> { commitHash, commitIndex }
    const functionLastModified = new Map<string, Map<string, { commitHash: string; commitIndex: number }>>();

    function setFunctionModified(file: string, funcName: string, commitHash: string, commitIndex: number) {
        if (!functionLastModified.has(file)) {
            functionLastModified.set(file, new Map());
        }
        functionLastModified.get(file)!.set(funcName, { commitHash, commitIndex });
    }

    for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        console.log(`\n${"=".repeat(70)}`);
        console.log(`📝 Commit ${i + 1}/${commits.length}: ${commit.hash.substring(0, 7)} - ${commit.message}`);
        console.log("=".repeat(70));

        const fileChanges = await getFilesChangedInCommit(commit.hash);

        // Filter to source files, skip deleted files
        const sourceFileChanges = fileChanges.filter(fc => {
            if (fc.status === "D") return false;
            const ext = path.extname(fc.file);
            return CONFIG.sourceExtensions.includes(ext) &&
                !CONFIG.excludePaths.some(exclude => fc.file.includes(exclude));
        });

        if (sourceFileChanges.length === 0) {
            console.log("   ℹ️  No source files changed in this commit");
            continue;
        }

        // Process all files in this commit in parallel
        const fileResults = await Promise.all(
            sourceFileChanges.map(async (fc) => {
                const diff = await getDiffForFileInCommit(commit.hash, fc.file);
                const changedFunctions = getChangedFunctions(fc.file, diff, commit.hash);
                return { file: fc.file, oldFile: fc.oldFile, changedFunctions };
            })
        );

        for (const { file, changedFunctions } of fileResults) {
            console.log(`\n   📄 ${file}`);

            if (changedFunctions.length === 0) {
                console.log("      ℹ️  No exported functions modified");
                continue;
            }

            console.log(`      📍 Changed functions: ${changedFunctions.join(", ")}`);

            const testFile = findTestFile(file);

            if (!testFile) {
                console.log(`      ⚠️  No test file found!`);

                for (const funcName of changedFunctions) {
                    setFunctionModified(file, funcName, commit.hash, i);
                }
                continue;
            }

            console.log(`      🧪 Test file: ${testFile}`);

            const testModifiedAfter = wasFileModifiedAfterCommit(testFile, commit.hash, commits);

            for (const funcName of changedFunctions) {
                const hasTest = hasTestForFunction(testFile, funcName);

                setFunctionModified(file, funcName, commit.hash, i);

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

    const fileEntries = Array.from(functionLastModified.entries());
    for (const [file, funcs] of fileEntries) {
        const funcEntries = Array.from(funcs.entries());
        for (const [funcName, { commitHash, commitIndex }] of funcEntries) {
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

async function main() {
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
    const issues = await analyzeCommitByCommit();

    // Step 2: Run tests with coverage
    const testResult = await runTestsWithCoverage();

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
main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
