const VIEWPORT_MARGIN = 8;
const MAX_NOTICE_WIDTH = 320;
const MIN_NOTICE_WIDTH = 240;
const COUNTER_HEIGHT = 34;
const COMPOSER_GAP = 4;
const TOAST_GAP = 6;
const ESTIMATED_TOAST_HEIGHT = 104;
const NOTICE_STACK_HEIGHT =
  COUNTER_HEIGHT + COMPOSER_GAP + TOAST_GAP + ESTIMATED_TOAST_HEIGHT;

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
  toastBelow: boolean;
  toastMaxHeight: number;
  compact: boolean;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

export const calculateNoticePosition = (
  composer: ComposerRect,
  viewportWidth: number,
  viewportHeight: number,
): NoticePosition => {
  const availableWidth = Math.max(0, viewportWidth - VIEWPORT_MARGIN * 2);
  const width = Math.min(
    MAX_NOTICE_WIDTH,
    availableWidth,
    Math.max(MIN_NOTICE_WIDTH, Math.max(0, composer.width)),
  );
  const maximumLeft = Math.max(
    VIEWPORT_MARGIN,
    viewportWidth - width - VIEWPORT_MARGIN,
  );
  const left = clamp(
    composer.right - width,
    VIEWPORT_MARGIN,
    maximumLeft,
  );
  const spaceAbove = Math.max(0, composer.top - VIEWPORT_MARGIN);
  const spaceBelow = Math.max(
    0,
    viewportHeight - composer.bottom - VIEWPORT_MARGIN,
  );
  const placeAbove =
    spaceAbove >= NOTICE_STACK_HEIGHT ||
    (spaceBelow < NOTICE_STACK_HEIGHT && spaceAbove >= spaceBelow);
  const maximumTop = Math.max(
    VIEWPORT_MARGIN,
    viewportHeight - COUNTER_HEIGHT - VIEWPORT_MARGIN,
  );
  const desiredTop = placeAbove
    ? composer.top - COUNTER_HEIGHT - COMPOSER_GAP
    : composer.bottom + COMPOSER_GAP;

  const top = clamp(desiredTop, VIEWPORT_MARGIN, maximumTop);
  const toastRoomAbove = Math.max(
    0,
    top - TOAST_GAP - VIEWPORT_MARGIN,
  );
  const toastRoomBelow = Math.max(
    0,
    viewportHeight - top - COUNTER_HEIGHT - TOAST_GAP - VIEWPORT_MARGIN,
  );
  const preferredToastBelow = !placeAbove;
  const preferredToastRoom = preferredToastBelow
    ? toastRoomBelow
    : toastRoomAbove;
  const alternativeToastRoom = preferredToastBelow
    ? toastRoomAbove
    : toastRoomBelow;
  const toastBelow =
    preferredToastRoom < ESTIMATED_TOAST_HEIGHT &&
    alternativeToastRoom > preferredToastRoom
      ? !preferredToastBelow
      : preferredToastBelow;

  return {
    left,
    top,
    width,
    toastBelow,
    toastMaxHeight: toastBelow ? toastRoomBelow : toastRoomAbove,
    compact: width < 280,
  };
};
