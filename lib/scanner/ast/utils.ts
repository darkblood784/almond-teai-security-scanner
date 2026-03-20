export function getLineSnippet(source: string, line: number | null): string | null {
  if (!line || line < 1) return null;
  const lines = source.split('\n');
  return lines[line - 1]?.trim().slice(0, 200) ?? null;
}

export function looksLikeHardcodedSecret(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length < 8) return false;
  if (/^(test|example|sample|changeme|dummy|placeholder)$/i.test(normalized)) return false;
  return true;
}
