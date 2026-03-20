import { getPlanEntitlements } from '@/lib/entitlements';
import type { Fixability } from '@/lib/fixability';
import type { Vulnerability } from '@prisma/client';
import { isSimpleFixableType } from '@/lib/fixability';

export interface GenerateFixInput {
  plan: string;
  vulnerability: Pick<Vulnerability, 'id' | 'type' | 'category' | 'severity' | 'description' | 'suggestion' | 'code' | 'file' | 'line' | 'fixability'>;
}

export interface GeneratedFix {
  patchCode: string;
  description: string;
  rationale: string;
  confidence: number;
  provider: string;
  model: string;
}

interface ProviderAttempt {
  provider: 'google' | 'groq' | 'nvidia' | 'anthropic';
  model: string;
}

const FIX_TIMEOUT_MS = Number(process.env.FIX_TIMEOUT_MS ?? 9000);
const FIX_MAX_RETRIES = Number(process.env.FIX_MAX_RETRIES ?? 1);

function isComplex(findingType: string): boolean {
  return !isSimpleFixableType(findingType);
}

function providerChain(plan: string, findingType: string): ProviderAttempt[] {
  const complex = isComplex(findingType);

  if (plan === 'pro') {
    if (complex && process.env.ANTHROPIC_API_KEY) {
      return [
        { provider: 'anthropic', model: process.env.MODEL_COMPLEX_PAID ?? 'claude-3-5-haiku-20241022' },
        { provider: 'groq', model: process.env.MODEL_COMPLEX_FREE ?? 'qwen/qwen3-32b' },
        { provider: 'google', model: process.env.MODEL_SIMPLE_FREE ?? 'gemma-3-27b-it' },
        { provider: 'nvidia', model: process.env.MODEL_SIMPLE_NVIDIA_FREE ?? 'mamba-codestral-7b-v0.1' },
      ];
    }

    return [
      { provider: 'google', model: process.env.MODEL_SIMPLE_FREE ?? 'gemma-3-27b-it' },
      { provider: 'groq', model: process.env.MODEL_COMPLEX_FREE ?? 'qwen/qwen3-32b' },
      { provider: 'nvidia', model: process.env.MODEL_SIMPLE_NVIDIA_FREE ?? 'mamba-codestral-7b-v0.1' },
    ];
  }

  if (complex) {
    return [
      { provider: 'groq', model: process.env.MODEL_COMPLEX_FREE ?? 'qwen/qwen3-32b' },
      { provider: 'google', model: process.env.MODEL_SIMPLE_FREE ?? 'gemma-3-27b-it' },
      { provider: 'nvidia', model: process.env.MODEL_SIMPLE_NVIDIA_FREE ?? 'mamba-codestral-7b-v0.1' },
    ];
  }

  return [
    { provider: 'google', model: process.env.MODEL_SIMPLE_FREE ?? 'gemma-3-27b-it' },
    { provider: 'groq', model: process.env.MODEL_COMPLEX_FREE ?? 'qwen/qwen3-32b' },
    { provider: 'nvidia', model: process.env.MODEL_SIMPLE_NVIDIA_FREE ?? 'mamba-codestral-7b-v0.1' },
  ];
}

function buildPrompt(vulnerability: GenerateFixInput['vulnerability']) {
  return [
    'You are a secure coding assistant. Generate a focused remediation patch.',
    `Finding Type: ${vulnerability.type}`,
    `Category: ${vulnerability.category}`,
    `Severity: ${vulnerability.severity}`,
    `Description: ${vulnerability.description}`,
    `Suggested Guidance: ${vulnerability.suggestion}`,
    `File: ${vulnerability.file}${vulnerability.line ? `:${vulnerability.line}` : ''}`,
    'Vulnerable Code Snippet:',
    vulnerability.code ?? '(snippet unavailable; use finding context)',
    'Return strict JSON only with shape:',
    '{"patchCode":"...","description":"...","rationale":"...","confidence":80}',
    'patchCode should be concise and safe. If uncertain, provide a conservative patch with TODO markers.',
  ].join('\n');
}

function parseResult(text: string): Omit<GeneratedFix, 'provider' | 'model'> | null {
  const jsonBlock = text.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonBlock) return null;

  try {
    const parsed = JSON.parse(jsonBlock) as {
      patchCode?: unknown;
      description?: unknown;
      rationale?: unknown;
      confidence?: unknown;
    };

    if (typeof parsed.patchCode !== 'string' || typeof parsed.description !== 'string') {
      return null;
    }

    return {
      patchCode: parsed.patchCode,
      description: parsed.description,
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : 'Generated remediation guidance from model output.',
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.confidence))) : 60,
    };
  } catch {
    return null;
  }
}

async function callWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FIX_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callGoogle(model: string, prompt: string): Promise<string | null> {
  const key = process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await callWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 900,
      },
    }),
  });

  if (!res.ok) return null;
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function callOpenAiCompatible(baseUrl: string, apiKey: string, model: string, prompt: string): Promise<string | null> {
  const res = await callWithTimeout(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content ?? null;
}

async function callGroq(model: string, prompt: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return callOpenAiCompatible('https://api.groq.com/openai/v1', key, model, prompt);
}

async function callNvidia(model: string, prompt: string): Promise<string | null> {
  const key = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY;
  if (!key) return null;
  const base = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  return callOpenAiCompatible(base, key, model, prompt);
}

async function callAnthropic(model: string, prompt: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const res = await callWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json() as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return data.content?.find(part => part.type === 'text')?.text ?? null;
}

function templateFallback(vulnerability: GenerateFixInput['vulnerability']): GeneratedFix {
  const patch = vulnerability.code
    ? `--- suggested\n+++ suggested\n- ${vulnerability.code}\n+ ${vulnerability.code} // TODO: apply secure remediation based on guidance`
    : '--- suggested\n+++ suggested\n+ // TODO: apply secure remediation based on finding guidance';

  return {
    patchCode: patch,
    description: `Template guidance for ${vulnerability.type}`,
    rationale: 'No provider returned a valid patch. Returning deterministic fallback guidance.',
    confidence: 35,
    provider: 'template',
    model: 'deterministic-fallback',
  };
}

async function attemptProvider(attempt: ProviderAttempt, prompt: string): Promise<Omit<GeneratedFix, 'provider' | 'model'> | null> {
  let text: string | null = null;

  if (attempt.provider === 'google') text = await callGoogle(attempt.model, prompt);
  if (attempt.provider === 'groq') text = await callGroq(attempt.model, prompt);
  if (attempt.provider === 'nvidia') text = await callNvidia(attempt.model, prompt);
  if (attempt.provider === 'anthropic') text = await callAnthropic(attempt.model, prompt);

  if (!text) return null;
  return parseResult(text);
}

export function canGenerateFix(
  plan: string,
  fixability: Fixability,
  options?: { allowFreeFixes?: boolean },
): { allowed: boolean; reason?: string } {
  const entitlements = getPlanEntitlements(plan);
  const allowFreeFixes = options?.allowFreeFixes === true;
  if (!entitlements.fixSuggestions && !(allowFreeFixes && plan !== 'pro')) {
    return { allowed: false, reason: 'Fix suggestions are disabled for this plan.' };
  }

  if (fixability === 'manual-only') {
    return { allowed: false, reason: 'This finding requires manual remediation and is not safe for auto-generated patches.' };
  }

  if (plan !== 'pro' && (fixability === 'review-required' || fixability === 'auto-fix-risky')) {
    return { allowed: false, reason: 'Complex fixes are available for Pro users. Free plan supports simple fix generation only.' };
  }

  return { allowed: true };
}

export async function generateFix(input: GenerateFixInput): Promise<GeneratedFix> {
  const prompt = buildPrompt(input.vulnerability);
  const chain = providerChain(input.plan, input.vulnerability.type);

  for (const attempt of chain) {
    for (let tryIndex = 0; tryIndex <= FIX_MAX_RETRIES; tryIndex++) {
      const parsed = await attemptProvider(attempt, prompt);
      if (parsed) {
        return {
          ...parsed,
          provider: attempt.provider,
          model: attempt.model,
        };
      }
    }
  }

  return templateFallback(input.vulnerability);
}
