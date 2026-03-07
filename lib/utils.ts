import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: '優秀',   color: '#10b981' };
  if (score >= 70) return { label: '良好',   color: '#14b8a6' };
  if (score >= 50) return { label: '普通',   color: '#eab308' };
  if (score >= 30) return { label: '較差',   color: '#f97316' };
  return              { label: '危險',   color: '#ef4444' };
}

export function scoreRingColor(score: number): string {
  if (score >= 90) return '#16a34a'; // green-600
  if (score >= 70) return '#2563eb'; // blue-600
  if (score >= 50) return '#ca8a04'; // yellow-600
  if (score >= 30) return '#ea580c'; // orange-600
  return '#dc2626';                  // red-600
}

export function severityColor(severity: string) {
  switch (severity.toLowerCase()) {
    case 'critical': return { bg: 'bg-red-950',    text: 'text-red-400',    border: 'border-red-800'    };
    case 'high':     return { bg: 'bg-orange-950', text: 'text-orange-400', border: 'border-orange-800' };
    case 'medium':   return { bg: 'bg-yellow-950', text: 'text-yellow-400', border: 'border-yellow-800' };
    case 'low':      return { bg: 'bg-blue-950',   text: 'text-blue-400',   border: 'border-blue-800'   };
    default:         return { bg: 'bg-slate-800',  text: 'text-slate-400',  border: 'border-slate-700'  };
  }
}

export function formatDate(date: string | Date, lang: 'en' | 'zh' = 'zh') {
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-TW' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '');
    const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}
