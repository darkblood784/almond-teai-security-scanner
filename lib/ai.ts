import type { VulnerabilityResult } from './scanner/types';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface AIAnalysisResult {
  summary:     string;
  topRisks:    string[];
  remediationPlan: string;
}

/**
 * Use Claude to produce an executive-level security summary.
 * Falls back gracefully if no API key is configured.
 */
export async function aiAnalyze(
  repoName:        string,
  vulnerabilities: VulnerabilityResult[],
  score:           number,
): Promise<AIAnalysisResult | null> {
  if (!ANTHROPIC_API_KEY) return null;

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const v of vulnerabilities) {
    if (v.severity in counts) counts[v.severity as keyof typeof counts]++;
  }

  const topVulns = vulnerabilities
    .filter(v => v.severity === 'critical' || v.severity === 'high')
    .slice(0, 10)
    .map(v => `- [${v.severity.toUpperCase()}] ${v.type} in \`${v.file}\` (line ${v.line ?? '?'}): ${v.description}`)
    .join('\n');

  const prompt = `You are an expert application security engineer. Analyze this security scan report and provide a concise executive summary.

Repository: ${repoName}
Security Score: ${score}/100
Vulnerabilities Found:
- Critical: ${counts.critical}
- High: ${counts.high}
- Medium: ${counts.medium}
- Low: ${counts.low}

Top Issues:
${topVulns || 'None'}

Respond in JSON with this exact shape:
{
  "summary": "<2-3 sentence executive summary>",
  "topRisks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "remediationPlan": "<3-5 sentence prioritized remediation plan>"
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            ANTHROPIC_API_KEY,
        'anthropic-version':    '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-3-5-haiku-20241022',
        max_tokens: 800,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return null;

    const data = await res.json() as { content: Array<{ type: string; text: string }> };
    const text = data.content.find(c => c.type === 'text')?.text ?? '';

    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as AIAnalysisResult;
  } catch {
    return null;
  }
}
