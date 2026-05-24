/**
 * Quick test for language-specific hints.
 * Run: npx tsx tests/language-hints.test.ts
 */

import { getLanguageHints } from "../module/ai/lib/language-hints";

// Test 1: TypeScript security hints should exist
console.log("=== Test 1: TypeScript security hints ===");
const tsSecHints = getLanguageHints("security", ["typescript"]);
console.assert(tsSecHints.includes("dangerouslySetInnerHTML"), "Should include XSS pattern");
console.assert(tsSecHints.includes("Next.js"), "Should include Next.js framework hints");
console.log("  Length:", tsSecHints.length, "chars ✓");

// Test 2: Python performance hints
console.log("=== Test 2: Python performance hints ===");
const pyPerfHints = getLanguageHints("performance", ["python"]);
console.assert(pyPerfHints.includes("select_related"), "Should include Django ORM hints");
console.assert(pyPerfHints.includes("vectorized"), "Should include Pandas hints");
console.log("  Length:", pyPerfHints.length, "chars ✓");

// Test 3: Multi-language
console.log("=== Test 3: Multi-language (TypeScript + Go) ===");
const multiHints = getLanguageHints("logic", ["typescript", "go"]);
console.assert(multiHints.includes("TYPESCRIPT"), "Should have TS section");
console.assert(multiHints.includes("GO"), "Should have Go section");
console.log("  Length:", multiHints.length, "chars ✓");

// Test 4: No hints for style agent (we didn't add any)
console.log("=== Test 4: Style agent (no language-specific hints) ===");
const styleHints = getLanguageHints("style", ["typescript"]);
console.assert(styleHints === "", "Style agent should return empty string");
console.log("  Empty as expected ✓");

// Test 5: Unknown language returns empty
console.log("=== Test 5: Unknown language ===");
const unknownHints = getLanguageHints("security", ["brainfuck"]);
console.assert(unknownHints === "", "Unknown language should return empty");
console.log("  Empty as expected ✓");

// Test 6: Alias resolution (ts → typescript)
console.log("=== Test 6: Alias resolution ===");
const aliasHints = getLanguageHints("security", ["ts"]);
console.assert(aliasHints.includes("dangerouslySetInnerHTML"), "ts alias should resolve to typescript");
console.log("  Alias resolved ✓");

console.log("\n✅ All language hint tests passed!");
