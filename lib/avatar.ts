/** Deterministic institution avatar colour + initials, shared by the year
 * calendar and institution pages so the same institution always gets the
 * same colour. */

const AVATAR_PALETTE = [
  '#7c3aed', '#0f766e', '#d97706', '#dc2626', '#2563eb',
  '#0891b2', '#65a30d', '#c026d3', '#0e7490', '#be185d',
];

export function avatarColour(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

export function initials(name: string): string {
  const words = name.split(/\s+/).filter(w => w.length > 2 && /[A-Z]/.test(w[0]));
  if (words.length >= 2) return words[0][0] + words[1][0];
  return name.slice(0, 2).toUpperCase();
}
