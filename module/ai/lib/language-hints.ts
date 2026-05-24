/**
 * Language-specific hints and patterns for specialist agents.
 *
 * Instead of fine-tuning models, we inject high-quality language-specific
 * patterns and anti-patterns into the specialist prompts. This gives agents
 * concrete knowledge about what to look for in each language/framework.
 */

interface LanguageHint {
  /** Common vulnerability/bug patterns in this language */
  patterns: string[];
  /** Framework-specific things to check */
  frameworkHints: string[];
}

const SECURITY_HINTS: Record<string, LanguageHint> = {
  typescript: {
    patterns: [
      "Check for `dangerouslySetInnerHTML` — XSS via unsanitized HTML injection",
      "Check for `eval()`, `new Function()`, or `vm.runInContext()` — code injection",
      "Check for raw SQL string concatenation with Prisma `$queryRaw` or `$executeRaw`",
      "Check for missing `zod` or input validation on API route handlers",
      "Check for hardcoded secrets or API keys in source (not .env)",
      "Check for `any` casts that bypass type safety on auth/permission checks",
    ],
    frameworkHints: [
      "Next.js: Server Actions that don't verify session/auth before mutating data",
      "Next.js: API routes missing rate limiting or CSRF protection",
      "Next.js: `getServerSideProps` leaking sensitive data to client via props",
      "Express: Missing helmet(), cors() misconfiguration, no rate limiter",
      "Prisma: Raw queries without parameterization ($queryRawUnsafe)",
    ],
  },
  javascript: {
    patterns: [
      "Check for prototype pollution via `Object.assign({}, userInput)` or spread of untrusted data",
      "Check for `innerHTML` assignment without DOMPurify",
      "Check for `require(userInput)` — path traversal / RCE",
      "Check for JWT tokens stored in localStorage (XSS-accessible)",
      "Check for missing `httpOnly` and `secure` flags on cookies",
    ],
    frameworkHints: [
      "React: Check for XSS via `dangerouslySetInnerHTML`",
      "Node.js: Child process spawning with unsanitized user input",
      "Express: Route parameters used directly in file path operations",
    ],
  },
  python: {
    patterns: [
      "Check for `os.system()` or `subprocess.call(shell=True)` with user input — command injection",
      "Check for `pickle.loads()` on untrusted data — arbitrary code execution",
      "Check for SQL string formatting: `f\"SELECT * FROM users WHERE id = {user_id}\"`",
      "Check for `yaml.load()` without `Loader=SafeLoader` — code execution",
      "Check for `eval()` or `exec()` with user-controlled strings",
      "Check for missing CSRF protection in Django/Flask forms",
    ],
    frameworkHints: [
      "Django: Check for `mark_safe()` on user-controlled content",
      "Django: Missing `@login_required` or `@permission_required` on views",
      "Flask: `send_file()` with user-controlled path — directory traversal",
      "FastAPI: Missing `Depends(get_current_user)` on protected endpoints",
    ],
  },
  java: {
    patterns: [
      "Check for `Statement.execute(sql)` instead of `PreparedStatement` — SQL injection",
      "Check for `Runtime.exec()` with unsanitized input — command injection",
      "Check for XXE: `DocumentBuilderFactory` without disabling external entities",
      "Check for insecure deserialization via `ObjectInputStream`",
      "Check for hardcoded credentials in source files",
    ],
    frameworkHints: [
      "Spring: Missing `@PreAuthorize` on controller methods",
      "Spring: CORS misconfiguration allowing `*` origins with credentials",
      "Spring Boot: Actuator endpoints exposed without authentication",
    ],
  },
  go: {
    patterns: [
      "Check for `fmt.Sprintf` used in SQL queries instead of parameterized queries",
      "Check for unchecked error returns (`err` ignored after function call)",
      "Check for `http.ListenAndServe` without TLS in production",
      "Check for missing input validation on handler functions",
      "Check for goroutine leaks (goroutine started without cancellation context)",
    ],
    frameworkHints: [
      "Gin/Echo: Missing auth middleware on route groups",
      "Go templates: Using `template.HTML()` to bypass auto-escaping",
    ],
  },
  rust: {
    patterns: [
      "Check for `unsafe` blocks — verify memory safety invariants are maintained",
      "Check for `.unwrap()` on `Result`/`Option` in non-test code — panics in production",
      "Check for `format!()` in SQL strings instead of parameterized queries",
      "Check for unchecked integer overflow in release mode (wraps silently)",
    ],
    frameworkHints: [
      "Actix/Axum: Missing auth extractors on handler functions",
      "Tokio: Blocking operations inside async context without `spawn_blocking`",
    ],
  },
};

const PERFORMANCE_HINTS: Record<string, LanguageHint> = {
  typescript: {
    patterns: [
      "Check for `await` inside loops — should use `Promise.all()` for parallel execution",
      "Check for missing `useMemo`/`useCallback` on expensive computations passed as props",
      "Check for `findMany()` without `take` limit — unbounded queries",
      "Check for synchronous `fs.readFileSync` in API routes or server code",
      "Check for large object spreads in hot paths: `{...bigObject, newField: value}`",
    ],
    frameworkHints: [
      "Next.js: Missing `dynamic(() => import())` for heavy client components",
      "Next.js: `getServerSideProps` that could be `getStaticProps` with revalidation",
      "React: Re-rendering entire lists without `key` prop or virtualization",
      "Prisma: Missing `select` clause fetching entire rows when only 1-2 fields needed",
    ],
  },
  javascript: {
    patterns: [
      "Check for `document.querySelectorAll` in loops — cache the NodeList",
      "Check for event listeners added without corresponding removal",
      "Check for large array `.filter().map()` chains that could be single `.reduce()`",
      "Check for synchronous XHR or blocking operations on main thread",
    ],
    frameworkHints: [
      "React: Missing `React.memo()` on frequently re-rendered list items",
      "React: Creating objects/arrays in render that break shallow comparison",
      "Node.js: Missing connection pooling for database clients",
    ],
  },
  python: {
    patterns: [
      "Check for list comprehensions that should be generators for large datasets",
      "Check for `+` string concatenation in loops — use `''.join()` or f-strings",
      "Check for `global` variable mutations in hot paths",
      "Check for N+1 queries in Django ORM — missing `select_related`/`prefetch_related`",
      "Check for synchronous I/O in async functions (blocking the event loop)",
    ],
    frameworkHints: [
      "Django: Missing `select_related()` or `prefetch_related()` on querysets with joins",
      "FastAPI: Sync database calls in async endpoints (use `run_in_executor`)",
      "Pandas: `.apply()` where vectorized operations would be 10-100x faster",
    ],
  },
  java: {
    patterns: [
      "Check for `String` concatenation in loops — use `StringBuilder`",
      "Check for `stream().collect()` where a simple loop is more efficient",
      "Check for missing `@Transactional` causing implicit per-query transactions",
      "Check for `synchronized` blocks that are too coarse (whole method vs. critical section)",
    ],
    frameworkHints: [
      "Spring: N+1 queries from lazy-loaded JPA relationships in loops",
      "Spring: Missing `@Cacheable` on expensive repeated computations",
      "Hibernate: Fetching entire entities when a DTO projection would suffice",
    ],
  },
  go: {
    patterns: [
      "Check for `append()` in loops without pre-allocating slice capacity",
      "Check for `sync.Mutex` where `sync.RWMutex` would reduce contention",
      "Check for goroutines without proper context cancellation propagation",
      "Check for `json.Marshal/Unmarshal` in hot paths — consider code-gen alternatives",
    ],
    frameworkHints: [
      "GORM: Missing `Preload()` causing N+1 queries",
      "net/http: Missing connection pool configuration on HTTP clients",
    ],
  },
  rust: {
    patterns: [
      "Check for `.clone()` where borrowing would suffice — unnecessary allocation",
      "Check for `Vec` allocation in loops where reuse with `.clear()` would work",
      "Check for `Box<dyn Trait>` where generics/monomorphization would be faster",
      "Check for blocking `.lock()` in async context — use `tokio::sync::Mutex`",
    ],
    frameworkHints: [
      "Tokio: Missing `buffer_unordered()` for parallel async I/O",
      "Serde: Deserializing to owned `String` where `&str` with lifetime would avoid allocation",
    ],
  },
};

const LOGIC_HINTS: Record<string, LanguageHint> = {
  typescript: {
    patterns: [
      "Check for `==` instead of `===` — type coercion bugs (`0 == false` is true)",
      "Check for optional chaining `?.` that silently returns undefined instead of proper error handling",
      "Check for `Array.find()` result used without null check",
      "Check for `async` functions where errors are caught but the catch returns `undefined` instead of re-throwing or returning a proper error",
      "Check for React `useEffect` with missing dependency array entries — stale closures",
    ],
    frameworkHints: [
      "Next.js: `redirect()` that doesn't `return` after — code continues executing",
      "Next.js: Server/Client component mismatch causing hydration errors",
      "Prisma: `.update()` without checking if record exists first → P2025 error",
    ],
  },
  python: {
    patterns: [
      "Check for mutable default arguments: `def foo(items=[])` — shared across calls",
      "Check for `except Exception: pass` — swallowing errors silently",
      "Check for `is` vs `==` confusion for value comparison",
      "Check for `datetime.now()` vs `datetime.utcnow()` timezone bugs",
      "Check for integer division `//` where float division `/` was intended",
    ],
    frameworkHints: [
      "Django: `get_object_or_404()` vs `.get()` — unhandled DoesNotExist",
      "Django: Missing `atomic()` transaction on multi-step write operations",
    ],
  },
  java: {
    patterns: [
      "Check for `==` on String/Object instead of `.equals()` — reference comparison",
      "Check for `NullPointerException` risk — missing null checks before method calls",
      "Check for `ConcurrentModificationException` — iterating and modifying same collection",
      "Check for `Integer.parseInt()` without try-catch — NumberFormatException on bad input",
    ],
    frameworkHints: [
      "Spring: `@Async` method called internally (bypasses proxy, runs synchronously)",
      "Spring: Missing `@Valid` on request body — skips validation annotations",
    ],
  },
  go: {
    patterns: [
      "Check for unchecked `err` returns — `result, _ := doSomething()` ignoring errors",
      "Check for nil pointer dereference — accessing fields on potentially nil interface",
      "Check for goroutine data races — shared variable without mutex or channel",
      "Check for `defer` in loops — defers accumulate until function returns",
    ],
    frameworkHints: [],
  },
  rust: {
    patterns: [
      "Check for `.unwrap()` in production code paths — panics the program",
      "Check for integer overflow in release builds (wraps silently, not caught)",
      "Check for `match` arms that don't cover all enum variants",
      "Check for lifetime issues when returning references to local data",
    ],
    frameworkHints: [],
  },
};

/**
 * Get language-specific hints for a specialist agent.
 * Returns a formatted string to inject into the agent's system prompt.
 */
export function getLanguageHints(
  agentName: string,
  languages: string[]
): string {
  if (languages.length === 0) return "";

  const hintsMap: Record<string, Record<string, LanguageHint>> = {
    security: SECURITY_HINTS,
    performance: PERFORMANCE_HINTS,
    logic: LOGIC_HINTS,
  };

  const agentHints = hintsMap[agentName];
  if (!agentHints) return "";

  const sections: string[] = [];

  for (const lang of languages) {
    const normalizedLang = lang.toLowerCase().replace(/[#+ ]/g, "");
    // Try exact match, then common aliases
    const aliases: Record<string, string> = {
      ts: "typescript", js: "javascript", py: "python",
      jsx: "javascript", tsx: "typescript",
      "c#": "java", csharp: "java", // close enough patterns
      kotlin: "java", // JVM patterns overlap
      golang: "go",
    };
    const key = agentHints[normalizedLang]
      ? normalizedLang
      : aliases[normalizedLang] ?? normalizedLang;

    const hints = agentHints[key];
    if (!hints) continue;

    const patternList = hints.patterns.map((p) => `  • ${p}`).join("\n");
    const frameworkList = hints.frameworkHints.length > 0
      ? `\n  Framework-specific:\n${hints.frameworkHints.map((h) => `  • ${h}`).join("\n")}`
      : "";

    sections.push(`\n${lang.toUpperCase()}-SPECIFIC PATTERNS TO CHECK:\n${patternList}${frameworkList}`);
  }

  return sections.length > 0
    ? `\n--- LANGUAGE-SPECIFIC KNOWLEDGE ---${sections.join("\n")}\n--- END LANGUAGE-SPECIFIC KNOWLEDGE ---\n`
    : "";
}
