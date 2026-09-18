/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function cn(...inputs: (string | boolean | undefined | null | Record<string, boolean>)[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string') {
      classes.push(input);
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }

  return classes.join(' ').replace(/\s+/g, ' ').trim();
}

export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Just now';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 5) return 'Just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return dateString;
  }
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getStatusColor(status?: string): string {
  if (!status) return 'bg-zinc-800 text-zinc-300';
  const s = status.toLowerCase();
  if (s === 'healthy' || s === 'active' || s === 'approved' || s === 'processed' || s === 'pass') {
    return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  }
  if (s === 'quarantined' || s === 'pending_review' || s === 'warning' || s === 'analyzing' || s === 'detected') {
    return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  }
  if (s === 'destructive' || s === 'failed' || s === 'down' || s === 'unhealthy' || s === 'error' || s === 'rejected' || s === 'fail') {
    return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
  }
  if (s === 'draft' || s === 'inactive' || s === 'onboarding') {
    return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
  }
  return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
}
