import type { WebsiteFingerprint, WebsiteModuleResult } from '../types';
import { createWebsiteFinding, requestUrl } from '../url-scanner';

interface ParsedLoginForm {
  actionUrl: string;
  method: 'GET' | 'POST';
  usernameField: string;
  passwordField: string;
  hasHiddenState: boolean;
}

function findPasswordForm(body: string): string | null {
  const forms = body.match(/<form[\s\S]*?<\/form>/gi) ?? [];
  return forms.find(form => /type=["']password["']/i.test(form)) ?? null;
}

function getAttribute(fragment: string, attribute: string): string | null {
  const match = fragment.match(new RegExp(`${attribute}=["']([^"']+)["']`, 'i'));
  return match?.[1] ?? null;
}

function parseLoginForm(baseUrl: string, body: string): ParsedLoginForm | null {
  const form = findPasswordForm(body);
  if (!form) return null;

  const methodAttr = (getAttribute(form, 'method') ?? 'POST').toUpperCase();
  const method = methodAttr === 'GET' ? 'GET' : 'POST';
  const action = getAttribute(form, 'action') ?? baseUrl;
  const inputNames = Array.from(form.matchAll(/<input[^>]+name=["']([^"']+)["'][^>]*>/gi)).map(match => match[1]);
  const hiddenNames = Array.from(form.matchAll(/<input[^>]+type=["']hidden["'][^>]+name=["']([^"']+)["'][^>]*>/gi)).map(match => match[1].toLowerCase());

  const usernameField = inputNames.find(name => /^(username|email|login|user)$/i.test(name));
  const passwordField = inputNames.find(name => /^password$/i.test(name));
  if (!usernameField || !passwordField) return null;

  return {
    actionUrl: new URL(action, baseUrl).href,
    method,
    usernameField,
    passwordField,
    hasHiddenState: hiddenNames.some(name => /csrf|token|authenticity|state/.test(name)),
  };
}

function hasThrottleSignal(body: string | null | undefined): boolean {
  if (!body) return false;
  return /(too many requests|too many attempts|try again later|temporarily locked|account locked|captcha|rate limit)/i.test(body);
}

export async function runAuthHeuristics(fingerprint: WebsiteFingerprint): Promise<WebsiteModuleResult> {
  const notes: string[] = [];
  const findings: WebsiteModuleResult['vulnerabilities'] = [];

  if (!fingerprint.probableAuthSurface) {
    return {
      vulnerabilities: findings,
      coverageNotes: notes,
      activeValidationPerformed: false,
      networkChecksPartial: false,
    };
  }

  notes.push('Authentication surface indicators were detected and reviewed for safe, limited validation.');

  const parsedForm = parseLoginForm(fingerprint.normalizedUrl, fingerprint.pageBody);
  if (!parsedForm) {
    notes.push('Limited authentication validation was not performed because the public login form could not be safely parsed into a low-risk request shape.');
    return {
      vulnerabilities: findings,
      coverageNotes: notes,
      activeValidationPerformed: false,
      networkChecksPartial: false,
    };
  }

  if (parsedForm.hasHiddenState) {
    notes.push('Limited authentication validation was skipped because the detected login form uses hidden state or anti-CSRF fields that were not replayed automatically.');
    return {
      vulnerabilities: findings,
      coverageNotes: notes,
      activeValidationPerformed: false,
      networkChecksPartial: false,
    };
  }

  const invalidBody = new URLSearchParams({
    [parsedForm.usernameField]: 'almond-teai-invalid-user',
    [parsedForm.passwordField]: 'almond-teai-invalid-password',
  }).toString();

  const responses = await Promise.all([
    requestUrl(parsedForm.actionUrl, 5000, {
      method: parsedForm.method,
      body: invalidBody,
      includeBody: true,
      maxBytes: 4096,
      extraHeaders: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }),
    requestUrl(parsedForm.actionUrl, 5000, {
      method: parsedForm.method,
      body: invalidBody,
      includeBody: true,
      maxBytes: 4096,
      extraHeaders: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }),
  ]);

  const completeResponses = responses.filter(Boolean);
  if (completeResponses.length !== 2) {
    notes.push('Limited authentication validation was attempted with two invalid submissions, but one or more network responses were incomplete.');
    return {
      vulnerabilities: findings,
      coverageNotes: notes,
      activeValidationPerformed: true,
      networkChecksPartial: true,
    };
  }

  notes.push('Limited active validation was performed using two non-destructive invalid authentication attempts.');

  const [first, second] = completeResponses;
  const sameStatus = first!.status === second!.status;
  const throttleObserved = hasThrottleSignal(first!.body) || hasThrottleSignal(second!.body);

  if (sameStatus && !throttleObserved && [200, 401, 403].includes(first!.status)) {
    findings.push(createWebsiteFinding({
      type: 'No Visible Login Throttling Signal Observed',
      category: 'configuration',
      severity: 'medium',
      confidence: 'likely',
      exploitability: 'possible',
      file: parsedForm.actionUrl.replace(fingerprint.origin, '') || '/login',
      line: null,
      code: `Repeated invalid ${parsedForm.method} responses returned status ${first!.status}`,
      description: 'Two limited invalid login attempts returned similar responses without an obvious throttling, lockout, or challenge signal. This is not proof that protection is absent, but it suggests the public authentication surface should be reviewed.',
      suggestion: 'Review rate limiting, lockout behavior, MFA, and bot defenses on the public authentication flow.',
    }));
  }

  return {
    vulnerabilities: findings,
    coverageNotes: notes,
    activeValidationPerformed: true,
    networkChecksPartial: false,
  };
}
