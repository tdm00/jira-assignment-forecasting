import type { StaffMember } from '../core/types';

const PALETTE = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#84cc16',
  '#e11d48',
  '#06b6d4',
  '#a855f7',
];

export const UNKNOWN_COLOR = '#94a3b8';

export function staffColor(staff: StaffMember[], staffId: string | null): string {
  if (!staffId) return UNKNOWN_COLOR;
  const idx = staff.findIndex((s) => s.id === staffId);
  return idx < 0 ? UNKNOWN_COLOR : PALETTE[idx % PALETTE.length]!;
}
