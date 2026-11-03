import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ProblemCategory, SessionStatus, RiskLevel, FeedbackType } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z')).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return dateStr;
  }
}

export function parseSafe<T>(json: string | undefined | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export const CATEGORY_LABELS: Record<ProblemCategory, string> = {
  software: 'Software',
  hardware: 'Hardware',
  network: 'Network',
  mobile: 'Mobile App',
  deployment: 'Deployment',
  education: 'Education',
  other: 'Other',
};

export const CATEGORY_COLORS: Record<ProblemCategory, string> = {
  software: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  hardware: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  network: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  mobile: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  deployment: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  education: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  other: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

export const STATUS_COLORS: Record<SessionStatus, string> = {
  active: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  resolved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  escalated: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  draft: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  abandoned: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'text-emerald-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
};

export const FEEDBACK_COLORS: Record<string, string> = {
  worked: 'text-emerald-400',
  failed: 'text-red-400',
  partial: 'text-amber-400',
  skipped: 'text-slate-400',
};

export function confidenceColor(c: number): string {
  if (c >= 0.8) return 'text-emerald-400';
  if (c >= 0.6) return 'text-amber-400';
  return 'text-red-400';
}

