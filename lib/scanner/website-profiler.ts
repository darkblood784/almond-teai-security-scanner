import type { WebsiteFingerprint, WebsiteProfile } from './types';
import { getHeader, normalizePublicUrl, probeStatus, safeFetch } from './url-scanner';

function extractSameOriginScriptUrls(baseUrl: string, body: string): string[] {
  const urls = new Set<string>();
  const base = new URL(baseUrl);
  const matches = body.matchAll(/<script[^>]+src=["']([^"'#]+)["']/gi);

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
    if (urls.size >= 4) break;
  }

  return Array.from(urls);
}

async function collectRuntimeSignals(normalizedUrl: string, body: string): Promise<string> {
  const parts = [body];
  const scriptUrls = extractSameOriginScriptUrls(normalizedUrl, body);

  for (const scriptUrl of scriptUrls) {
    const response = await safeFetch(scriptUrl, 5000, {
      method: 'GET',
      includeBody: true,
      maxBytes: 32768,
    });
    if (response?.body) {
      parts.push(response.body);
    }
  }

  return parts.join('\n');
}

function hasLoginForm(body: string): boolean {
  return /<form[\s\S]{0,400}?<input[\s\S]{0,400}?type=["']password["']/i.test(body);
}

function hasPasswordField(body: string): boolean {
  return /<input[^>]+type=["']password["']/i.test(body);
}

function hasSpaMarkers(body: string): boolean {
  return /__NEXT_DATA__|\/_next\/|data-reactroot|id=["']root["']|id=["']app["']|window\.__INITIAL_STATE__|webpack|vite|nuxt|pinia|redux/i.test(body);
}

function hasApiMarkers(body: string, contentType: string, probeSignals: Record<string, number | null>): boolean {
  if (/application\/json/i.test(contentType)) return true;
  if (/swagger|openapi|graphql|api-docs|redoc|fetch\(|axios\.|\/api\/|application\/json/i.test(body)) return true;
  return (
    (probeSignals.graphql != null && [200, 400, 405].includes(probeSignals.graphql)) ||
    (probeSignals.swaggerJson != null && probeSignals.swaggerJson === 200) ||
    (probeSignals.apiDocs != null && probeSignals.apiDocs === 200)
  );
}

function hasCmsMarkers(body: string, probeSignals: Record<string, number | null>): boolean {
  if (/wp-content|wp-includes|wordpress|wp-json|woocommerce|drupal|joomla|shopify/i.test(body)) return true;
  return probeSignals.wpLogin === 200;
}

function hasRuntimeAuthMarkers(body: string): boolean {
  return /password|passwd|passcode|sign[_\-\s]?in|log[_\-\s]?in|authenticate|forgot[_\-\s]?password|reset[_\-\s]?password|otp|mfa|twofactor|two-factor|authToken|accessToken/i.test(body);
}

function hasFrontendRouteMarkers(body: string): boolean {
  return /["'`](?:\/login|\/signin|\/sign-in|\/auth|\/account|\/dashboard|\/forgot-password|\/reset-password)["'`]/i.test(body);
}

function probableAuthSurface(
  body: string,
  probeSignals: Record<string, number | null>,
  loginForm: boolean,
  passwordField: boolean,
): boolean {
  if (loginForm || passwordField) return true;
  if (/(sign in|log in|member login|account login|forgot password)/i.test(body)) return true;
  if (hasRuntimeAuthMarkers(body) || hasFrontendRouteMarkers(body)) return true;
  return (probeSignals.login === 200) || (probeSignals.adminLogin === 200) || (probeSignals.admin === 200);
}

function chooseProfile(input: {
  authSurface: boolean;
  spa: boolean;
  api: boolean;
  cms: boolean;
}): WebsiteProfile {
  if (input.cms) return 'cms-exposure';
  if (input.api) return 'api-surface';
  if (input.authSurface || input.spa) return 'webapp-light';
  return 'surface';
}

function toTitleCaseProfile(profile: WebsiteProfile): string {
  switch (profile) {
    case 'webapp-light':
      return 'Web App Light';
    case 'api-surface':
      return 'API Surface';
    case 'cms-exposure':
      return 'CMS Exposure';
    default:
      return 'Surface';
  }
}

export function websiteProfileLabel(profile: WebsiteProfile): string {
  return toTitleCaseProfile(profile);
}

export async function profileWebsite(rawUrl: string): Promise<WebsiteFingerprint> {
  const normalizedUrl = normalizePublicUrl(rawUrl);
  const mainResponse = await safeFetch(normalizedUrl, 6000, {
    method: 'GET',
    includeBody: true,
    maxBytes: 32768,
  });

  if (!mainResponse) {
    throw new Error('Could not reach the website. Check the URL and try again.');
  }

  const pageBody = mainResponse.body ?? '';
  const runtimeSurface = await collectRuntimeSignals(normalizedUrl, pageBody);
  const pageContentType = getHeader(mainResponse.headers, 'content-type') ?? '';
  const origin = new URL(normalizedUrl).origin;
  const hostname = new URL(normalizedUrl).hostname;

  const [login, adminLogin, admin, graphql, swaggerJson, apiDocs, wpLogin] = await Promise.all([
    probeStatus(`${origin}/login`),
    probeStatus(`${origin}/admin/login`),
    probeStatus(`${origin}/admin`),
    probeStatus(`${origin}/graphql`),
    probeStatus(`${origin}/swagger.json`),
    probeStatus(`${origin}/api-docs`),
    probeStatus(`${origin}/wp-login.php`),
  ]);

  const probeSignals = {
    login,
    adminLogin,
    admin,
    graphql,
    swaggerJson,
    apiDocs,
    wpLogin,
  };

  const loginFormDetected = hasLoginForm(runtimeSurface);
  const passwordFieldDetected = hasPasswordField(runtimeSurface);
  const spaDetected = hasSpaMarkers(runtimeSurface);
  const apiDetected = hasApiMarkers(runtimeSurface, pageContentType, probeSignals);
  const cmsDetected = hasCmsMarkers(runtimeSurface, probeSignals);
  const authSurfaceDetected = probableAuthSurface(runtimeSurface, probeSignals, loginFormDetected, passwordFieldDetected);
  const profile = chooseProfile({
    authSurface: authSurfaceDetected,
    spa: spaDetected,
    api: apiDetected,
    cms: cmsDetected,
  });

  const signals: string[] = [];
  if (loginFormDetected) signals.push('login form');
  if (passwordFieldDetected) signals.push('password field');
  if (spaDetected) signals.push('SPA markers');
  if (apiDetected) signals.push('API markers');
  if (cmsDetected) signals.push('CMS markers');
  if (hasRuntimeAuthMarkers(runtimeSurface)) signals.push('runtime auth markers');
  if (hasFrontendRouteMarkers(runtimeSurface)) signals.push('frontend route markers');
  if (authSurfaceDetected && !signals.includes('login form') && !signals.includes('password field')) {
    signals.push('auth surface hints');
  }

  return {
    normalizedUrl,
    origin,
    hostname,
    profile,
    signals,
    hasLoginForm: loginFormDetected,
    hasPasswordField: passwordFieldDetected,
    hasSpaMarkers: spaDetected,
    hasApiMarkers: apiDetected,
    hasCmsMarkers: cmsDetected,
    probableAuthSurface: authSurfaceDetected,
    pageContentType,
    pageBody,
  };
}
