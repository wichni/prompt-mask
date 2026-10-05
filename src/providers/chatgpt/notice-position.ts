const VIEWPORT_MARGIN = 8;
const MAX_NOTICE_WIDTH = 640;
const MIN_NOTICE_WIDTH = 184;
const COMPOSER_GAP = 6;

interface ComposerRect {
  top: number;
  right: number;
  bottom: number;
  width: number;
}

export interface NoticePosition {
  left: number;
  top: number;
  width: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

export const calculateNoticePosition = (
  composer: ComposerRect,
  viewportWidth: number,
  viewportHeight: number,
  controlsHeight: number,
): NoticePosition => {
  const width = Math.min(
    MAX_NOTICE_WIDTH,
    Math.max(0, viewportWidth - VIEWPORT_MARGIN * 2),
    Math.max(MIN_NOTICE_WIDTH, composer.width),
  );
  const left = clamp(
    composer.right - width,
    VIEWPORT_MARGIN,
    Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN),
  );
  const spaceAbove = composer.top - VIEWPORT_MARGIN;
  const spaceBelow = viewportHeight - composer.bottom - VIEWPORT_MARGIN;
  const placeBelow =
    spaceBelow >= controlsHeight + COMPOSER_GAP || spaceBelow >= spaceAbove;
  const desiredTop = placeBelow
    ? composer.bottom + COMPOSER_GAP
    : composer.top - controlsHeight - COMPOSER_GAP;
  const top = clamp(
    desiredTop,
    VIEWPORT_MARGIN,
    Math.max(VIEWPORT_MARGIN, viewportHeight - controlsHeight - VIEWPORT_MARGIN),
  );

  return { left, top, width };
};
