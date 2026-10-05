const WIDTH = 48;
const HEIGHT = 34;
const MARGIN = 8;
const GAP = 6;

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ShortcutPosition {
  left: number;
  top: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const intersects = (left: number, top: number, avoid: Rect): boolean =>
  left < avoid.right + GAP &&
  left + WIDTH + GAP > avoid.left &&
  top < avoid.bottom + GAP &&
  top + HEIGHT + GAP > avoid.top;

export const calculateShortcutPosition = (
  composer: Rect,
  avoid: Rect | null,
  viewportWidth: number,
  viewportHeight: number,
): ShortcutPosition => {
  const right = composer.right - WIDTH;
  const left = composer.left;
  const above = composer.top - HEIGHT - MARGIN;
  const below = composer.bottom + MARGIN;
  const candidates = [
    { left: right, top: above },
    { left, top: above },
    { left: right, top: below },
    { left, top: below },
  ];
  const fits = (position: ShortcutPosition): boolean =>
    position.left >= MARGIN &&
    position.left + WIDTH <= viewportWidth - MARGIN &&
    position.top >= MARGIN &&
    position.top + HEIGHT <= viewportHeight - MARGIN;
  const clear = candidates.find(
    (position) => fits(position) && (!avoid || !intersects(position.left, position.top, avoid)),
  );
  if (clear) return clear;
  const fallback = candidates.find((position) => fits(position)) ?? candidates[0]!;
  return {
    left: clamp(fallback.left, MARGIN, Math.max(MARGIN, viewportWidth - WIDTH - MARGIN)),
    top: clamp(fallback.top, MARGIN, Math.max(MARGIN, viewportHeight - HEIGHT - MARGIN)),
  };
};
