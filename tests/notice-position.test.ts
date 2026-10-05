import { describe, expect, it } from "vitest";
import { calculateNoticePosition } from "../src/providers/chatgpt/notice-position";

describe("page controls position", () => {
  it("aligns a one-row bar below the composer when space is available", () => {
    expect(
      calculateNoticePosition(
        { top: 700, right: 1_100, bottom: 770, width: 760 },
        1_440, 900, 34,
      ),
    ).toEqual({ left: 460, top: 776, width: 640 });
  });

  it("keeps wrapped actions clear of the composer", () => {
    expect(
      calculateNoticePosition(
        { top: 700, right: 1_100, bottom: 770, width: 760 },
        1_440, 900, 82,
      ),
    ).toEqual({ left: 460, top: 776, width: 640 });
  });

  it("moves above a composer near the bottom of the viewport", () => {
    expect(
      calculateNoticePosition(
        { top: 820, right: 1_100, bottom: 890, width: 760 },
        1_440, 900, 82,
      ),
    ).toEqual({ left: 460, top: 732, width: 640 });
  });

  it("moves below a composer near the top of a narrow viewport", () => {
    expect(
      calculateNoticePosition(
        { top: 20, right: 272, bottom: 90, width: 264 },
        280, 500, 34,
      ),
    ).toEqual({ left: 8, top: 96, width: 264 });
  });

  it("clamps the bar inside a very small viewport", () => {
    expect(
      calculateNoticePosition(
        { top: 40, right: 190, bottom: 110, width: 180 },
        200, 140, 82,
      ),
    ).toEqual({ left: 8, top: 8, width: 184 });
  });
});
