// Reliever availability relative to the scouted game date, computed from
// FanGraphs' recent-appearance log (dates + pitch counts).

export interface AvailabilityBadge {
  label: string;
  tone: 'red' | 'amber' | 'green' | 'gray';
}

function daysBefore(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function shortDate(dateIso: string): string {
  return new Date(`${dateIso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function availabilityFor(
  scoutDate: string,
  recent?: Array<{ date: string; pitches?: number }>
): AvailabilityBadge | null {
  if (!recent || recent.length === 0) return null;

  const yesterday = daysBefore(scoutDate, 1);
  const twoDaysAgo = daysBefore(scoutDate, 2);
  const dates = new Set(recent.map(r => r.date));

  if (dates.has(yesterday) && dates.has(twoDaysAgo)) {
    return { label: '2 straight days', tone: 'red' };
  }
  if (dates.has(yesterday)) {
    const y = recent.find(r => r.date === yesterday);
    return {
      label: y?.pitches != null ? `pitched yest (${y.pitches} p)` : 'pitched yesterday',
      tone: 'amber',
    };
  }

  // Most recent appearance strictly before the scouted date.
  const last = recent
    .map(r => r.date)
    .filter(d => d < scoutDate)
    .sort()
    .pop();
  if (!last) return null;
  if (last <= daysBefore(scoutDate, 3)) {
    return { label: 'fresh', tone: 'green' };
  }
  return { label: `last: ${shortDate(last)}`, tone: 'gray' };
}

export function availabilityToneClasses(tone: AvailabilityBadge['tone']): string {
  switch (tone) {
    case 'red':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'amber':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'green':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}
