# DevPocket

**101 privacy-first developer utilities that run entirely in your browser.**
No backend, no accounts, no analytics, no uploads — all processing is local, and the app keeps working offline after its first load.

JSON · Spring Boot / Java · YAML & SQL · JWT & hashing · Docker / Git / Kubernetes · logs · dates & cron · Mermaid / SVG / colors · regex / XPath / JSONPath · and more.

## Tools (101)

| Category | Count | Tools |
|---|---|---|
| **JSON, Data & Files** | 23 | JSON Formatter · Minifier · Viewer · Tree Browser · Escape/Unescape · JSON→CSV · CSV→JSON · CSV Viewer · CSV→SQL · JSON→JSON Schema · JSON Schema Validator · JSON→TypeScript · JSON→Zod · JSON Diff · Text Diff · JSON Data Explorer · Mock Data Generator · Random JSON Generator · Big Number Converter · String Length Calculator · JSON→TOON · JSON→Protobuf · JSON Visualizer (Graph) |
| **Java, Spring & Backend** | 12 | Spring Properties Comparator · Java Exception Formatter · Java Stack Trace Formatter · JSON→Java DTO · JSON→YAML · YAML→JSON · YAML Formatter · YAML Validator · SQL Formatter · SQL Inline Variable Replacer · Java `String.format` Tester · UUID Generator |
| **Encoding, Security & HTTP** | 12 | JWT Decoder · URL Inspector · URL Encoder/Decoder · Base64 · Base64↔Hex · Hash & Checksum · HMAC Generator/Verifier · Password Generator · Secret Detector & Redactor · HTTP Header Analyzer · cURL Generator · QR Code Generator |
| **DevOps & Config** | 15 | .env Toolkit · .env Comparator · .gitignore Generator · Dockerfile Generator · Docker Compose Generator · GitHub Actions Generator · GitHub Actions Explainer · CIDR/Subnet Calculator · Docker Commands · Tar Commands · Disk Usage (`du`) · Git Helper · Kubernetes Cheatsheet · MySQL Commands · PostgreSQL Commands |
| **Text, Logs & Productivity** | 15 | Text Toolbox · Case Converter · Word Counter · Invisible Character Detector · Log & Privacy Workbench · Java Log Comparator · Log Timestamp Converter · Text Deduplicator · Markdown Viewer & Exporter (Mermaid → Azure DevOps wiki / Word / PDF) · Markdown Table Generator · Clipboard Text Cleaner · Template String Replacer · ASCII Directory Tree · ASCII Art Generator · Keyboard Event Viewer |
| **Date, Time & Calculation** | 9 | Date Difference · Timezone Comparator · Cron Builder (Unix / Spring / Quartz) · Stopwatch · Countdown · Snowflake ID Decoder · Discord Timestamp Generator · Number Base Converter · CSS Unit Converter |
| **Visual, Diagram & Design** | 8 | Mermaid Editor · SVG Preview & Editor · Color Picker · Contrast Checker · HEX/RGB/HSL Converter · Palette Generator · Box Shadow Generator · Code Screenshot Generator |
| **Browser Utilities** | 7 | Regex Playground · XPath Tester · JSONPath Playground · QR Code Reader · HTML Entities · UTM Builder · LLM Token Counter |

The catalog lives in [`src/registry.ts`](src/registry.ts) and drives the homepage, search, categories, navigation, favorites, recents and routing. Each tool is a lazily loaded module in [`src/tools/`](src/tools) whose file name equals its registry `id` (a unit test enforces this one-to-one mapping).

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn-style UI primitives (CVA + tailwind-merge) · React Router (hash routing) · Lucide · Vitest · Playwright.
Tool libraries are loaded on demand: js-yaml, sql-formatter, Ajv (+formats), jsonpath-plus, xpath/xmldom, Mermaid, qrcode, jsQR, marked + DOMPurify, diff, figlet, highlight.js, gpt-tokenizer.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # tsc -b
npm test             # Vitest unit tests (tests/)
npm run test:e2e     # builds the app under /DevPocket/ and runs Playwright (first time: npx playwright install chromium)
npm run build        # type-check + production build → dist/
npm run test:all     # everything
```

### Project layout

```
src/registry.ts          101-tool catalog (id, name, description, category, route, icon, tags, status)
src/tools/<id>.tsx       one lazily loaded component per tool
src/lib/*.ts             pure, unit-tested logic (parsers, generators, converters, calculators)
src/components/kit.tsx   shared tool kit: Panel, InputPane/OutputPane, copy/download, options, TransformTool, CommandBuilder
src/components/*         shell: Layout, SearchPalette, JsonTree (virtualized), ConfigCompare, TraceView
src/workers/*            Web Workers (CSV parsing, regex execution with timeout)
tests/                   Vitest unit tests            e2e/   Playwright tests
```

Adding a tool: add a row to `src/registry.ts`, create `src/tools/<id>.tsx` with a default-exported component, put reusable logic in `src/lib/`, add tests.

## Deploy to GitHub Pages

1. Push this repository to GitHub (default branch `main`).
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) type-checks, runs unit and Playwright tests, builds, and deploys `dist/`. No secrets are required.

Why it works under a repository subpath (`https://<user>.github.io/<repo>/`):

- `vite.config.ts` uses a **relative base** (`./`), so assets, lazy chunks and workers resolve from wherever the app is hosted. Override with `VITE_BASE=/my-repo/ npm run build` if you prefer absolute URLs.
- Routing uses **`HashRouter`** (`/#/tools/json-formatter`), so every route is directly reachable with no server rewrites.
- `public/404.html` converts path-style links (`/<repo>/tools/json-formatter`) to hash routes, and `public/.nojekyll` disables Jekyll processing.
- `public/sw.js` caches same-origin assets after the first visit for offline use (production only).

## Privacy & security

- Fully static. No network requests are made by the app itself (an e2e test asserts that loading the app and a tool page issues no cross-origin requests).
- Tool input is **never persisted**. Only theme, favorites, recently used tools, and a recent-colors list are stored in `localStorage`.
- Passwords/UUIDs use `crypto.getRandomValues` / `crypto.randomUUID` (rejection sampling avoids modulo bias). Hashes and HMAC use Web Crypto.
- Markdown and SVG are sanitized with DOMPurify before rendering; Mermaid runs in `strict` mode; JSONPath filters run in a restricted evaluator; user regexes run in a Web Worker with a 2-second kill switch against catastrophic backtracking.
- Tools that handle credentials (JWT, HMAC, secrets, `.env`, comparators) show warnings; sensitive config values are masked by default.

## Known limitations

- **LLM Token Counter** is exact only for OpenAI `o200k_base` / `cl100k_base`. Claude, Gemini and Llama counts are clearly labeled *estimates* (their tokenizers are not bundled).
- **JSON tools** use `JSON.parse`, so integers beyond 2^53 lose precision in JSON documents (use the Big Number / Number Base tools for exact big-integer math).
- **Java `String.format` Tester** emulates `java.util.Formatter` for common specifiers; `%t` date/time, `%a`, locale-specific output and BigDecimal-specific behaviors are not supported (documented in the tool).
- **Cron** supports Unix (5), Spring (6) and Quartz (6–7) syntax except Quartz `W`/`LW` (nearest weekday); next runs are computed in browser time or UTC.
- **QR camera scanning** needs HTTPS (GitHub Pages provides it) and camera permission; image upload always works.
- **Snowflake decoding** depends on the epoch/bit layout you choose — presets exist for Twitter, Discord and Instagram.
- **XPath** is XPath 1.0 (xmldom + xpath).
- **Offline** support relies on the service worker, so a first online visit is required.
