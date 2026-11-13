export interface ToolDefinition {
  id: string
  name: string
  description: string
  category: string
  route: string
  icon: string
  tags: string[]
  status: 'available' | 'planned' | 'experimental'
  featured?: boolean
}

export interface Category { id: string; name: string; description: string; icon: string }

export const CATEGORIES: Category[] = [
  { id: 'data', name: 'JSON, Data & Files', description: 'Format, convert, diff and generate structured data', icon: 'Braces' },
  { id: 'java', name: 'Java, Spring & Backend', description: 'Spring configs, stack traces, DTOs, YAML and SQL', icon: 'Coffee' },
  { id: 'security', name: 'Encoding, Security & HTTP', description: 'JWT, hashing, encoding, headers and QR codes', icon: 'ShieldCheck' },
  { id: 'devops', name: 'DevOps & Config', description: 'Docker, Git, Kubernetes, CI and environment files', icon: 'Container' },
  { id: 'text', name: 'Text, Logs & Productivity', description: 'Text cleanup, logs, Markdown and more', icon: 'FileText' },
  { id: 'datetime', name: 'Date, Time & Calculation', description: 'Dates, timezones, cron, timers and unit conversion', icon: 'Clock' },
  { id: 'visual', name: 'Visual, Diagram & Design', description: 'Mermaid, SVG, colors and screenshots', icon: 'Palette' },
  { id: 'browser', name: 'Browser Utilities', description: 'Regex, XPath, JSONPath, QR reading and tokenizers', icon: 'Globe' },
]

type Row = [id: string, name: string, cat: string, icon: string, description: string, tags: string, featured?: 1]

const rows: Row[] = [
  // A — data
  ['json-formatter', 'JSON Formatter', 'data', 'Braces', 'Format, minify and validate JSON with helpful error positions.', 'json pretty print beautify validate', 1],
  ['json-minifier', 'JSON Minifier', 'data', 'Minimize2', 'Validate and minify JSON and see the size savings.', 'json compress minify'],
  ['json-viewer', 'JSON Viewer', 'data', 'ListTree', 'Browse JSON as a collapsible tree with search, types and JSON paths.', 'json tree explore path'],
  ['json-graph', 'JSON Tree Browser', 'data', 'ListTree', 'Collapsible, searchable tree of nested JSON with types and counts.', 'json tree browse collapse expand nodes'],
  ['json-escape', 'JSON Escape / Unescape', 'data', 'Quote', 'Escape text into a JSON string or unescape a JSON string literal.', 'json escape unescape string'],
  ['json-to-csv', 'JSON to CSV', 'data', 'Table', 'Convert JSON arrays to CSV with configurable flattening and delimiters.', 'json csv convert flatten'],
  ['csv-to-json', 'CSV to JSON', 'data', 'Table2', 'Parse CSV with delimiter detection and convert to JSON.', 'csv json convert parse'],
  ['csv-viewer', 'CSV Viewer', 'data', 'Sheet', 'Upload and explore CSV files with search, sort and column info.', 'csv table viewer sort filter'],
  ['csv-to-sql', 'CSV to SQL', 'data', 'Database', 'Generate SQL INSERT statements from CSV data.', 'csv sql insert generate'],
  ['json-to-schema', 'JSON to JSON Schema', 'data', 'FileJson', 'Infer a JSON Schema from example JSON.', 'json schema infer generate'],
  ['json-schema-validator', 'JSON Schema Validator', 'data', 'BadgeCheck', 'Validate JSON against a JSON Schema (draft-07 / 2019-09 / 2020-12).', 'json schema validate ajv'],
  ['json-to-typescript', 'JSON to TypeScript', 'data', 'FileCode', 'Generate TypeScript interfaces or types from JSON.', 'json typescript interface types generate'],
  ['json-to-zod', 'JSON to Zod', 'data', 'ShieldCheck', 'Generate Zod schemas from example JSON.', 'json zod schema generate'],
  ['json-diff', 'JSON Diff', 'data', 'GitCompare', 'Semantic comparison of two JSON documents, ignoring key order.', 'json diff compare', 1],
  ['text-diff', 'Text Diff', 'data', 'Diff', 'Line-by-line diff of two texts or files with whitespace options.', 'text diff compare files'],
  ['json-explorer', 'JSON Data Explorer', 'data', 'Telescope', 'Statistics and structure summary for any JSON document.', 'json stats explore analyze'],
  ['mock-data', 'Mock Data Generator', 'data', 'Wand2', 'Generate realistic mock records and export JSON or CSV.', 'mock fake data generator faker'],
  ['random-json', 'Random JSON Generator', 'data', 'Dices', 'Generate random JSON with configurable depth and array sizes.', 'random json generator'],
  ['big-number', 'Big Number Converter', 'data', 'Binary', 'Arbitrary-precision integer conversion between bases.', 'bigint number base hex binary octal'],
  ['string-length', 'String Length Calculator', 'data', 'Ruler', 'Characters, code points, UTF-16 units, UTF-8 bytes, words and lines.', 'string length bytes utf8 unicode'],
  ['json-to-toon', 'JSON to TOON', 'data', 'Minimize2', 'Convert JSON to compact, token-efficient TOON with token savings.', 'json toon llm tokens convert compact'],
  ['json-to-proto', 'JSON to Protobuf', 'data', 'FileCode2', 'Generate proto3 messages from example JSON.', 'json proto protobuf grpc schema generate'],
  ['json-visualizer', 'JSON Visualizer (Graph)', 'data', 'Network', 'Interactive node graph of JSON with pan, zoom and search, like JSON Crack.', 'json graph visualizer jsoncrack nodes diagram', 1],
  // B — java
  ['spring-properties-compare', 'Spring Properties Comparator', 'java', 'FileDiff', 'Compare application.yml / .properties files with masking and filters.', 'spring yaml properties compare config', 1],
  ['java-exception-formatter', 'Java Exception Formatter', 'java', 'Bug', 'Format exceptions, highlight messages and view cause chains.', 'java exception formatter cause'],
  ['java-stack-trace', 'Java Stack Trace Formatter', 'java', 'Layers', 'Readable, searchable stack traces with grouped nested exceptions.', 'java stack trace stacktrace caused by'],
  ['json-to-java', 'JSON to Java DTO', 'java', 'Coffee', 'Generate POJOs, records and Jackson-annotated DTOs from JSON.', 'json java pojo record dto jackson lombok'],
  ['json-to-yaml', 'JSON to YAML', 'java', 'ArrowRightLeft', 'Convert JSON to YAML.', 'json yaml convert'],
  ['yaml-to-json', 'YAML to JSON', 'java', 'ArrowLeftRight', 'Convert YAML to JSON with clear parse errors.', 'yaml json convert'],
  ['yaml-formatter', 'YAML Formatter', 'java', 'AlignLeft', 'Format and re-indent YAML.', 'yaml format beautify indent'],
  ['yaml-validator', 'YAML Validator', 'java', 'CheckCircle2', 'Validate YAML with line and column details.', 'yaml validate lint'],
  ['sql-formatter', 'SQL Formatter', 'java', 'Database', 'Format or minify SQL for many dialects.', 'sql format beautify minify'],
  ['sql-inline-variables', 'SQL Inline Variable Replacer', 'java', 'Replace', 'Substitute ?, :name, $1 and ${name} placeholders for inspection.', 'sql parameters bind variables hibernate logs'],
  ['java-string-format', 'Java String.format Tester', 'java', 'Terminal', 'Test Java-style format strings with common specifiers.', 'java string format printf'],
  ['uuid-generator', 'UUID Generator', 'java', 'Fingerprint', 'Generate secure UUID v4 values in bulk.', 'uuid guid random generator', 1],
  // C — security
  ['jwt-decoder', 'JWT Decoder', 'security', 'KeyRound', 'Decode JWT header and payload, check expiry. Does not verify signatures.', 'jwt token decode claims', 1],
  ['url-inspector', 'URL Inspector', 'security', 'Link', 'Parse, edit and rebuild URLs and query parameters.', 'url parse query params'],
  ['url-encoder', 'URL Encoder / Decoder', 'security', 'Link2', 'Encode or decode URL components and full URLs.', 'url encode decode percent'],
  ['base64', 'Base64 Encoder / Decoder', 'security', 'Binary', 'Encode and decode Base64 text (UTF-8) or files.', 'base64 encode decode file'],
  ['base64-hex', 'Base64 ↔ Hex', 'security', 'Hash', 'Convert between Base64 and hexadecimal bytes.', 'base64 hex convert'],
  ['hash-generator', 'Hash & Checksum Generator', 'security', 'Hash', 'SHA-1/256/384/512 hashes for text or files via Web Crypto.', 'hash sha256 sha512 checksum file'],
  ['hmac', 'HMAC Generator & Verifier', 'security', 'ShieldHalf', 'Generate and verify HMAC signatures locally.', 'hmac sha signature verify'],
  ['password-generator', 'Password Generator', 'security', 'Lock', 'Secure passwords using crypto.getRandomValues.', 'password generator random secure'],
  ['secret-detector', 'Secret Detector & Redactor', 'security', 'EyeOff', 'Find and redact credentials, tokens and keys in text.', 'secret redact mask api key token password'],
  ['http-header-analyzer', 'HTTP Header Analyzer', 'security', 'Activity', 'Explain and audit pasted request/response headers.', 'http headers cors cache security'],
  ['curl-generator', 'cURL Command Generator', 'security', 'Terminal', 'Build correctly escaped cURL commands.', 'curl http request command'],
  ['qr-generator', 'QR Code Generator', 'security', 'QrCode', 'Generate QR codes as PNG or SVG.', 'qr code generator'],
  // D — devops
  ['env-toolkit', '.env Toolkit', 'devops', 'Settings2', 'Parse, validate, format and convert .env files.', 'env dotenv parse format json'],
  ['env-compare', '.env Comparator', 'devops', 'FileDiff', 'Compare two .env files with secret masking.', 'env dotenv compare diff'],
  ['gitignore-generator', '.gitignore Generator', 'devops', 'GitBranch', 'Combine templates for Java, Node, IDEs and OSes.', 'gitignore generator templates'],
  ['dockerfile-generator', 'Dockerfile Generator', 'devops', 'Container', 'Dockerfiles for Java, Spring Boot, Node, React and static apps.', 'docker dockerfile generator'],
  ['docker-compose-generator', 'Docker Compose Generator', 'devops', 'Boxes', 'Compose files with Postgres, MySQL, Redis, Kafka and more.', 'docker compose yaml generator'],
  ['github-actions-generator', 'GitHub Actions Generator', 'devops', 'Workflow', 'Workflow YAML for Maven, Gradle, Node, Docker and Pages.', 'github actions workflow ci generator'],
  ['github-actions-explainer', 'GitHub Actions Explainer', 'devops', 'Workflow', 'Explain triggers, jobs and steps of a workflow YAML.', 'github actions workflow explain visualize'],
  ['cidr-calculator', 'CIDR / Subnet Calculator', 'devops', 'Network', 'IPv4 subnet details from CIDR notation.', 'cidr subnet ip network calculator'],
  ['docker-commands', 'Docker Command Generator', 'devops', 'Container', 'Compose common docker commands from options.', 'docker commands run build exec logs'],
  ['tar-commands', 'Tar Command Generator', 'devops', 'Archive', 'Create and extract tar archives with compression.', 'tar archive gzip command'],
  ['du-commands', 'Disk Usage (du) Generator', 'devops', 'HardDrive', 'Build du commands with depth and sorting.', 'du disk usage command'],
  ['git-helper', 'Git Command Helper', 'devops', 'GitMerge', 'Generate Git commands and learn what is destructive.', 'git commands rebase reset stash'],
  ['kubectl-cheatsheet', 'Kubernetes Cheatsheet', 'devops', 'Ship', 'Searchable kubectl commands you can configure.', 'kubernetes kubectl cheatsheet'],
  ['mysql-commands', 'MySQL Command Generator', 'devops', 'Database', 'Common MySQL statements and CLI commands.', 'mysql commands sql'],
  ['postgres-commands', 'PostgreSQL Command Generator', 'devops', 'Database', 'Common PostgreSQL and psql commands.', 'postgres postgresql psql commands'],
  // E — text
  ['text-toolbox', 'Text Toolbox', 'text', 'Wrench', 'Trim, sort, reverse, normalize and clean text in one place.', 'text sort reverse trim normalize'],
  ['case-converter', 'Case Converter', 'text', 'CaseSensitive', 'camelCase, snake_case, kebab-case, Title Case and more.', 'case camel snake kebab pascal title'],
  ['word-counter', 'Word Counter', 'text', 'Hash', 'Live word, character, sentence and paragraph counts.', 'word count characters sentences'],
  ['invisible-chars', 'Invisible Character Detector', 'text', 'ScanEye', 'Reveal zero-width, odd whitespace and line endings.', 'invisible unicode zero width whitespace'],
  ['log-workbench', 'Log & Privacy Workbench', 'text', 'ScrollText', 'Filter, group and redact logs locally.', 'log filter level redact search'],
  ['log-compare', 'Java Log Comparator', 'text', 'GitCompare', 'Compare logs from two environments with timestamp normalization.', 'log compare diff environments'],
  ['log-timestamp', 'Log Timestamp Converter', 'text', 'CalendarClock', 'Detect and convert epoch, ISO-8601 and log timestamps.', 'timestamp epoch iso convert log'],
  ['text-dedupe', 'Text Deduplicator', 'text', 'ListX', 'Remove duplicate lines and count what was removed.', 'duplicate lines remove unique'],
  ['markdown-viewer', 'Markdown Viewer & Exporter', 'text', 'BookOpenText', 'Render Markdown with high-quality Mermaid diagrams; export to Azure DevOps wiki, Word and PDF.', 'markdown viewer mermaid azure devops wiki word docx pdf export diagram', 1],
  ['markdown-table', 'Markdown Table Generator', 'text', 'Table', 'Turn CSV/TSV into aligned Markdown tables.', 'markdown table csv tsv'],
  ['clipboard-cleaner', 'Clipboard Text Cleaner', 'text', 'ClipboardCheck', 'Strip formatting, extra whitespace and hidden characters.', 'clipboard clean paste whitespace'],
  ['template-replacer', 'Template String Replacer', 'text', 'Braces', 'Fill {{placeholders}} from key-value pairs.', 'template placeholder replace mustache'],
  ['ascii-tree', 'ASCII Directory Tree', 'text', 'FolderTree', 'Turn paths into a printable directory tree.', 'ascii tree directory paths'],
  ['ascii-art', 'ASCII Art Generator', 'text', 'Type', 'Render text in figlet fonts.', 'ascii art figlet banner'],
  ['keyboard-events', 'Keyboard Event Viewer', 'text', 'Keyboard', 'Inspect key, code, modifiers and keyCode of key presses.', 'keyboard event key code'],
  // F — datetime
  ['date-diff', 'Date Difference Calculator', 'datetime', 'CalendarRange', 'Years, months, days, hours and minutes between dates.', 'date difference between days'],
  ['timezone-compare', 'Timezone Comparator', 'datetime', 'Globe2', 'Compare one moment across timezones with DST awareness.', 'timezone time zone convert dst'],
  ['cron-builder', 'Cron Expression Builder', 'datetime', 'CalendarClock', 'Build, explain and preview cron schedules.', 'cron schedule expression quartz'],
  ['stopwatch', 'Stopwatch', 'datetime', 'Timer', 'Stopwatch with laps.', 'stopwatch timer laps'],
  ['countdown', 'Countdown Timer', 'datetime', 'Hourglass', 'Configurable countdown timer.', 'countdown timer'],
  ['snowflake-decoder', 'Snowflake ID Decoder', 'datetime', 'Snowflake', 'Decode Snowflake IDs with configurable epoch and layout.', 'snowflake id twitter discord decode'],
  ['discord-timestamp', 'Discord Timestamp Generator', 'datetime', 'MessageSquare', 'Generate <t:…> timestamp markup.', 'discord timestamp markup'],
  ['number-base', 'Number Base Converter', 'datetime', 'Binary', 'Binary, octal, decimal and hex without precision loss.', 'number base binary hex octal decimal'],
  ['css-unit-converter', 'CSS Unit Converter', 'datetime', 'Ruler', 'Convert px, rem, em, pt, vw and more.', 'css unit px rem em pt'],
  // G — visual
  ['mermaid-editor', 'Mermaid Diagram Editor', 'visual', 'Workflow', 'Edit and render Mermaid diagrams, export SVG.', 'mermaid diagram flowchart sequence svg'],
  ['svg-editor', 'SVG Preview & Editor', 'visual', 'Shapes', 'Sanitized SVG preview, inspection and editing.', 'svg preview editor viewbox'],
  ['color-picker', 'Color Picker', 'visual', 'Pipette', 'Pick colors and copy HEX, RGB and HSL.', 'color picker hex rgb hsl'],
  ['contrast-checker', 'Color Contrast Checker', 'visual', 'Contrast', 'WCAG contrast ratios with AA/AAA verdicts.', 'contrast wcag accessibility color'],
  ['color-converter', 'HEX / RGB / HSL Converter', 'visual', 'Paintbrush', 'Convert and validate color formats.', 'color hex rgb hsl convert'],
  ['palette-generator', 'Color Palette Generator', 'visual', 'Palette', 'Complementary, analogous, triadic and monochromatic palettes.', 'color palette scheme'],
  ['box-shadow', 'CSS Box Shadow Generator', 'visual', 'Square', 'Design layered shadows visually and copy the CSS.', 'css box shadow generator'],
  ['code-screenshot', 'Code Screenshot Generator', 'visual', 'Camera', 'Render code into a polished PNG, locally.', 'code screenshot image png carbon'],
  // H — browser
  ['regex-playground', 'Regex Playground', 'browser', 'Regex', 'Test regular expressions with highlighted matches and groups.', 'regex regular expression test', 1],
  ['xpath-tester', 'XPath Tester', 'browser', 'FileCode2', 'Evaluate XPath against XML.', 'xpath xml query'],
  ['jsonpath-playground', 'JSONPath Playground', 'browser', 'Search', 'Query JSON with JSONPath expressions.', 'jsonpath json query'],
  ['qr-reader', 'QR Code Reader', 'browser', 'ScanLine', 'Decode QR codes from images or camera, locally.', 'qr reader scan decode'],
  ['html-entities', 'HTML Entities Encoder / Decoder', 'browser', 'Code', 'Encode and decode named and numeric HTML entities.', 'html entities encode decode escape'],
  ['utm-builder', 'UTM Builder', 'browser', 'Megaphone', 'Build campaign URLs with UTM parameters.', 'utm campaign url builder'],
  ['llm-token-counter', 'LLM Token Counter', 'browser', 'Coins', 'Count tokens for OpenAI tokenizers; estimates for other models.', 'llm token counter gpt tokenizer'],
]

export const TOOLS: ToolDefinition[] = rows.map(([id, name, category, icon, description, tags, featured]) => ({
  id, name, description, category, icon, route: `/tools/${id}`, tags: tags.split(' '), status: 'available', featured: !!featured,
}))

export const toolById = (id: string) => TOOLS.find((t) => t.id === id)
export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id)
export const toolsIn = (cat: string) => TOOLS.filter((t) => t.category === cat)

export function searchTools(q: string, cat?: string): ToolDefinition[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  const pool = cat ? TOOLS.filter((t) => t.category === cat) : TOOLS
  if (!terms.length) return pool
  return pool
    .map((t) => {
      const name = t.name.toLowerCase(), desc = t.description.toLowerCase(), tags = t.tags.join(' ')
      let score = 0
      for (const term of terms) {
        if (name.startsWith(term)) score += 6
        else if (name.includes(term)) score += 4
        else if (tags.includes(term)) score += 3
        else if (desc.includes(term)) score += 1
        else return { t, score: -1 }
      }
      return { t, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t)
}
