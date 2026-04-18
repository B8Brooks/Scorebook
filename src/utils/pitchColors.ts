const PITCH_COLORS: Record<string, { bg: string; ring: string }> = {
  FF: { bg: 'bg-red-600', ring: 'ring-red-600' },
  FT: { bg: 'bg-red-500', ring: 'ring-red-500' },
  FA: { bg: 'bg-red-500', ring: 'ring-red-500' },
  SI: { bg: 'bg-orange-500', ring: 'ring-orange-500' },
  FC: { bg: 'bg-rose-500', ring: 'ring-rose-500' },
  SL: { bg: 'bg-blue-600', ring: 'ring-blue-600' },
  ST: { bg: 'bg-blue-500', ring: 'ring-blue-500' },
  SV: { bg: 'bg-indigo-500', ring: 'ring-indigo-500' },
  CU: { bg: 'bg-sky-600', ring: 'ring-sky-600' },
  KC: { bg: 'bg-sky-500', ring: 'ring-sky-500' },
  CS: { bg: 'bg-sky-700', ring: 'ring-sky-700' },
  EP: { bg: 'bg-indigo-400', ring: 'ring-indigo-400' },
  CH: { bg: 'bg-emerald-600', ring: 'ring-emerald-600' },
  FS: { bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
  FO: { bg: 'bg-teal-500', ring: 'ring-teal-500' },
  KN: { bg: 'bg-purple-500', ring: 'ring-purple-500' },
};

const DEFAULT_COLOR = { bg: 'bg-gray-400', ring: 'ring-gray-400' };

export function pitchColor(code: string): { bg: string; ring: string } {
  return PITCH_COLORS[code] ?? DEFAULT_COLOR;
}
