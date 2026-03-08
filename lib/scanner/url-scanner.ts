import http from 'http';
import https from 'https';
import {
  calculateScore,
  type FindingCategory,
  type FindingConfidence,
  type FindingExploitability,
  type FindingSeverity,
} from '@/lib/scoring';

export type Severity = FindingSeverity;

export interface UrlVulnerability {
  type: string;
  category: FindingCategory;
  severity: Severity;
  confidence: FindingConfidence;
  exploitability: FindingExploitability;
  file: string;
  line: null;
  code: string | null;
  description: string;
  suggestion: string;
}

export interface UrlScanResult {
  score: number;
  vulnerabilities: UrlVulnerability[];
  summary: string;
  totalChecks: number;
  passedChecks: number;
  probedPaths: number;
}

const REQUIRED_HEADERS: Array<{
  name: string;
  type: string;
  severity: Severity;
  description: string;
  suggestion: string;
}> = [
  {
    name: 'strict-transport-security',
    type: 'Missing HSTS Header',
    severity: 'high',
    description: 'Strict-Transport-Security (HSTS) is absent. Attackers can force HTTP downgrade attacks and intercept traffic.',
    suggestion: 'Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
  },
  {
    name: 'content-security-policy',
    type: 'Missing Content-Security-Policy',
    severity: 'medium',
    description: 'Content-Security-Policy (CSP) is absent. Without it, XSS attacks are significantly easier to execute.',
    suggestion: 'Add a CSP header. Start with: Content-Security-Policy: default-src \'self\'; script-src \'self\'',
  },
  {
    name: 'x-frame-options',
    type: 'Missing X-Frame-Options',
    severity: 'medium',
    description: 'X-Frame-Options is missing. Your site can be embedded in iframes on malicious pages, enabling clickjacking attacks.',
    suggestion: 'Add: X-Frame-Options: DENY (or SAMEORIGIN if you need same-origin iframes)',
  },
  {
    name: 'x-content-type-options',
    type: 'Missing X-Content-Type-Options',
    severity: 'low',
    description: 'X-Content-Type-Options is absent. Browsers may MIME-sniff responses and misinterpret content types.',
    suggestion: 'Add: X-Content-Type-Options: nosniff',
  },
  {
    name: 'referrer-policy',
    type: 'Missing Referrer-Policy',
    severity: 'info',
    description: 'Referrer-Policy is absent. Sensitive path parameters may leak to third parties via the Referer header.',
    suggestion: 'Add: Referrer-Policy: strict-origin-when-cross-origin',
  },
];

const SENSITIVE_PATHS: Array<{
  path: string;
  type: string;
  category: FindingCategory;
  severity: Severity;
  description: string;
  suggestion: string;
}> = [
  {
    path: '/.env',
    type: 'Exposed .env File',
    category: 'exposure',
    severity: 'critical',
    description: 'Environment file is publicly accessible. This likely exposes API keys, database credentials, and JWT secrets.',
    suggestion: 'Block access immediately in your web server. For Nginx: location ~ /\\.env { deny all; }.',
  },
  {
    path: '/.env.local',
    type: 'Exposed .env.local File',
    category: 'exposure',
    severity: 'critical',
    description: 'Local environment file is publicly accessible, potentially exposing secrets.',
    suggestion: 'Block all .env* files: location ~ /\\.env { deny all; }',
  },
  {
    path: '/.env.production',
    type: 'Exposed .env.production File',
    category: 'exposure',
    severity: 'critical',
    description: 'Production environment file is publicly accessible and production secrets may be compromised.',
    suggestion: 'Block access to all .env* files in your web server immediately.',
  },
  {
    path: '/.git/HEAD',
    type: 'Exposed Git Repository',
    category: 'exposure',
    severity: 'high',
    description: 'The .git directory is publicly accessible. Attackers can reconstruct your source code and git history.',
    suggestion: 'Block access to /.git and ensure it is never deployed into the public web root.',
  },
  {
    path: '/wp-config.php',
    type: 'Exposed WordPress Config',
    category: 'exposure',
    severity: 'critical',
    description: 'WordPress config with database host, username, and password is publicly accessible.',
    suggestion: 'Move wp-config.php above the web root or explicitly deny access in web server config.',
  },
  {
    path: '/phpinfo.php',
    type: 'PHP Info Page Exposed',
    category: 'exposure',
    severity: 'high',
    description: 'phpinfo() reveals server config, versions, modules, and environment details.',
    suggestion: 'Delete phpinfo.php from your server immediately.',
  },
  {
    path: '/swagger.json',
    type: 'API Docs Exposed',
    category: 'exposure',
    severity: 'medium',
    description: 'Swagger/OpenAPI spec is publicly accessible and reveals your API surface area.',
    suggestion: 'Restrict API docs to authenticated users or disable them in production.',
  },
  {
    path: '/api-docs',
    type: 'API Docs Endpoint Exposed',
    category: 'exposure',
    severity: 'medium',
    description: 'API documentation endpoint is publicly accessible in production.',
    suggestion: 'Add authentication or disable the endpoint in production.',
  },
  {
    path: '/openapi.json',
    type: 'OpenAPI Spec Exposed',
    category: 'exposure',
    severity: 'medium',
    description: 'OpenAPI specification is publicly accessible.',
    suggestion: 'Restrict access to API specs in production.',
  },
  {
    path: '/graphql',
    type: 'GraphQL Endpoint Exposed',
    category: 'exposure',
    severity: 'medium',
    description: 'GraphQL endpoint is accessible without authentication and may expose introspection details.',
    suggestion: 'Disable GraphQL introspection in production or add authentication.',
  },
  {
    path: '/package.json',
    type: 'package.json Exposed',
    category: 'exposure',
    severity: 'low',
    description: 'package.json reveals dependencies and versions to unauthenticated users.',
    suggestion: 'Block access to package.json in your web server config.',
  },
  {
    path: '/server.js',
    type: 'Server Source Code Exposed',
    category: 'exposure',
    severity: 'medium',
    description: 'Server-side JavaScript source code is publicly accessible.',
    suggestion: 'Ensure source files are not in your static/public serving directory.',
  },
  {
    path: '/database.yml',
    type: 'Database Config Exposed',
    category: 'exposure',
    severity: 'high',
    description: 'Database configuration file is publicly accessible and may contain credentials.',
    suggestion: 'Move config files outside the web root and block access via server config.',
  },
  {
    path: '/.DS_Store',
    type: '.DS_Store File Exposed',
    category: 'exposure',
    severity: 'info',
    description: '.DS_Store can reveal directory structure and naming hints.',
    suggestion: 'Block .DS_Store files and add them to .gitignore.',
  },
  {
    path: '/admin',
    type: 'Admin Endpoint Exposed',
    category: 'exposure',
    severity: 'high',
    description: 'An admin endpoint is directly accessible and may reveal privileged surfaces.',
    suggestion: 'Restrict admin routes behind authentication and explicit authorization controls.',
  },
  {
    path: '/admin/login',
    type: 'Admin Login Endpoint Exposed',
    category: 'exposure',
    severity: 'medium',
    description: 'An admin login endpoint is externally reachable and may expand the exposed authentication surface.',
    suggestion: 'Ensure the admin login surface is necessary, monitored, and protected with rate limiting and MFA.',
  },
  {
    path: '/login',
    type: 'Login Endpoint Exposed',
    category: 'exposure',
    severity: 'medium',
    description: 'A login endpoint is publicly reachable and should be intentionally protected and monitored.',
    suggestion: 'Confirm the endpoint is expected, rate limited, and protected with strong authentication controls.',
  },
  {
    path: '/dashboard',
    type: 'Dashboard Endpoint Exposed',
    category: 'exposure',
    severity: 'medium',
    description: 'A dashboard endpoint is directly reachable and may expose authenticated functionality.',
    suggestion: 'Require authentication and verify dashboard routes do not leak privileged information.',
  },
  {
    path: '/debug',
    type: 'Debug Endpoint Exposed',
    category: 'exposure',
    severity: 'high',
    description: 'A debug endpoint is externally reachable and may expose internal application state.',
    suggestion: 'Remove or disable debug routes in production environments.',
  },
  {
    path: '/.git',
    type: 'Git Directory Exposed',
    category: 'exposure',
    severity: 'high',
    description: 'The .git directory appears reachable from the public web surface.',
    suggestion: 'Block access to /.git entirely and ensure repository metadata is never deployed into the web root.',
  },
  {
    path: '/config',
    type: 'Config Endpoint Exposed',
    category: 'exposure',
    severity: 'high',
    description: 'A configuration endpoint is publicly accessible and may disclose application settings.',
    suggestion: 'Remove or restrict configuration endpoints and ensure sensitive configuration never appears in public routes.',
  },
  {
    path: '/config.json',
    type: 'Config File Exposed',
    category: 'exposure',
    severity: 'high',
    description: 'A config.json file is publicly accessible and may reveal environment details or credentials.',
    suggestion: 'Move configuration outside the public web root and block direct file access.',
  },
  {
    path: '/server-status',
    type: 'Server Status Exposed',
    category: 'exposure',
    severity: 'high',
    description: 'A server status endpoint is publicly reachable and may reveal operational details about the host.',
    suggestion: 'Restrict server-status to internal networks or disable it in production.',
  },
  {
    path: '/backup',
    type: 'Backup Endpoint Exposed',
    category: 'exposure',
    severity: 'high',
    description: 'A backup-related path is publicly reachable and may expose archived application or database content.',
    suggestion: 'Move backups off the public web surface and block direct access.',
  },
  {
    path: '/db',
    type: 'Database Endpoint Exposed',
    category: 'exposure',
    severity: 'high',
    description: 'A database-related path is publicly reachable and may expose internal operational assets.',
    suggestion: 'Ensure database tooling and exports are never accessible from public routes.',
  },
  {
    path: '/swagger',
    type: 'Swagger UI Exposed',
    category: 'exposure',
    severity: 'medium',
    description: 'Swagger UI is publicly accessible and reveals API structure and interactive documentation.',
    suggestion: 'Restrict Swagger UI to authenticated users or disable it in production.',
  },
];

function isPrivateOrLocalhost(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url);
    if (!['http:', 'https:'].includes(protocol)) return true;
    if (hostname === 'localhost' || hostname.endsWith('.local')) return true;
    if (/^127\./.test(hostname) || hostname === '::1') return true;
    if (/^10\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    if (/^169\.254\./.test(hostname)) return true;
    if (/^0\./.test(hostname)) return true;
    return false;
  } catch {
    return true;
  }
}

const SCANNER_UA = 'Almond-teAI-Security-Scanner/1.0';

interface ScanResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body?: string | null;
}

interface RequestOptions {
  method?: 'GET' | 'HEAD' | 'POST';
  body?: string;
  extraHeaders?: Record<string, string>;
  includeBody?: boolean;
  maxBytes?: number;
}

function nodeRequest(url: string, timeoutMs: number, requestOptions: RequestOptions = {}): Promise<ScanResponse | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url);
      const mod = parsed.protocol === 'https:' ? https : http;
      const method = requestOptions.method ?? 'GET';
      const requestConfig = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers: {
          'User-Agent': SCANNER_UA,
          Accept: '*/*',
          ...(requestOptions.extraHeaders ?? {}),
        },
        rejectUnauthorized: false,
        timeout: timeoutMs,
      };
      const req = mod.request(requestConfig, res => {
        if (!requestOptions.includeBody || method === 'HEAD') {
          res.resume();
          const hdrs: Record<string, string | string[]> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (value !== undefined) hdrs[key] = value;
          }
          resolve({ status: res.statusCode ?? 0, headers: hdrs, body: null });
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        const maxBytes = requestOptions.maxBytes ?? 4096;
        res.on('data', chunk => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buffer.length;
          if (totalBytes <= maxBytes) {
            chunks.push(buffer);
          }
        });
        res.on('end', () => {
          const hdrs: Record<string, string | string[]> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (value !== undefined) hdrs[key] = value;
          }
          resolve({
            status: res.statusCode ?? 0,
            headers: hdrs,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
        res.on('error', () => resolve(null));
      });
      if (requestOptions.body) {
        req.write(requestOptions.body);
      }
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.on('error', () => resolve(null));
      req.end();
    } catch {
      resolve(null);
    }
  });
}

function getHeader(headers: Record<string, string | string[]>, name: string): string | null {
  const value = headers[name.toLowerCase()];
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

async function safeFetch(url: string, timeoutMs = 6000): Promise<ScanResponse | null> {
  let current = url;
  for (let i = 0; i < 3; i++) {
    const response = await nodeRequest(current, timeoutMs, { method: 'GET' });
    if (!response) return null;
    if (response.status >= 301 && response.status <= 308) {
      const location = getHeader(response.headers, 'location');
      if (!location) return response;
      current = location.startsWith('http') ? location : new URL(location, current).href;
      continue;
    }
    return response;
  }
  return null;
}

async function probeStatus(url: string): Promise<number | null> {
  const response = await nodeRequest(url, 4000, { method: 'HEAD' });
  return response ? response.status : null;
}

function createWebsiteFinding(input: Omit<UrlVulnerability, 'confidence' | 'exploitability'> & {
  confidence?: FindingConfidence;
  exploitability?: FindingExploitability;
}): UrlVulnerability {
  return {
    confidence: input.confidence ?? 'detected',
    exploitability: input.exploitability ?? 'none',
    ...input,
  };
}

async function fetchVerificationBody(
  cache: Map<string, ScanResponse | null>,
  url: string,
  requestOptions: RequestOptions,
): Promise<ScanResponse | null> {
  const key = `${requestOptions.method ?? 'GET'}:${url}:${requestOptions.body ?? ''}`;
  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }

  const response = await nodeRequest(url, 5000, {
    includeBody: true,
    maxBytes: 4096,
    ...requestOptions,
  });
  cache.set(key, response);
  return response;
}

function verifyReadableEnv(body: string | null | undefined): boolean {
  if (!body) return false;
  return /(?:^|\n)\s*[A-Z0-9_]+\s*=\s*.+/m.test(body);
}

function verifyGitHead(body: string | null | undefined): boolean {
  if (!body) return false;
  return /^ref:\s+refs\/heads\//m.test(body.trim());
}

function verifySwagger(body: string | null | undefined): boolean {
  if (!body) return false;
  return /"openapi"\s*:|"swagger"\s*:|swagger-ui|openapi/i.test(body);
}

function verifyApiDocs(body: string | null | undefined): boolean {
  if (!body) return false;
  return /swagger-ui|swagger|openapi|api docs|redoc/i.test(body);
}

function verifyGraphqlResponse(response: ScanResponse | null): boolean {
  if (!response || (response.status !== 200 && response.status !== 400)) return false;
  const contentType = getHeader(response.headers, 'content-type') ?? '';
  const body = response.body ?? '';
  return /json/i.test(contentType) && /"data"|"errors"|__typename/i.test(body);
}

async function verifyExploitability(
  base: string,
  finding: UrlVulnerability,
  cache: Map<string, ScanResponse | null>,
): Promise<UrlVulnerability> {
  if (finding.type === 'Missing Content-Security-Policy') {
    return { ...finding, exploitability: 'possible' };
  }

  if (finding.type === 'CORS Wildcard + Credentials') {
    return { ...finding, exploitability: 'confirmed' };
  }

  if (finding.type === 'CORS Wildcard Origin') {
    return { ...finding, exploitability: 'possible' };
  }

  if (finding.type === 'Exposed .env File' && finding.file === '/.env') {
    const response = await fetchVerificationBody(cache, `${base}${finding.file}`, { method: 'GET' });
    return {
      ...finding,
      exploitability: verifyReadableEnv(response?.body) ? 'confirmed' : 'possible',
    };
  }

  if (finding.type === 'Exposed Git Repository' && finding.file === '/.git/HEAD') {
    const response = await fetchVerificationBody(cache, `${base}${finding.file}`, { method: 'GET' });
    return {
      ...finding,
      exploitability: verifyGitHead(response?.body) ? 'confirmed' : 'possible',
    };
  }

  if (finding.type === 'API Docs Exposed' && finding.file === '/swagger.json') {
    const response = await fetchVerificationBody(cache, `${base}${finding.file}`, {
      method: 'GET',
      extraHeaders: { Accept: 'application/json,text/plain,*/*' },
    });
    return {
      ...finding,
      exploitability: verifySwagger(response?.body) ? 'confirmed' : 'possible',
    };
  }

  if (finding.type === 'API Docs Endpoint Exposed' && finding.file === '/api-docs') {
    const response = await fetchVerificationBody(cache, `${base}${finding.file}`, { method: 'GET' });
    return {
      ...finding,
      exploitability: verifyApiDocs(response?.body) ? 'confirmed' : 'possible',
    };
  }

  if (finding.type === 'GraphQL Endpoint Exposed' && finding.file === '/graphql') {
    const response = await fetchVerificationBody(cache, `${base}${finding.file}`, {
      method: 'POST',
      body: JSON.stringify({ query: '{ __typename }' }),
      extraHeaders: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    return {
      ...finding,
      exploitability: verifyGraphqlResponse(response) ? 'confirmed' : 'possible',
    };
  }

  return finding;
}

async function runExploitVerification(base: string, findings: UrlVulnerability[]): Promise<UrlVulnerability[]> {
  const cache = new Map<string, ScanResponse | null>();
  return Promise.all(findings.map(finding => verifyExploitability(base, finding, cache)));
}

export async function scanUrl(rawUrl: string): Promise<UrlScanResult> {
  const vulnerabilities: UrlVulnerability[] = [];

  let target: string;
  try {
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    target = url.href;
  } catch {
    throw new Error('Invalid URL');
  }

  if (isPrivateOrLocalhost(target)) {
    throw new Error('Cannot scan private or localhost URLs');
  }

  const mainResponse = await safeFetch(target);
  if (!mainResponse) throw new Error('Could not reach the website. Check the URL and try again.');

  const headers = mainResponse.headers;
  let totalChecks = 0;
  let passedChecks = 0;

  totalChecks++;
  if (!target.startsWith('https://')) {
      vulnerabilities.push(createWebsiteFinding({
        type: 'No HTTPS / Unencrypted Connection',
        category: 'configuration',
        severity: 'critical',
      confidence: 'verified',
      file: 'Protocol',
      line: null,
      code: target,
      description: 'The site does not use HTTPS. Traffic can be intercepted or modified in transit.',
      suggestion: 'Add TLS and redirect all HTTP traffic to HTTPS.',
    }));
  } else {
    passedChecks++;
  }

  for (const header of REQUIRED_HEADERS) {
    totalChecks++;
    const value = getHeader(headers, header.name);
    if (!value) {
      vulnerabilities.push(createWebsiteFinding({
        type: header.type,
        category: 'configuration',
        severity: header.severity,
        confidence: 'detected',
        file: 'HTTP Header',
        line: null,
        code: null,
        description: header.description,
        suggestion: header.suggestion,
      }));
    } else {
      passedChecks++;
    }
  }

  totalChecks++;
  const poweredBy = getHeader(headers, 'x-powered-by');
  if (poweredBy) {
    vulnerabilities.push(createWebsiteFinding({
      type: 'Server Technology Disclosed',
      category: 'configuration',
      severity: 'info',
      confidence: 'detected',
      file: 'HTTP Header',
      line: null,
      code: `X-Powered-By: ${poweredBy}`,
      description: `The server discloses its technology stack via X-Powered-By: ${poweredBy}.`,
      suggestion: 'Remove or obscure the X-Powered-By header.',
    }));
  } else {
    passedChecks++;
  }

  totalChecks++;
  const serverHeader = getHeader(headers, 'server');
  if (serverHeader && /[\d.]+/.test(serverHeader)) {
    vulnerabilities.push(createWebsiteFinding({
      type: 'Server Version Disclosed',
      category: 'configuration',
      severity: 'info',
      confidence: 'detected',
      file: 'HTTP Header',
      line: null,
      code: `Server: ${serverHeader}`,
      description: `The Server header reveals version information: "${serverHeader}".`,
      suggestion: 'Configure the web server to suppress version details.',
    }));
  } else {
    passedChecks++;
  }

  const rawCookies: string[] = [];
  const setCookieHeader = headers['set-cookie'];
  if (Array.isArray(setCookieHeader)) rawCookies.push(...setCookieHeader);
  else if (setCookieHeader) rawCookies.push(setCookieHeader);

  for (const cookie of rawCookies) {
    const lowered = cookie.toLowerCase();
    totalChecks++;
    if (!lowered.includes('httponly')) {
      const name = cookie.split('=')[0].trim();
      vulnerabilities.push(createWebsiteFinding({
        type: 'Cookie Missing HttpOnly Flag',
        category: 'configuration',
        severity: 'low',
        confidence: 'detected',
        file: 'Cookie',
        line: null,
        code: cookie.substring(0, 120),
        description: `Cookie "${name}" is missing the HttpOnly flag.`,
        suggestion: 'Set HttpOnly on sensitive cookies.',
      }));
    } else {
      passedChecks++;
    }

    totalChecks++;
    if (target.startsWith('https://') && !lowered.includes('secure')) {
      const name = cookie.split('=')[0].trim();
      vulnerabilities.push(createWebsiteFinding({
        type: 'Cookie Missing Secure Flag',
        category: 'configuration',
        severity: 'low',
        confidence: 'detected',
        file: 'Cookie',
        line: null,
        code: cookie.substring(0, 120),
        description: `Cookie "${name}" is missing the Secure flag.`,
        suggestion: 'Add the Secure flag to cookies sent over HTTPS.',
      }));
    } else {
      passedChecks++;
    }
  }

  totalChecks++;
  const corsOrigin = getHeader(headers, 'access-control-allow-origin');
  const corsCredentials = getHeader(headers, 'access-control-allow-credentials');
  if (corsOrigin === '*' && corsCredentials === 'true') {
    vulnerabilities.push(createWebsiteFinding({
      type: 'CORS Wildcard + Credentials',
      category: 'configuration',
      severity: 'critical',
      confidence: 'verified',
      file: 'HTTP Header',
      line: null,
      code: 'Access-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true',
      description: 'CORS allows any origin with credentials, enabling authenticated cross-origin requests.',
      suggestion: 'Never combine wildcard origin with credentials. Allow only explicit trusted origins.',
    }));
  } else if (corsOrigin === '*') {
    vulnerabilities.push(createWebsiteFinding({
      type: 'CORS Wildcard Origin',
      category: 'configuration',
      severity: 'low',
      confidence: 'detected',
      file: 'HTTP Header',
      line: null,
      code: 'Access-Control-Allow-Origin: *',
      description: 'CORS is configured to allow any origin.',
      suggestion: 'Replace wildcard origins with explicit trusted origins.',
    }));
  } else {
    passedChecks++;
  }

  const base = new URL(target).origin;
  const probeResults = await Promise.allSettled(
    SENSITIVE_PATHS.map(async pathConfig => {
      const status = await probeStatus(`${base}${pathConfig.path}`);
      return { ...pathConfig, status };
    }),
  );

  let probedPaths = 0;
  for (const probeResult of probeResults) {
    if (probeResult.status !== 'fulfilled') continue;
    const { path, type, category, severity, description, suggestion, status } = probeResult.value;
    probedPaths++;
    totalChecks++;
    const shouldFlagGraphql = path === '/graphql' && (status === 200 || status === 400 || status === 405);
    if (status === 200 || shouldFlagGraphql) {
      vulnerabilities.push(createWebsiteFinding({
        type,
        category,
        severity,
        confidence: severity === 'critical' || severity === 'high' ? 'verified' : 'likely',
        file: path,
        line: null,
        code: `HTTP 200 OK -> ${base}${path}`,
        description,
        suggestion,
      }));
    } else {
      passedChecks++;
    }
  }

  const verifiedVulnerabilities = await runExploitVerification(base, vulnerabilities);

  const score = calculateScore(verifiedVulnerabilities, 'website').score;
  const criticalCount = verifiedVulnerabilities.filter(vulnerability => vulnerability.severity === 'critical').length;
  const highCount = verifiedVulnerabilities.filter(vulnerability => vulnerability.severity === 'high').length;
  const { hostname } = new URL(target);

  let summary = `Website scan of ${hostname} - ${verifiedVulnerabilities.length} issue${verifiedVulnerabilities.length !== 1 ? 's' : ''} found`;
  if (criticalCount > 0) summary += ` (${criticalCount} critical)`;
  if (highCount > 0) summary += `, ${highCount} high severity`;
  summary += `. Security score: ${score}/100.`;

  return {
    score,
    vulnerabilities: verifiedVulnerabilities,
    summary,
    totalChecks,
    passedChecks,
    probedPaths,
  };
}
