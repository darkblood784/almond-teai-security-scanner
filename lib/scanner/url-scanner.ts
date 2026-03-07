import http from 'http';
import https from 'https';
import { calculateScore, type FindingConfidence, type FindingSeverity } from '@/lib/scoring';

export type Severity = FindingSeverity;

export interface UrlVulnerability {
  type: string;
  severity: Severity;
  confidence: FindingConfidence;
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
  severity: Severity;
  description: string;
  suggestion: string;
}> = [
  {
    path: '/.env',
    type: 'Exposed .env File',
    severity: 'critical',
    description: 'Environment file is publicly accessible. This likely exposes API keys, database credentials, and JWT secrets.',
    suggestion: 'Block access immediately in your web server. For Nginx: location ~ /\\.env { deny all; }.',
  },
  {
    path: '/.env.local',
    type: 'Exposed .env.local File',
    severity: 'critical',
    description: 'Local environment file is publicly accessible, potentially exposing secrets.',
    suggestion: 'Block all .env* files: location ~ /\\.env { deny all; }',
  },
  {
    path: '/.env.production',
    type: 'Exposed .env.production File',
    severity: 'critical',
    description: 'Production environment file is publicly accessible and production secrets may be compromised.',
    suggestion: 'Block access to all .env* files in your web server immediately.',
  },
  {
    path: '/.git/HEAD',
    type: 'Exposed Git Repository',
    severity: 'high',
    description: 'The .git directory is publicly accessible. Attackers can reconstruct your source code and git history.',
    suggestion: 'Block access to /.git and ensure it is never deployed into the public web root.',
  },
  {
    path: '/wp-config.php',
    type: 'Exposed WordPress Config',
    severity: 'critical',
    description: 'WordPress config with database host, username, and password is publicly accessible.',
    suggestion: 'Move wp-config.php above the web root or explicitly deny access in web server config.',
  },
  {
    path: '/phpinfo.php',
    type: 'PHP Info Page Exposed',
    severity: 'high',
    description: 'phpinfo() reveals server config, versions, modules, and environment details.',
    suggestion: 'Delete phpinfo.php from your server immediately.',
  },
  {
    path: '/swagger.json',
    type: 'API Docs Exposed',
    severity: 'medium',
    description: 'Swagger/OpenAPI spec is publicly accessible and reveals your API surface area.',
    suggestion: 'Restrict API docs to authenticated users or disable them in production.',
  },
  {
    path: '/api-docs',
    type: 'API Docs Endpoint Exposed',
    severity: 'medium',
    description: 'API documentation endpoint is publicly accessible in production.',
    suggestion: 'Add authentication or disable the endpoint in production.',
  },
  {
    path: '/openapi.json',
    type: 'OpenAPI Spec Exposed',
    severity: 'medium',
    description: 'OpenAPI specification is publicly accessible.',
    suggestion: 'Restrict access to API specs in production.',
  },
  {
    path: '/graphql',
    type: 'GraphQL Endpoint Exposed',
    severity: 'medium',
    description: 'GraphQL endpoint is accessible without authentication and may expose introspection details.',
    suggestion: 'Disable GraphQL introspection in production or add authentication.',
  },
  {
    path: '/package.json',
    type: 'package.json Exposed',
    severity: 'low',
    description: 'package.json reveals dependencies and versions to unauthenticated users.',
    suggestion: 'Block access to package.json in your web server config.',
  },
  {
    path: '/server.js',
    type: 'Server Source Code Exposed',
    severity: 'medium',
    description: 'Server-side JavaScript source code is publicly accessible.',
    suggestion: 'Ensure source files are not in your static/public serving directory.',
  },
  {
    path: '/database.yml',
    type: 'Database Config Exposed',
    severity: 'high',
    description: 'Database configuration file is publicly accessible and may contain credentials.',
    suggestion: 'Move config files outside the web root and block access via server config.',
  },
  {
    path: '/.DS_Store',
    type: '.DS_Store File Exposed',
    severity: 'info',
    description: '.DS_Store can reveal directory structure and naming hints.',
    suggestion: 'Block .DS_Store files and add them to .gitignore.',
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
}

function nodeRequest(url: string, timeoutMs: number, method = 'GET'): Promise<ScanResponse | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url);
      const mod = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers: { 'User-Agent': SCANNER_UA, Accept: '*/*' },
        rejectUnauthorized: false,
        timeout: timeoutMs,
      };
      const req = mod.request(options, res => {
        res.resume();
        const hdrs: Record<string, string | string[]> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (value !== undefined) hdrs[key] = value;
        }
        resolve({ status: res.statusCode ?? 0, headers: hdrs });
      });
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
    const response = await nodeRequest(current, timeoutMs);
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
  const response = await nodeRequest(url, 4000, 'HEAD');
  return response ? response.status : null;
}

function createWebsiteFinding(input: Omit<UrlVulnerability, 'confidence'> & { confidence?: FindingConfidence }): UrlVulnerability {
  return {
    confidence: input.confidence ?? 'detected',
    ...input,
  };
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
    const { path, type, severity, description, suggestion, status } = probeResult.value;
    probedPaths++;
    totalChecks++;
    if (status === 200) {
      vulnerabilities.push(createWebsiteFinding({
        type,
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

  const score = calculateScore(vulnerabilities, 'website').score;
  const criticalCount = vulnerabilities.filter(vulnerability => vulnerability.severity === 'critical').length;
  const highCount = vulnerabilities.filter(vulnerability => vulnerability.severity === 'high').length;
  const { hostname } = new URL(target);

  let summary = `Website scan of ${hostname} - ${vulnerabilities.length} issue${vulnerabilities.length !== 1 ? 's' : ''} found`;
  if (criticalCount > 0) summary += ` (${criticalCount} critical)`;
  if (highCount > 0) summary += `, ${highCount} high severity`;
  summary += `. Security score: ${score}/100.`;

  return {
    score,
    vulnerabilities,
    summary,
    totalChecks,
    passedChecks,
    probedPaths,
  };
}
