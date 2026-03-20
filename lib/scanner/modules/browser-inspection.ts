import { chromium } from 'playwright';
import type { WebsiteFingerprint, WebsiteModuleResult, WebsiteProfile } from '../types';
import { createWebsiteFinding, type UrlVulnerability } from '../url-scanner';
import type { Page } from 'playwright';

interface BrowserInspectionData {
  html: string;
  bodyText: string;
  renderedPasswordFields: number;
  runtimeSignals: string[];
  storageItems: Array<{ area: 'localStorage' | 'sessionStorage'; key: string; valuePreview: string }>;
  requestUrls: string[];
  internalLinkCount: number;
  runtimeWindowKeys: string[];
  tableCount: number;
  repeatedCardLikeBlocks: number;
  frameworkHints: string[];
}

interface RouteInspectionData {
  url: string;
  html: string;
  renderedPasswordFields: number;
  authTextDetected: boolean;
}

interface BrowserAuthAttemptResult {
  attempted: boolean;
  notes: string[];
  findings: UrlVulnerability[];
  networkChecksPartial: boolean;
}

const AUTH_ROUTE_CANDIDATES = [
  '/login',
  '/signin',
  '/sign-in',
  '/auth/login',
  '/account/login',
  '/member/login',
  '/user/login',
  '/admin/login',
];

const AUTH_TRIGGER_SELECTORS = [
  'a:has-text("Login")',
  'a:has-text("Log in")',
  'a:has-text("Sign in")',
  'button:has-text("Login")',
  'button:has-text("Log in")',
  'button:has-text("Sign in")',
  '[role="button"]:has-text("Login")',
  '[role="button"]:has-text("Log in")',
  '[role="button"]:has-text("Sign in")',
  'a[href*="login" i]',
  'a[href*="signin" i]',
  'a[href*="auth" i]',
  'button[aria-label*="login" i]',
  'a[href*="account" i]',
  'a[href*="member" i]',
  'button[class*="login" i]',
  'button[id*="login" i]',
  'a[title*="login" i]',
  'button:has-text("Member")',
  'button:has-text("Portal")',
  'button:has-text("Access")',
  'button:has-text("Enter")',
  'a:has-text("登入")',
  'button:has-text("登入")',
];

const EXPLORATION_SELECTORS = [
  'button',
  'a',
  '[role="button"]',
  '[data-testid]',
  '[onclick]',
];

function determineProfileOverride(
  fingerprint: WebsiteFingerprint,
  data: BrowserInspectionData,
): WebsiteProfile | null {
  if (fingerprint.profile !== 'surface') return null;
  if (data.renderedPasswordFields > 0) return 'webapp-light';
  if (data.runtimeSignals.length > 0) return 'webapp-light';
  if (data.requestUrls.some(url => /\/(login|signin|sign-in|auth|session|account)\b/i.test(url))) {
    return 'webapp-light';
  }
  return null;
}

function buildStorageFinding(item: BrowserInspectionData['storageItems'][number]): UrlVulnerability {
  return createWebsiteFinding({
    type: 'Sensitive Browser Storage Usage',
    category: 'exposure',
    severity: 'high',
    confidence: 'likely',
    exploitability: 'possible',
    file: 'Browser Runtime',
    line: null,
    code: `${item.area}.${item.key}=${item.valuePreview}`,
    description: 'The rendered application stored or referenced security-sensitive material in browser storage during runtime. Browser storage is easier to expose through XSS or client compromise than secure server-managed session handling.',
    suggestion: 'Avoid storing passwords or long-lived secrets in browser storage. Prefer secure, server-managed sessions and minimize secret exposure in the browser.',
  });
}

function buildRuntimePasswordFinding(snippet: string): UrlVulnerability {
  return createWebsiteFinding({
    type: 'Client-Side Stored Password Signal',
    category: 'secret',
    severity: 'critical',
    confidence: 'likely',
    exploitability: 'confirmed',
    file: 'Browser Runtime',
    line: null,
    code: snippet.slice(0, 160),
    description: 'The rendered application appears to expose a password-like value or client-side password handling signal during runtime. This can expose sensitive authentication material to visitors.',
    suggestion: 'Remove password values from browser-delivered runtime state and keep authentication secrets on trusted backend systems.',
  });
}

function buildRuntimeCryptoFinding(snippet: string): UrlVulnerability {
  return createWebsiteFinding({
    type: 'Client-Side Encryption Key Embedded',
    category: 'secret',
    severity: 'high',
    confidence: 'likely',
    exploitability: 'possible',
    file: 'Browser Runtime',
    line: null,
    code: snippet.slice(0, 160),
    description: 'The rendered application appears to expose client-side encryption key or key-like material during runtime. If reusable keys are delivered to the browser, attackers can inspect or reuse them.',
    suggestion: 'Keep encryption keys and sensitive cryptographic operations on backend services whenever possible. Do not deliver reusable secrets to the browser.',
  });
}

function buildPortalExposureFinding(evidence: string): UrlVulnerability {
  return createWebsiteFinding({
    type: 'Public Internal Portal Content Exposure',
    category: 'exposure',
    severity: 'medium',
    confidence: 'likely',
    exploitability: 'possible',
    file: 'Browser Runtime',
    line: null,
    code: evidence.slice(0, 160),
    description: 'The rendered application appears to expose structured internal portal or course content on a public-facing page. Review whether this content is intended to be publicly accessible.',
    suggestion: 'Review page access control and confirm that internal academic, student, or portal content is not exposed before authentication.',
  });
}

function buildRuntimeConfigFinding(snippet: string): UrlVulnerability {
  return createWebsiteFinding({
    type: 'Sensitive Runtime Configuration Signal',
    category: 'exposure',
    severity: 'medium',
    confidence: 'detected',
    exploitability: 'possible',
    file: 'Browser Runtime',
    line: null,
    code: snippet.slice(0, 160),
    description: 'The rendered application surface exposed runtime state or configuration keys with auth-, token-, or secret-like naming. This is a signal to review what client-side state is being exposed.',
    suggestion: 'Review runtime state and configuration exposed to the browser, and move sensitive values to server-only handling where possible.',
  });
}

function hasThrottleSignal(body: string): boolean {
  return /(too many requests|too many attempts|try again later|temporarily locked|account locked|captcha|rate limit|retry later)/i.test(body);
}

function hasLockoutSignal(body: string): boolean {
  return /(account locked|temporarily locked|locked due to|too many failed)/i.test(body);
}

function hasLoginIntent(body: string): boolean {
  return /(sign in|log in|login|authenticate|member login|account login|登入|登錄|密碼|帳號)/i.test(body);
}

function hasPortalLayoutSignals(data: BrowserInspectionData): boolean {
  return (
    data.internalLinkCount >= 12 ||
    data.tableCount >= 3 ||
    data.repeatedCardLikeBlocks >= 8 ||
    data.runtimeSignals.includes('portal content markers') ||
    data.frameworkHints.length > 0
  );
}

async function attemptBrowserAuthValidation(routePage: Page, routeUrl: string): Promise<BrowserAuthAttemptResult> {
  const notes: string[] = [];
  const findings: UrlVulnerability[] = [];

  const bodyText = await routePage.locator('body').innerText().catch(() => '');
  if (!hasLoginIntent(bodyText) || /(sign up|register|create account)/i.test(bodyText)) {
    notes.push('Browser auth validation was skipped because the discovered route did not clearly present a login-focused form.');
    return { attempted: false, notes, findings, networkChecksPartial: false };
  }

  const passwordField = routePage.locator('input[type="password"]').first();
  if ((await passwordField.count()) === 0) {
    notes.push('Browser auth validation was skipped because no rendered password input was available on the discovered route.');
    return { attempted: false, notes, findings, networkChecksPartial: false };
  }

  const captchaPresent = /(captcha|hcaptcha|recaptcha)/i.test(await routePage.content().catch(() => ''));
  if (captchaPresent) {
    notes.push('Browser auth validation was skipped because a challenge or CAPTCHA signal was present on the authentication route.');
    return { attempted: false, notes, findings, networkChecksPartial: false };
  }

  const usernameCandidates = [
    'input[name*="email" i]',
    'input[name*="user" i]',
    'input[name*="login" i]',
    'input[type="email"]',
    'input[type="text"]',
  ];

  let usernameField = null as ReturnType<Page['locator']> | null;
  for (const selector of usernameCandidates) {
    const candidate = routePage.locator(selector).first();
    if ((await candidate.count()) > 0) {
      usernameField = candidate;
      break;
    }
  }

  if (!usernameField) {
    notes.push('Browser auth validation was skipped because a safe username/email input could not be identified on the rendered login route.');
    return { attempted: false, notes, findings, networkChecksPartial: false };
  }

  const submitCandidates = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
    'button:has-text("Login")',
  ];

  let submitControl = null as ReturnType<Page['locator']> | null;
  for (const selector of submitCandidates) {
    const candidate = routePage.locator(selector).first();
    if ((await candidate.count()) > 0) {
      submitControl = candidate;
      break;
    }
  }

  if (!submitControl) {
    notes.push('Browser auth validation was skipped because a safe submit control could not be identified on the rendered login route.');
    return { attempted: false, notes, findings, networkChecksPartial: false };
  }

  const attemptResponses: string[] = [];
  const attemptUrls: string[] = [];
  let networkChecksPartial = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await usernameField.fill('almond-teai-invalid-user@example.com');
      await passwordField.fill('Almond-TeAI-Invalid-Password-1!');

      const submitPromise = Promise.allSettled([
        routePage.waitForLoadState('networkidle', { timeout: 4000 }),
        routePage.waitForResponse(() => true, { timeout: 4000 }),
      ]);

      await submitControl.click({ timeout: 2000 });
      await submitPromise;
      await routePage.waitForTimeout(800);

      const currentText = await routePage.locator('body').innerText().catch(() => '');
      attemptResponses.push(currentText);
      attemptUrls.push(routePage.url());
    } catch {
      networkChecksPartial = true;
      attemptResponses.push(await routePage.locator('body').innerText().catch(() => ''));
      attemptUrls.push(routePage.url());
    }
  }

  notes.push('Limited active validation was performed in a headless browser using two non-destructive invalid authentication attempts on a discovered login route.');

  const combinedText = attemptResponses.join('\n');
  const throttleObserved = hasThrottleSignal(combinedText);
  const lockoutObserved = hasLockoutSignal(combinedText);
  const stableRoute = attemptUrls.length === 2 && attemptUrls[0] === attemptUrls[1];

  if (!throttleObserved && stableRoute) {
    findings.push(createWebsiteFinding({
      type: 'No Visible Login Throttling Signal Observed',
      category: 'configuration',
      severity: 'medium',
      confidence: 'likely',
      exploitability: 'possible',
      file: routeUrl.replace(new URL(routeUrl).origin, '') || '/login',
      line: null,
      code: 'Two browser-driven invalid login attempts returned without an obvious challenge or throttling signal',
      description: 'Two limited invalid login attempts were submitted through the rendered authentication route without an obvious throttling, challenge, or retry-delay signal. This is not proof that protection is absent, but it suggests the public authentication flow should be reviewed.',
      suggestion: 'Review rate limiting, lockout behavior, MFA, and bot defenses on the public authentication flow.',
    }));
  }

  if (!lockoutObserved && stableRoute) {
    findings.push(createWebsiteFinding({
      type: 'No Lockout Signal Observed in Limited Validation',
      category: 'configuration',
      severity: 'medium',
      confidence: 'detected',
      exploitability: 'possible',
      file: routeUrl.replace(new URL(routeUrl).origin, '') || '/login',
      line: null,
      code: 'Two browser-driven invalid login attempts did not surface an account lockout message or lockout state',
      description: 'The rendered authentication route did not surface an obvious lockout signal during two limited invalid attempts. This is not proof that account lockout is absent, but it suggests the public login protection controls should be reviewed.',
      suggestion: 'Review account lockout, retry delay, MFA, and user protection controls on the public login flow.',
    }));
  }

  return {
    attempted: true,
    notes,
    findings,
    networkChecksPartial,
  };
}

async function inspectCurrentPage(page: Page): Promise<RouteInspectionData> {
  return page.evaluate(() => {
    const html = document.documentElement?.outerHTML ?? '';
    const bodyText = document.body?.innerText ?? '';
    return {
      url: window.location.href,
      html,
      renderedPasswordFields: document.querySelectorAll('input[type="password"]').length,
      authTextDetected: /(sign in|log in|forgot password|reset password|one-time password|two-factor|mfa|account login|登入|登錄|密碼|帳號)/i.test(bodyText),
    };
  });
}

async function discoverAuthUiByInteraction(page: Page): Promise<{
  signals: string[];
  routeHint: WebsiteModuleResult['authRouteHint'];
  routeLabels: string[];
  attemptedSelectors: number;
}> {
  const signals: string[] = [];
  const routeLabels: string[] = [];
  let attemptedSelectors = 0;

  for (const selector of AUTH_TRIGGER_SELECTORS) {
    const control = page.locator(selector).first();
    if ((await control.count()) === 0) continue;
    attemptedSelectors += 1;

    try {
      await control.click({ timeout: 1500 });
      await page.waitForTimeout(900);
      const routeData = await inspectCurrentPage(page);
      const hit = routeData.renderedPasswordFields > 0 || routeData.authTextDetected;
      if (!hit) continue;

      if (routeData.renderedPasswordFields > 0 && !signals.includes('interactive auth password field')) {
        signals.push('interactive auth password field');
      }
      if (routeData.authTextDetected && !signals.includes('interactive auth text')) {
        signals.push('interactive auth text');
      }

      routeLabels.push(`interactive:${selector}`);
      return {
        signals,
        routeLabels,
        routeHint: {
          url: routeData.url,
          html: routeData.html,
        },
        attemptedSelectors,
      };
    } catch {
      continue;
    }
  }

  return {
    signals,
    routeLabels,
    routeHint: null,
    attemptedSelectors,
  };
}

async function exploreInteractiveCandidates(page: Page): Promise<{
  signals: string[];
  routeLabels: string[];
  routeHint: WebsiteModuleResult['authRouteHint'];
  attemptedInteractions: number;
}> {
  const signals: string[] = [];
  const routeLabels: string[] = [];
  let attemptedInteractions = 0;
  const seenLabels = new Set<string>();

  for (const selector of EXPLORATION_SELECTORS) {
    const controls = await page.locator(selector).elementHandles();
    for (const handle of controls.slice(0, 6)) {
      if (attemptedInteractions >= 8) break;
      try {
        const meta = await handle.evaluate((element: Element) => {
          const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
          const href = element instanceof HTMLAnchorElement ? element.getAttribute('href') ?? '' : '';
          const id = element.getAttribute('id') ?? '';
          const cls = element.getAttribute('class') ?? '';
          const aria = element.getAttribute('aria-label') ?? '';
          return { text, href, id, cls, aria };
        });
        const signature = [meta.text, meta.href, meta.id, meta.cls, meta.aria].join('|');
        if (seenLabels.has(signature)) continue;
        seenLabels.add(signature);

        const interesting = /(login|sign in|log in|account|member|portal|access|enter|student|course|subject|learn|grade|登入|登錄|密碼|帳號)/i.test(signature);
        if (!interesting) continue;

        attemptedInteractions += 1;
        await handle.click({ timeout: 1200 }).catch(() => undefined);
        await page.waitForTimeout(700);
        const routeData = await inspectCurrentPage(page);
        const hit = routeData.renderedPasswordFields > 0 || routeData.authTextDetected;
        if (!hit) continue;

        if (routeData.renderedPasswordFields > 0 && !signals.includes('exploratory interaction password field')) {
          signals.push('exploratory interaction password field');
        }
        if (routeData.authTextDetected && !signals.includes('exploratory interaction auth text')) {
          signals.push('exploratory interaction auth text');
        }
        routeLabels.push(`explore:${meta.text || meta.href || selector}`);
        return {
          signals,
          routeLabels,
          routeHint: {
            url: routeData.url,
            html: routeData.html,
          },
          attemptedInteractions,
        };
      } catch {
        continue;
      }
    }
    if (attemptedInteractions >= 8) break;
  }

  return {
    signals,
    routeLabels,
    routeHint: null,
    attemptedInteractions,
  };
}

export async function runBrowserInspection(fingerprint: WebsiteFingerprint): Promise<WebsiteModuleResult> {
  const notes: string[] = [];
  const findings: UrlVulnerability[] = [];
  const profileSignals: string[] = [];
  let activeValidationPerformed = false;
  let networkChecksPartial = false;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    javaScriptEnabled: true,
  });
  const page = await context.newPage();

  const requestUrls = new Set<string>();

  page.on('requestfinished', request => {
    try {
      const url = request.url();
      if (url.startsWith(fingerprint.origin) && requestUrls.size < 25) {
        requestUrls.add(url);
      }
    } catch {
      return;
    }
  });

  try {
    await page.goto(fingerprint.normalizedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 8000,
    });
    await page.waitForTimeout(1500);

    const data = await page.evaluate(() => {
      const html = document.documentElement?.outerHTML ?? '';
      const renderedPasswordFields = document.querySelectorAll('input[type="password"]').length;
      const bodyText = document.body?.innerText ?? '';
      const internalLinkCount = Array.from(document.querySelectorAll('a[href]'))
        .map(link => (link as HTMLAnchorElement).href)
        .filter(Boolean)
        .filter(href => href.startsWith(window.location.origin) || href.startsWith('/'))
        .length;
      const tableCount = document.querySelectorAll('table').length;
      const repeatedCardLikeBlocks = Array.from(document.querySelectorAll('div, li, article, section'))
        .filter(el => {
          const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
          return text.length >= 20 && text.length <= 220;
        })
        .slice(0, 80)
        .length;

      const runtimeSignals: string[] = [];
      if (renderedPasswordFields > 0) runtimeSignals.push('rendered password field');
      if (/(sign in|log in|forgot password|reset password|one-time password|two-factor|mfa|登入|登錄|密碼|帳號)/i.test(bodyText)) {
        runtimeSignals.push('rendered auth text');
      }
      if ((window as typeof window & { __NEXT_DATA__?: unknown }).__NEXT_DATA__) {
        runtimeSignals.push('runtime next data');
      }
      if (/(grade\s*\d+|course|subject|semester|lecture|student|class number|learning system|online learning)/i.test(bodyText) && internalLinkCount >= 8) {
        runtimeSignals.push('portal content markers');
      }
      if (tableCount >= 3) {
        runtimeSignals.push('table-heavy layout');
      }
      if (repeatedCardLikeBlocks >= 16) {
        runtimeSignals.push('repeated structured blocks');
      }

      const storageItems: Array<{ area: 'localStorage' | 'sessionStorage'; key: string; valuePreview: string }> = [];
      for (const areaName of ['localStorage', 'sessionStorage'] as const) {
        try {
          const storage = window[areaName];
          for (let i = 0; i < storage.length && storageItems.length < 12; i += 1) {
            const key = storage.key(i);
            if (!key) continue;
            const value = storage.getItem(key) ?? '';
            storageItems.push({
              area: areaName,
              key,
              valuePreview: value.slice(0, 80),
            });
          }
        } catch {
          continue;
        }
      }

      const runtimeWindowKeys = Object.keys(window)
        .filter(key => /(auth|token|secret|config|password|credential|session)/i.test(key))
        .slice(0, 12);
      const frameworkHints = [
        /__VIEWSTATE|__EVENTVALIDATION|__doPostBack/i.test(html) ? 'aspnet-webforms' : null,
        /\.aspx\b/i.test(html) ? 'aspx-routes' : null,
        /moodle|blackboard|learning management|online learning/i.test(bodyText) ? 'learning-portal' : null,
        /jquery\s*ui|extjs|dojo|prototype\.js/i.test(html) ? 'legacy-js-framework' : null,
      ].filter(Boolean) as string[];

      return {
        html,
        bodyText,
        renderedPasswordFields,
        runtimeSignals,
        storageItems,
        internalLinkCount,
        runtimeWindowKeys,
        tableCount,
        repeatedCardLikeBlocks,
        frameworkHints,
      };
    });

    let authRouteHint: WebsiteModuleResult['authRouteHint'] = null;
    const authRouteSignals: string[] = [];
    const discoveredAuthRoutes: string[] = [];
    let authValidationTarget: Page | null = null;
    let authValidationTargetUrl: string | null = null;

    const interactiveDiscovery = await discoverAuthUiByInteraction(page);
    for (const signal of interactiveDiscovery.signals) {
      if (!authRouteSignals.includes(signal)) {
        authRouteSignals.push(signal);
      }
    }
    if (interactiveDiscovery.routeHint) {
      authRouteHint = interactiveDiscovery.routeHint;
      discoveredAuthRoutes.push(...interactiveDiscovery.routeLabels);
      authValidationTarget = page;
      authValidationTargetUrl = interactiveDiscovery.routeHint.url;
    }

    if (!interactiveDiscovery.routeHint) {
      const exploratoryDiscovery = await exploreInteractiveCandidates(page);
      for (const signal of exploratoryDiscovery.signals) {
        if (!authRouteSignals.includes(signal)) {
          authRouteSignals.push(signal);
        }
      }
      if (exploratoryDiscovery.routeHint) {
        authRouteHint = exploratoryDiscovery.routeHint;
        discoveredAuthRoutes.push(...exploratoryDiscovery.routeLabels);
        authValidationTarget = page;
        authValidationTargetUrl = exploratoryDiscovery.routeHint.url;
      }
      notes.push(`Browser interaction diagnostics: tried ${interactiveDiscovery.attemptedSelectors} direct auth selectors and ${exploratoryDiscovery.attemptedInteractions} exploratory interactions.`);      
    } else {
      notes.push(`Browser interaction diagnostics: direct auth selector discovery succeeded after ${interactiveDiscovery.attemptedSelectors} selector checks.`);
    }

    for (const route of AUTH_ROUTE_CANDIDATES) {
      if (discoveredAuthRoutes.length >= 2) break;
      const routeUrl = new URL(route, fingerprint.origin).href;
      try {
        const routePage = await context.newPage();
        await routePage.goto(routeUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 5000,
        });
        await routePage.waitForTimeout(800);
        const routeData = await inspectCurrentPage(routePage);

        const hit = routeData.renderedPasswordFields > 0 || routeData.authTextDetected;
        if (!hit) {
          await routePage.close();
          continue;
        }

        discoveredAuthRoutes.push(route);
        if (routeData.renderedPasswordFields > 0 && !authRouteSignals.includes('rendered auth route password field')) {
          authRouteSignals.push('rendered auth route password field');
        }
        if (routeData.authTextDetected && !authRouteSignals.includes('rendered auth route text')) {
          authRouteSignals.push('rendered auth route text');
        }

        if (!authRouteHint || routeData.renderedPasswordFields > 0) {
          authRouteHint = {
            url: routeUrl,
            html: routeData.html,
          };
        }
        if (!authValidationTarget || routeData.renderedPasswordFields > 0) {
          if (authValidationTarget) {
            if (authValidationTarget !== page) {
              await authValidationTarget.close().catch(() => undefined);
            }
          }
          authValidationTarget = routePage;
          authValidationTargetUrl = routeUrl;
          continue;
        }
        await routePage.close();
      } catch {
        continue;
      }
    }
    if (discoveredAuthRoutes.length === 0) {
      notes.push(`Browser route diagnostics: tried ${AUTH_ROUTE_CANDIDATES.length} common auth routes without finding a rendered login surface.`);
    }

    const inspectionData: BrowserInspectionData = {
      ...data,
      requestUrls: Array.from(requestUrls),
    };

    if (inspectionData.renderedPasswordFields > 0) {
      profileSignals.push('rendered password field');
    }
    for (const signal of inspectionData.runtimeSignals) {
      if (!profileSignals.includes(signal)) {
        profileSignals.push(signal);
      }
    }
    for (const hint of inspectionData.frameworkHints) {
      if (!profileSignals.includes(`framework hint:${hint}`)) {
        profileSignals.push(`framework hint:${hint}`);
      }
    }
    if (inspectionData.requestUrls.some(url => /\/(login|signin|sign-in|auth|session|account)\b/i.test(url))) {
      profileSignals.push('runtime auth requests');
    }
    if (inspectionData.requestUrls.some(url => /\/api\/|\/graphql\b|\/rest\/|\/v1\/|\/v2\//i.test(url))) {
      profileSignals.push('runtime api requests');
    }
    for (const signal of authRouteSignals) {
      if (!profileSignals.includes(signal)) {
        profileSignals.push(signal);
      }
    }

    notes.push('Browser-assisted runtime inspection rendered the public application surface using a headless browser without destructive actions.');
    if (profileSignals.length > 0) {
      notes.push(`Browser runtime signals observed: ${profileSignals.join(', ')}.`);
    } else {
      notes.push('Browser-assisted runtime inspection did not surface additional auth or application-state signals beyond the initial passive profile.');
    }
    notes.push(`Runtime diagnostics: ${inspectionData.internalLinkCount} internal links, ${inspectionData.tableCount} tables, ${inspectionData.repeatedCardLikeBlocks} structured content blocks, ${inspectionData.requestUrls.length} same-origin runtime requests observed.`);
    if (discoveredAuthRoutes.length > 0) {
      notes.push(`Browser-assisted route discovery detected auth-oriented routes: ${discoveredAuthRoutes.join(', ')}.`);
    }
    if (inspectionData.frameworkHints.length > 0) {
      notes.push(`Framework/runtime hints observed: ${inspectionData.frameworkHints.join(', ')}.`);
    }

    if (authValidationTarget && authValidationTargetUrl) {
      const authValidation = await attemptBrowserAuthValidation(authValidationTarget, authValidationTargetUrl);
      notes.push(...authValidation.notes);
      findings.push(...authValidation.findings);
      activeValidationPerformed = authValidation.attempted;
      networkChecksPartial = networkChecksPartial || authValidation.networkChecksPartial;
      if (authValidationTarget !== page) {
        await authValidationTarget.close().catch(() => undefined);
      }
    }

    const storageHit = inspectionData.storageItems.find(item => /token|auth|access|refresh|password|secret|key/i.test(item.key));
    if (storageHit) {
      findings.push(buildStorageFinding(storageHit));
    }

    if (inspectionData.runtimeWindowKeys.length > 0) {
      findings.push(buildRuntimeConfigFinding(`Runtime keys: ${inspectionData.runtimeWindowKeys.join(', ')}`));
    }

    const passwordMatch = inspectionData.html.match(/\b(?:storedPassword|savedPassword|defaultPassword|adminPassword|password|passwd|passcode)\b\s*[:=]\s*['"`][^'"`\n]{4,}['"`]/i);
    if (passwordMatch?.[0]) {
      findings.push(buildRuntimePasswordFinding(passwordMatch[0]));
    }

    const cryptoMatch = inspectionData.html.match(/\b(?:secretKey|privateKey|encryptionKey|aesKey|cryptoKey|iv)\b\s*[:=]\s*['"`][^'"`\n]{6,}['"`]/i);
    if (cryptoMatch?.[0]) {
      findings.push(buildRuntimeCryptoFinding(cryptoMatch[0]));
    }

    const portalEvidence = inspectionData.bodyText.match(/(?:grade\s*\d+|course|subject|semester|lecture|student|class number|learning system|online learning)/i)?.[0];
    if (portalEvidence && hasPortalLayoutSignals(inspectionData)) {
      findings.push(buildPortalExposureFinding(`Visible text matched "${portalEvidence}" with ${inspectionData.internalLinkCount} internal links on a public page`));
    }

    return {
      vulnerabilities: findings,
      coverageNotes: notes,
      activeValidationPerformed,
      networkChecksPartial,
      profileSignals,
      profileOverride: determineProfileOverride(fingerprint, inspectionData),
      authRouteHint,
    };
  } catch {
    return {
      vulnerabilities: findings,
      coverageNotes: ['Browser-assisted runtime inspection could not complete within the safety and timeout limits for this run.'],
      activeValidationPerformed: false,
      networkChecksPartial: true,
      profileSignals,
      profileOverride: null,
      authRouteHint: null,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}
