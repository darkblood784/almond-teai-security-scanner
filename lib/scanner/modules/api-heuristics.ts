import type { WebsiteFingerprint, WebsiteModuleResult } from '../types';
import { createWebsiteFinding, probeStatus } from '../url-scanner';

export async function runApiHeuristics(fingerprint: WebsiteFingerprint): Promise<WebsiteModuleResult> {
  const notes: string[] = [];
  const findings: WebsiteModuleResult['vulnerabilities'] = [];

  if (!fingerprint.hasApiMarkers) {
    return {
      vulnerabilities: findings,
      coverageNotes: notes,
      activeValidationPerformed: false,
      networkChecksPartial: false,
    };
  }

  notes.push('API-focused surface heuristics ran because API markers were detected on the target.');

  const origin = new URL(fingerprint.normalizedUrl).origin;
  const [graphqlStatus, swaggerJsonStatus, openApiStatus, apiDocsStatus, swaggerUiStatus] = await Promise.all([
    probeStatus(`${origin}/graphql`),
    probeStatus(`${origin}/swagger.json`),
    probeStatus(`${origin}/openapi.json`),
    probeStatus(`${origin}/api-docs`),
    probeStatus(`${origin}/swagger`),
  ]);

  if (/application\/json/i.test(fingerprint.pageContentType)) {
    findings.push(createWebsiteFinding({
      type: 'Public API Entry Point Detected',
      category: 'exposure',
      severity: 'low',
      confidence: 'likely',
      exploitability: 'none',
      file: '/',
      line: null,
      code: `Content-Type: ${fingerprint.pageContentType}`,
      description: 'The initial public application surface responded like an API entry point. Review whether this public API surface is intentional and protected appropriately.',
      suggestion: 'Confirm public API routes are expected, documented, authenticated where required, and monitored for misuse.',
    }));
  }

  if (graphqlStatus != null && [200, 400, 405].includes(graphqlStatus)) {
    findings.push(createWebsiteFinding({
      type: 'Public GraphQL Endpoint Signal',
      category: 'exposure',
      severity: 'medium',
      confidence: 'detected',
      exploitability: 'possible',
      file: '/graphql',
      line: null,
      code: `GET /graphql returned status ${graphqlStatus}`,
      description: 'The target exposed a public GraphQL endpoint signal. Public GraphQL surfaces should be reviewed for authentication, schema exposure, and unnecessary introspection.',
      suggestion: 'Review GraphQL authentication, schema exposure, and rate limiting, and disable unnecessary introspection in production where appropriate.',
    }));
    notes.push(`API probe observed a GraphQL surface at /graphql (status ${graphqlStatus}).`);
  }

  const openApiStatusValue = swaggerJsonStatus === 200 ? swaggerJsonStatus : openApiStatus;
  const openApiPath = swaggerJsonStatus === 200 ? '/swagger.json' : openApiStatus === 200 ? '/openapi.json' : null;
  if (openApiPath && openApiStatusValue === 200) {
    findings.push(createWebsiteFinding({
      type: 'Public API Schema Exposed',
      category: 'exposure',
      severity: 'medium',
      confidence: 'verified',
      exploitability: 'possible',
      file: openApiPath,
      line: null,
      code: `${openApiPath} returned status 200`,
      description: 'A public API schema document was exposed. Public OpenAPI or Swagger schemas can materially improve attacker understanding of the application surface.',
      suggestion: 'Restrict public API schema exposure where not required, and ensure documented endpoints are authenticated and monitored appropriately.',
    }));
    notes.push(`API probe observed a public schema document at ${openApiPath}.`);
  }

  const docsStatusValue = apiDocsStatus === 200 ? apiDocsStatus : swaggerUiStatus;
  const docsPath = apiDocsStatus === 200 ? '/api-docs' : swaggerUiStatus === 200 ? '/swagger' : null;
  if (docsPath && docsStatusValue === 200) {
    findings.push(createWebsiteFinding({
      type: 'Public API Documentation Exposed',
      category: 'exposure',
      severity: 'low',
      confidence: 'verified',
      exploitability: 'possible',
      file: docsPath,
      line: null,
      code: `${docsPath} returned status 200`,
      description: 'Public API documentation was exposed. This may be intentional, but it increases application surface visibility and should be reviewed carefully.',
      suggestion: 'Review whether public API documentation exposure is necessary and ensure all documented endpoints are appropriately authenticated.',
    }));
    notes.push(`API probe observed public documentation at ${docsPath}.`);
  }

  return {
    vulnerabilities: findings,
    coverageNotes: notes,
    activeValidationPerformed: false,
    networkChecksPartial: false,
  };
}
