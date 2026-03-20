import type { WebsiteFingerprint, WebsiteModuleResult } from '../types';
import { createWebsiteFinding, normalizePublicUrl, safeFetch, type UrlVulnerability } from '../url-scanner';

const SECRET_PATTERNS: Array<{
  label: string;
  pattern: RegExp;
}> = [
  { label: 'AWS Access Key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: 'GitHub Token', pattern: /\bghp_[A-Za-z0-9]{36}\b/g },
  { label: 'Stripe Live Key', pattern: /\bsk_live_[0-9A-Za-z]{16,}\b/g },
  { label: 'Google API Key', pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
];

const PASSWORD_ASSIGNMENT_PATTERNS: RegExp[] = [
  /\b(?:password|passwd|passcode|pwd)\b\s*[:=]\s*['"`][^'"`\n]{4,}['"`]/gi,
  /\b(?:storedPassword|savedPassword|defaultPassword|adminPassword)\b\s*[:=]\s*['"`][^'"`\n]{4,}['"`]/gi,
];

const STORAGE_SECRET_PATTERNS: RegExp[] = [
  /localStorage\.(?:setItem|getItem)\s*\(\s*['"`](?:token|authToken|accessToken|refreshToken|password|passwd|secret)[^'"`]*['"`]/gi,
  /sessionStorage\.(?:setItem|getItem)\s*\(\s*['"`](?:token|authToken|accessToken|refreshToken|password|passwd|secret)[^'"`]*['"`]/gi,
];

const CLIENT_CRYPTO_KEY_PATTERNS: RegExp[] = [
  /\b(?:secretKey|privateKey|encryptionKey|aesKey|cryptoKey|iv)\b\s*[:=]\s*['"`][^'"`\n]{6,}['"`]/gi,
  /CryptoJS\.[A-Za-z]+\s*\([^)]*(?:password|secret|key|iv)/gi,
  /crypto\.subtle\.(?:encrypt|decrypt|importKey)\s*\(/gi,
];

function extractSameOriginScripts(baseUrl: string, body: string): string[] {
  const urls = new Set<string>();
  const matches = body.matchAll(/<script[^>]+src=["']([^"'#?]+(?:\.js(?:\?[^"']*)?)?)["']/gi);
  const base = new URL(baseUrl);

  for (const match of Array.from(matches)) {
    const src = match[1];
    try {
      const resolved = new URL(src, base).href;
      if (new URL(resolved).origin === base.origin) {
        urls.add(resolved);
      }
    } catch {
      continue;
    }
    if (urls.size >= 3) break;
  }

  return Array.from(urls);
}

async function collectFrontendSurface(normalizedUrl: string, body: string): Promise<string> {
  const parts = [body];
  const scriptUrls = extractSameOriginScripts(normalizedUrl, body);

  for (const scriptUrl of scriptUrls) {
    const response = await safeFetch(scriptUrl, 5000, {
      method: 'GET',
      includeBody: true,
      maxBytes: 49152,
    });
    if (response?.body) {
      parts.push(response.body);
    }
  }

  return parts.join('\n');
}

function buildSecretExposureFinding(label: string, snippet: string): UrlVulnerability {
  return createWebsiteFinding({
    type: 'Client-Side Secret Exposure',
    category: 'secret',
    severity: 'critical',
    confidence: 'verified',
    exploitability: 'confirmed',
    file: 'Frontend Asset',
    line: null,
    code: snippet.slice(0, 120),
    description: `${label} appears to be embedded in frontend-delivered code or markup, which can expose sensitive credentials to any visitor.`,
    suggestion: 'Remove secrets from frontend-delivered assets and move sensitive operations to trusted server-side components.',
  });
}

function buildPasswordExposureFinding(snippet: string): UrlVulnerability {
  return createWebsiteFinding({
    type: 'Client-Side Stored Password Signal',
    category: 'secret',
    severity: 'critical',
    confidence: 'likely',
    exploitability: 'confirmed',
    file: 'Frontend Asset',
    line: null,
    code: snippet.slice(0, 160),
    description: 'Frontend-delivered code appears to contain a password-like value or stored password assignment. This can expose sensitive authentication material to any visitor.',
    suggestion: 'Remove password values from frontend-delivered code and handle authentication secrets only on trusted backend systems.',
  });
}

function buildStorageFinding(snippet: string): UrlVulnerability {
  return createWebsiteFinding({
    type: 'Sensitive Browser Storage Usage',
    category: 'exposure',
    severity: 'high',
    confidence: 'likely',
    exploitability: 'possible',
    file: 'Frontend Asset',
    line: null,
    code: snippet.slice(0, 160),
    description: 'Frontend-delivered code appears to store or retrieve sensitive authentication material from browser storage. Browser storage is easier to expose through XSS or client compromise than secure server-side session handling.',
    suggestion: 'Avoid storing passwords or long-lived secrets in browser storage. Prefer secure, server-managed sessions and minimize token exposure in the browser.',
  });
}

function buildCryptoKeyFinding(snippet: string): UrlVulnerability {
  return createWebsiteFinding({
    type: 'Client-Side Encryption Key Embedded',
    category: 'secret',
    severity: 'high',
    confidence: 'likely',
    exploitability: 'possible',
    file: 'Frontend Asset',
    line: null,
    code: snippet.slice(0, 160),
    description: 'Frontend-delivered code appears to include client-side encryption key or key-like material. If real keys are shipped to the browser, attackers can inspect or reuse them.',
    suggestion: 'Keep encryption keys and sensitive cryptographic operations on backend services whenever possible. Do not ship reusable secrets to the browser.',
  });
}

function firstPatternMatch(surface: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = surface.match(pattern);
    if (match?.[0]) {
      return match[0];
    }
  }
  return null;
}

export async function runFrontendInspection(fingerprint: WebsiteFingerprint): Promise<WebsiteModuleResult> {
  const normalizedUrl = normalizePublicUrl(fingerprint.normalizedUrl);
  const collectedSurface = await collectFrontendSurface(normalizedUrl, fingerprint.pageBody);
  const findings: UrlVulnerability[] = [];
  const notes: string[] = ['Frontend inspection ran against the initial HTML response and a small set of same-origin script assets with broader client-side auth, storage, and crypto heuristics.'];

  for (const secretPattern of SECRET_PATTERNS) {
    const match = collectedSurface.match(secretPattern.pattern);
    if (match?.[0]) {
      findings.push(buildSecretExposureFinding(secretPattern.label, match[0]));
      break;
    }
  }

  if (/(cryptojs|crypto\.subtle|sjcl)/i.test(collectedSurface) && /(encrypt|decrypt|secret|privateKey|password)/i.test(collectedSurface)) {
    findings.push(createWebsiteFinding({
      type: 'Client-Side Crypto Logic Detected',
      category: 'code',
      severity: 'medium',
      confidence: 'likely',
      exploitability: 'possible',
      file: 'Frontend Asset',
      line: null,
      code: 'Client-side crypto markers detected in delivered assets',
      description: 'Frontend-delivered code appears to contain cryptographic logic tied to secrets or password-related handling. Review whether sensitive security decisions are being made client-side.',
      suggestion: 'Keep sensitive cryptographic operations and key handling on trusted backend services whenever possible.',
    }));
  }

  if (/(NEXT_PUBLIC_|REACT_APP_|VITE_).{0,32}(secret|token|password|private)/i.test(collectedSurface)) {
    findings.push(createWebsiteFinding({
      type: 'Sensitive Frontend Configuration Signal',
      category: 'exposure',
      severity: 'high',
      confidence: 'likely',
      exploitability: 'possible',
      file: 'Frontend Asset',
      line: null,
      code: 'Public frontend configuration references sensitive names',
      description: 'Frontend-delivered assets reference public configuration variables with secret-like naming. This often indicates sensitive values are being exposed client-side.',
      suggestion: 'Review frontend configuration variables and move sensitive values to backend-only secrets.',
    }));
  }

  const passwordMatch = firstPatternMatch(collectedSurface, PASSWORD_ASSIGNMENT_PATTERNS);
  if (passwordMatch) {
    findings.push(buildPasswordExposureFinding(passwordMatch));
  }

  const storageMatch = firstPatternMatch(collectedSurface, STORAGE_SECRET_PATTERNS);
  if (storageMatch) {
    findings.push(buildStorageFinding(storageMatch));
  }

  const cryptoKeyMatch = firstPatternMatch(collectedSurface, CLIENT_CRYPTO_KEY_PATTERNS);
  if (cryptoKeyMatch) {
    findings.push(buildCryptoKeyFinding(cryptoKeyMatch));
  }

  return {
    vulnerabilities: findings,
    coverageNotes: notes,
    activeValidationPerformed: false,
    networkChecksPartial: false,
  };
}
