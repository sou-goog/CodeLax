/**
 * Quick test for the deterministic finding verifier.
 * Run: npx tsx tests/finding-verifier.test.ts
 */

import { verifyFindings, partitionFindings } from "../module/ai/lib/finding-verifier";

const SAMPLE_DIFF = `diff --git a/src/auth/login.ts b/src/auth/login.ts
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -10,6 +10,12 @@ export async function login(req: Request) {
   const { email, password } = req.body;
 
+  // NEW: validate input
+  if (!email || !password) {
+    return res.status(400).json({ error: "Missing credentials" });
+  }
+
+  const user = await db.query("SELECT * FROM users WHERE email = '" + email + "'");
   const token = jwt.sign({ userId: user.id }, SECRET);
   return res.json({ token });
 }
diff --git a/src/utils/helpers.ts b/src/utils/helpers.ts
--- a/src/utils/helpers.ts
+++ b/src/utils/helpers.ts
@@ -5,3 +5,7 @@ export function formatDate(d: Date) {
   return d.toISOString();
 }
+
+export function parseId(input: string): number {
+  return parseInt(input);
+}`;

// --- Test 1: Valid finding (file + line + snippet all match) ---
console.log("=== Test 1: Valid finding ===");
const validFindings = verifyFindings(
  [
    {
      agentName: "security",
      severity: "critical",
      confidence: 0.95,
      file: "src/auth/login.ts",
      line: 16,
      title: "SQL Injection",
      description: "String concatenation in SQL query",
      suggestion: "Use parameterized query",
      codeSnippet: `db.query("SELECT * FROM users WHERE email = '" + email + "'")`,
    },
  ],
  SAMPLE_DIFF
);
console.log("  Passed:", validFindings[0].passed, "| Reasons:", validFindings[0].failReasons);
console.assert(validFindings[0].passed === true, "Valid finding should pass");

// --- Test 2: Hallucinated file ---
console.log("\n=== Test 2: Hallucinated file ===");
const fakeFileFindings = verifyFindings(
  [
    {
      agentName: "logic",
      severity: "high",
      confidence: 0.8,
      file: "src/api/users.ts",
      line: 5,
      title: "Null reference",
      description: "Accessing property on potentially null value",
      suggestion: "Add null check",
    },
  ],
  SAMPLE_DIFF
);
console.log("  Passed:", fakeFileFindings[0].passed, "| Reasons:", fakeFileFindings[0].failReasons);
console.assert(fakeFileFindings[0].passed === false, "Non-existent file should fail");

// --- Test 3: Wrong line number (outside any hunk) ---
console.log("\n=== Test 3: Wrong line number ===");
const wrongLineFindings = verifyFindings(
  [
    {
      agentName: "style",
      severity: "low",
      confidence: 0.75,
      file: "src/auth/login.ts",
      line: 100,
      title: "Magic number",
      description: "Hardcoded value",
      suggestion: "Extract constant",
    },
  ],
  SAMPLE_DIFF
);
console.log("  Passed:", wrongLineFindings[0].passed, "| Reasons:", wrongLineFindings[0].failReasons);
console.assert(wrongLineFindings[0].passed === true, "Wrong line only = 1 fail reason, should still pass");

// --- Test 4: Fake file + wrong line + wrong snippet (all fail) ---
console.log("\n=== Test 4: Triple fail ===");
const tripleFailFindings = verifyFindings(
  [
    {
      agentName: "performance",
      severity: "medium",
      confidence: 0.7,
      file: "src/database/connection.ts",
      line: 200,
      title: "N+1 query",
      description: "Missing batch query",
      suggestion: "Use findMany",
      codeSnippet: "for (const item of items) { await db.find(item.id) }",
    },
  ],
  SAMPLE_DIFF
);
console.log("  Passed:", tripleFailFindings[0].passed, "| Reasons:", tripleFailFindings[0].failReasons);
console.assert(tripleFailFindings[0].passed === false, "All checks failing should reject");

// --- Test 5: Suffix match (agent says "login.ts" not "src/auth/login.ts") ---
console.log("\n=== Test 5: Suffix filename match ===");
const suffixFindings = verifyFindings(
  [
    {
      agentName: "security",
      severity: "high",
      confidence: 0.85,
      file: "login.ts",
      line: 14,
      title: "Missing validation",
      description: "Input not validated",
      suggestion: "Add validation",
    },
  ],
  SAMPLE_DIFF
);
console.log("  Passed:", suffixFindings[0].passed, "| Reasons:", suffixFindings[0].failReasons);
console.assert(suffixFindings[0].passed === true, "Suffix filename match should pass");

// --- Test 6: partitionFindings batch test ---
console.log("\n=== Test 6: Batch partition ===");
const { verified, rejected } = partitionFindings(
  [
    {
      agentName: "security",
      severity: "critical",
      confidence: 0.95,
      file: "src/auth/login.ts",
      line: 16,
      title: "SQL Injection",
      description: "Real finding",
      suggestion: "Fix it",
      codeSnippet: "db.query",
    },
    {
      agentName: "logic",
      severity: "high",
      confidence: 0.8,
      file: "src/nonexistent.ts",
      line: 5,
      title: "Hallucinated finding",
      description: "This file doesn't exist",
      suggestion: "N/A",
    },
    {
      agentName: "style",
      severity: "low",
      confidence: 0.7,
      file: "src/utils/helpers.ts",
      line: 9,
      title: "Missing return type",
      description: "Real file, valid line",
      suggestion: "Add type",
    },
  ],
  SAMPLE_DIFF
);
console.log(`  Verified: ${verified.length} | Rejected: ${rejected.length}`);
console.assert(verified.length === 2, "Should have 2 verified");
console.assert(rejected.length === 1, "Should have 1 rejected");
console.log("  Rejected finding:", rejected[0]?.finding.title);

console.log("\n✅ All tests passed!");
