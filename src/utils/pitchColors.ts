const PITCH_COLORS: Record<string, { bg: string; fill: string }> = {
  FF: { bg: 'bg-red-600', fill: '#dc2626' },
  FT: { bg: 'bg-red-500', fill: '#ef4444' },
  FA: { bg: 'bg-red-500', fill: '#ef4444' },
  SI: { bg: 'bg-orange-500', fill: '#f97316' },
  FC: { bg: 'bg-rose-500', fill: '#f43f5e' },
  SL: { bg: 'bg-blue-600', fill: '#2563eb' },
  ST: { bg: 'bg-blue-500', fill: '#3b82f6' },
  SV: { bg: 'bg-indigo-500', fill: '#6366f1' },
  CU: { bg: 'bg-sky-600', fill: '#0284c7' },
  KC: { bg: 'bg-sky-500', fill: '#0ea5e9' },
  CS: { bg: 'bg-sky-700', fill: '#0369a1' },
  EP: { bg: 'bg-indigo-400', fill: '#818cf8' },
  CH: { bg: 'bg-emerald-600', fill: '#059669' },
  FS: { bg: 'bg-emerald-500', fill: '#10b981' },
  FO: { bg: 'bg-teal-500', fill: '#14b8a6' },
  KN: { bg: 'bg-purple-500', fill: '#a855f7' },
};

const DEFAULT_COLOR = { bg: 'bg-gray-400', fill: '#9ca3af' };

export function pitchColor(code: string): { bg: string; fill: string } {
  return PITCH_COLORS[code] ?? DEFAULT_COLOR;
}
