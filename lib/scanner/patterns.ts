export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityPattern {
  id:          string;
  name:        string;
  type:        string;
  severity:    Severity;
  pattern:     RegExp;
  description: string;
  suggestion:  string;
  fileTypes?:  string[];        // undefined = all files
  skipIfComment?: boolean;
}

export const SECURITY_PATTERNS: SecurityPattern[] = [
  // ──────────────── HARDCODED SECRETS ────────────────
  {
    id: 'HC_AWS_KEY',
    name: 'AWS Access Key',
    type: 'Hardcoded Secret',
    severity: 'critical',
    pattern: /\b(AKIA|ASIA|AROA)[0-9A-Z]{16}\b/g,
    description: 'AWS Access Key ID detected in source code.',
    suggestion: 'Move AWS credentials to environment variables and rotate the exposed key immediately.',
  },
  {
    id: 'HC_AWS_SECRET',
    name: 'AWS Secret Key',
    type: 'Hardcoded Secret',
    severity: 'critical',
    pattern: /(?:aws[_\-\s]?secret[_\-\s]?(?:access[_\-\s]?)?key|aws_secret)\s*[:=]\s*['"`]([A-Za-z0-9/+=]{40})['"`]/gi,
    description: 'AWS Secret Access Key detected in source code.',
    suggestion: 'Remove the secret from code, use environment variables, and rotate credentials immediately.',
  },
  {
    id: 'HC_OPENAI_KEY',
    name: 'OpenAI API Key',
    type: 'Hardcoded Secret',
    severity: 'critical',
    pattern: /\bsk-[A-Za-z0-9]{20,50}T3BlbkFJ[A-Za-z0-9]{20,50}\b|\bsk-proj-[A-Za-z0-9_\-]{50,}\b|\bsk-ant-[A-Za-z0-9_\-]{80,}\b/g,
    description: 'OpenAI / Anthropic API key detected in source code.',
    suggestion: 'Remove the key from code, store it in an environment variable, and rotate it immediately.',
  },
  {
    id: 'HC_STRIPE_KEY',
    name: 'Stripe API Key',
    type: 'Hardcoded Secret',
    severity: 'critical',
    pattern: /\b(sk|pk|rk)_(live|test)_[0-9a-zA-Z]{24,}\b/g,
    description: 'Stripe API key detected in source code.',
    suggestion: 'Remove the Stripe key from code, use environment variables, and rotate immediately.',
  },
  {
    id: 'HC_GITHUB_TOKEN',
    name: 'GitHub Token',
    type: 'Hardcoded Secret',
    severity: 'critical',
    pattern: /\bghp_[A-Za-z0-9]{36}\b|\bgho_[A-Za-z0-9]{36}\b|\bghu_[A-Za-z0-9]{36}\b|\bghs_[A-Za-z0-9]{36}\b/g,
    description: 'GitHub personal access token detected in source code.',
    suggestion: 'Remove the token from code, revoke it on GitHub, and use environment variables instead.',
  },
  {
    id: 'HC_PRIVATE_KEY',
    name: 'Private Key',
    type: 'Hardcoded Secret',
    severity: 'critical',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    description: 'Private key (RSA/EC/OpenSSH) detected in source code.',
    suggestion: 'Never commit private keys. Remove the key, store it securely (e.g., secrets manager), and rotate it.',
  },
  {
    id: 'HC_DB_CONN',
    name: 'Database Connection String',
    type: 'Hardcoded Secret',
    severity: 'critical',
    pattern: /(?:postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^:]+:[^@\s'"]+@[^\s'"]+/gi,
    description: 'Database connection string with embedded credentials detected.',
    suggestion: 'Store database URLs in environment variables. Never hardcode credentials.',
  },
  {
    id: 'HC_GENERIC_SECRET',
    name: 'Hardcoded Secret/Token',
    type: 'Hardcoded Secret',
    severity: 'high',
    pattern: /(?:secret|token|password|passwd|api_?key)\s*[:=]\s*['"`][A-Za-z0-9!@#$%^&*()_+\-=]{12,}['"`]/gi,
    description: 'A hardcoded secret, token, or password was detected.',
    suggestion: 'Replace hardcoded secrets with environment variables and a secrets management solution.',
  },
  {
    id: 'HC_JWT_SECRET',
    name: 'Hardcoded JWT Secret',
    type: 'Hardcoded Secret',
    severity: 'high',
    pattern: /jwt\.sign\([^,]+,\s*['"`][^'"`]{8,}['"`]/g,
    description: 'JWT token signed with a hardcoded secret.',
    suggestion: 'Use a strong secret stored in an environment variable (e.g., process.env.JWT_SECRET).',
  },

  // ──────────────── SQL INJECTION ────────────────
  {
    id: 'SQLI_CONCAT',
    name: 'SQL Injection via Concatenation',
    type: 'SQL Injection',
    severity: 'critical',
    pattern: /(?:query|execute|db\.run|connection\.query|client\.query)\s*\(\s*['"`][^'"`]*(?:SELECT|INSERT|UPDATE|DELETE|DROP)[^'"`]*['"`]\s*\+/gi,
    description: 'SQL query built via string concatenation — vulnerable to injection attacks.',
    suggestion: 'Use parameterized queries or prepared statements. Never concatenate user input into SQL.',
  },
  {
    id: 'SQLI_TEMPLATE',
    name: 'SQL Injection via Template Literal',
    type: 'SQL Injection',
    severity: 'critical',
    pattern: /(?:query|execute|db\.run|connection\.query|client\.query)\s*\(\s*`[^`]*(?:SELECT|INSERT|UPDATE|DELETE|WHERE)[^`]*\$\{/gi,
    description: 'SQL query built using template literals with interpolated variables — potential injection.',
    suggestion: 'Use parameterized queries (e.g., `WHERE id = $1`) instead of interpolating variables.',
  },
  {
    id: 'SQLI_RAW',
    name: 'Raw SQL with User Input',
    type: 'SQL Injection',
    severity: 'high',
    pattern: /(?:req\.body|req\.params|req\.query)\.[a-zA-Z]+[^;]*(?:SELECT|INSERT|UPDATE|DELETE)/gi,
    description: 'User-controlled request data appears to flow into a SQL-related expression.',
    suggestion: 'Validate and sanitize all user input. Use an ORM or parameterized queries.',
  },

  // ──────────────── AUTHENTICATION ────────────────
  {
    id: 'AUTH_WEAK_JWT_ALG',
    name: 'Weak JWT Algorithm',
    type: 'Insecure Authentication',
    severity: 'critical',
    pattern: /algorithm\s*:\s*['"`](?:none|HS256)['"`]/gi,
    description: 'JWT using a weak or disabled algorithm (`none` or `HS256` without proper key management).',
    suggestion: 'Use RS256 or ES256 for JWTs. Never use `algorithm: "none"`.',
  },
  {
    id: 'AUTH_HARDCODED_CREDS',
    name: 'Hardcoded Credentials',
    type: 'Insecure Authentication',
    severity: 'critical',
    pattern: /(?:username|user|login)\s*[:=]\s*['"`](?:admin|root|administrator)['"`]\s*[,;]?\s*(?:password|pwd|pass)\s*[:=]\s*['"`][^'"`]+['"`]/gi,
    description: 'Hardcoded default admin credentials detected.',
    suggestion: 'Remove hardcoded credentials. Use environment variables and enforce strong password policies.',
  },
  {
    id: 'AUTH_NO_VERIFY',
    name: 'JWT Verification Disabled',
    type: 'Insecure Authentication',
    severity: 'critical',
    pattern: /jwt\.verify\s*\([^)]*\{\s*[^}]*ignoreExpiration\s*:\s*true/gi,
    description: 'JWT expiration validation is disabled — expired tokens will be accepted.',
    suggestion: 'Remove `ignoreExpiration: true`. Always validate token expiry.',
  },
  {
    id: 'AUTH_MD5_HASH',
    name: 'Weak Password Hashing (MD5/SHA1)',
    type: 'Insecure Authentication',
    severity: 'high',
    pattern: /(?:md5|sha1|createHash\s*\(\s*['"`](?:md5|sha1)['"`])/gi,
    description: 'MD5 or SHA1 used for hashing — insecure for passwords.',
    suggestion: 'Use bcrypt, argon2, or scrypt for password hashing.',
  },
  {
    id: 'AUTH_PLAIN_COMPARE',
    name: 'Plain-text Password Comparison',
    type: 'Insecure Authentication',
    severity: 'high',
    pattern: /(?:password|pwd|passwd)\s*===?\s*(?:req\.body|params|user)\.[a-zA-Z]+/gi,
    description: 'Password compared in plain text without hashing.',
    suggestion: 'Hash passwords with bcrypt and compare using a constant-time function.',
  },

  // ──────────────── OPEN / UNPROTECTED ROUTES ────────────────
  {
    id: 'ROUTE_ADMIN_OPEN',
    name: 'Unprotected Admin Route',
    type: 'Open Admin Route',
    severity: 'high',
    pattern: /(?:app|router)\.(?:get|post|put|delete|patch|all)\s*\(\s*['"`][^'"`]*\/admin[^'"`]*['"`]\s*,\s*(?:async\s*)?\(/gi,
    description: 'Admin route defined without an apparent authentication middleware.',
    suggestion: 'Add authentication and authorization middleware before all admin route handlers.',
  },
  {
    id: 'ROUTE_DEBUG_OPEN',
    name: 'Exposed Debug/Test Route',
    type: 'Open Admin Route',
    severity: 'medium',
    pattern: /(?:app|router)\.(?:get|post|all)\s*\(\s*['"`][^'"`]*(?:\/debug|\/test|\/seed|\/reset|\/backdoor)[^'"`]*['"`]/gi,
    description: 'Debug or seeding route that should not exist in production.',
    suggestion: 'Remove debug/seed routes before deploying to production.',
  },

  // ──────────────── XSS ────────────────
  {
    id: 'XSS_DANGEROUS_HTML',
    name: 'dangerouslySetInnerHTML Usage',
    type: 'XSS Risk',
    severity: 'high',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{/g,
    description: '`dangerouslySetInnerHTML` bypasses React\'s XSS protection.',
    suggestion: 'Sanitize HTML with DOMPurify before setting innerHTML, or restructure the component.',
    fileTypes: ['.tsx', '.jsx', '.js', '.ts'],
  },
  {
    id: 'XSS_INNER_HTML',
    name: 'Direct innerHTML Assignment',
    type: 'XSS Risk',
    severity: 'high',
    pattern: /\.innerHTML\s*=\s*(?!['"`][^'"`]*['"`])/g,
    description: 'Direct innerHTML assignment with a non-literal value — potential XSS.',
    suggestion: 'Sanitize content with DOMPurify or use textContent for plain text.',
  },

  // ──────────────── CODE EXECUTION ────────────────
  {
    id: 'EXEC_EVAL',
    name: 'eval() Usage',
    type: 'Unsafe Code Execution',
    severity: 'critical',
    pattern: /\beval\s*\(/g,
    description: '`eval()` executes arbitrary strings as code — major security risk.',
    suggestion: 'Eliminate all uses of eval(). Use safer alternatives like JSON.parse() or specific APIs.',
  },
  {
    id: 'EXEC_FUNCTION',
    name: 'new Function() Constructor',
    type: 'Unsafe Code Execution',
    severity: 'high',
    pattern: /new\s+Function\s*\(/g,
    description: '`new Function()` dynamically creates executable code — similar risk to eval().',
    suggestion: 'Avoid dynamic code construction. If required, strictly validate and sandbox inputs.',
  },
  {
    id: 'EXEC_CHILD_PROCESS',
    name: 'Unsafe Shell Command Execution',
    type: 'Unsafe Code Execution',
    severity: 'high',
    pattern: /(?:exec|execSync|spawn|spawnSync)\s*\(\s*[^'"`][^)]*(?:req\.|params\.|body\.)/gi,
    description: 'Shell command executed with what appears to be user-controlled input.',
    suggestion: 'Never pass user input to shell commands. Validate strictly and use allowlists.',
  },

  // ──────────────── CORS / NETWORK ────────────────
  {
    id: 'CORS_WILDCARD',
    name: 'CORS Wildcard (*)',
    type: 'Misconfiguration',
    severity: 'medium',
    pattern: /(?:cors|Access-Control-Allow-Origin)\s*[:(]\s*['"`]\*['"`]/gi,
    description: 'CORS configured with wildcard origin — any domain can make cross-origin requests.',
    suggestion: 'Restrict allowed origins to trusted domains instead of using `*`.',
  },
  {
    id: 'TLS_REJECT_DISABLED',
    name: 'TLS Verification Disabled',
    type: 'Misconfiguration',
    severity: 'high',
    pattern: /rejectUnauthorized\s*:\s*false/g,
    description: 'TLS certificate verification disabled — vulnerable to MITM attacks.',
    suggestion: 'Never set `rejectUnauthorized: false` in production. Fix the certificate issue instead.',
  },

  // ──────────────── DATA EXPOSURE ────────────────
  {
    id: 'LOG_SENSITIVE',
    name: 'Sensitive Data in Logs',
    type: 'Sensitive Data Exposure',
    severity: 'medium',
    pattern: /console\.(?:log|info|warn|error)\s*\([^)]*(?:password|secret|token|api_?key|credential)[^)]*\)/gi,
    description: 'Sensitive data (password, secret, token) passed to console.log.',
    suggestion: 'Remove logging of sensitive values. Use structured logging that masks secrets.',
  },
  {
    id: 'MATH_RANDOM_CRYPTO',
    name: 'Math.random() for Security',
    type: 'Insecure Randomness',
    severity: 'medium',
    pattern: /Math\.random\(\)\s*(?:\*|\.toString)[^;]*(?:token|secret|key|nonce|salt|id)/gi,
    description: '`Math.random()` is not cryptographically secure.',
    suggestion: 'Use `crypto.randomBytes()` or `crypto.randomUUID()` for security-sensitive values.',
  },
  {
    id: 'ENV_FALLBACK',
    name: 'Insecure Environment Variable Fallback',
    type: 'Sensitive Data Exposure',
    severity: 'low',
    pattern: /process\.env\.[A-Z_]+\s*\|\|\s*['"`][^'"`]{8,}['"`]/g,
    description: 'Environment variable with a hardcoded fallback value — the fallback may be insecure.',
    suggestion: 'Do not provide hardcoded fallbacks for secrets. Throw an error if the variable is missing.',
  },
  {
    id: 'PROTOTYPE_POLLUTION',
    name: 'Prototype Pollution Risk',
    type: 'Injection',
    severity: 'medium',
    pattern: /Object\.assign\s*\(\s*(?:{}|Object\.create\(null\))[^)]*,\s*(?:req\.body|req\.query|req\.params)/gi,
    description: 'User-controlled data merged into an object — potential prototype pollution.',
    suggestion: 'Validate and allowlist properties before merging user input into objects.',
  },
];

/** File extensions to skip entirely */
export const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.woff', '.woff2', '.eot', '.ttf', '.otf',
  '.mp4', '.mp3', '.avi', '.mov',
  '.zip', '.tar', '.gz', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.lock', '.map',
]);

/** Files to skip by name */
export const SKIP_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.prettierrc', '.eslintrc', '.babelrc',
]);

/** Max file size to scan (200 KB) */
export const MAX_FILE_SIZE = 200 * 1024;

/** Max total files to scan per run */
export const MAX_FILES = 500;
