import { describe, expect, it } from "vitest";
import { calculateNoticePosition } from "../src/providers/chatgpt/notice-position";

describe("background notice position", () => {
  it("aligns a full-width notice above the composer on a large viewport", () => {
    expect(
      calculateNoticePosition(
        { top: 700, right: 1_100, bottom: 770, width: 760 },
        1_440,
        900,
      ),
    ).toEqual({
      left: 780,
      top: 662,
      width: 320,
      toastBelow: false,
      toastMaxHeight: 648,
      compact: false,
    });
  });

  it("moves below a composer near the top of a narrow viewport", () => {
    expect(
      calculateNoticePosition(
        { top: 20, right: 272, bottom: 90, width: 264 },
        280,
        500,
      ),
    ).toEqual({
      left: 8,
      top: 94,
      width: 264,
      toastBelow: true,
      toastMaxHeight: 358,
      compact: true,
    });
  });

  it("keeps the notice inside a very small viewport", () => {
    expect(
      calculateNoticePosition(
        { top: 40, right: 190, bottom: 110, width: 180 },
        200,
        140,
      ),
    ).toEqual({
      left: 8,
      top: 8,
      width: 184,
      toastBelow: true,
      toastMaxHeight: 84,
      compact: true,
    });
  });
});
