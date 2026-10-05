import { describe, expect, it } from "vitest";
import { calculateShortcutPosition } from "../src/providers/chatgpt/manual-shortcut-position";
import { calculateNoticePosition } from "../src/providers/chatgpt/notice-position";

describe("manual shortcut position", () => {
  const composer = { left: 500, right: 1_100, top: 700, bottom: 770 };

  it("uses the upper-right edge when there is no page bar", () => {
    expect(calculateShortcutPosition(composer, null, 1_440, 900)).toEqual({
      left: 1_052,
      top: 658,
    });
  });

  it("moves to the upper-left edge when the page bar occupies the right side", () => {
    const notice = { left: 780, right: 1_100, top: 652, bottom: 692 };
    expect(calculateShortcutPosition(composer, notice, 1_440, 900)).toEqual({
      left: 500,
      top: 658,
    });
  });

  it("moves below the composer when the bar spans a narrow upper edge", () => {
    const narrow = { left: 8, right: 272, top: 200, bottom: 260 };
    const notice = { left: 8, right: 272, top: 154, bottom: 194 };
    expect(calculateShortcutPosition(narrow, notice, 280, 500)).toEqual({
      left: 224,
      top: 268,
    });
  });

  it("separates the bar and selection control in the reported viewport", () => {
    const editor = { left: 713, right: 1_559, top: 688, bottom: 745, width: 846 };
    const bar = calculateNoticePosition(editor, 1_987, 1_248, 34);
    const shortcut = calculateShortcutPosition(editor, {
      left: bar.left,
      right: bar.left + bar.width,
      top: bar.top,
      bottom: bar.top + 34,
    }, 1_987, 1_248);

    expect(bar.top).toBe(751);
    expect(shortcut.top + 34).toBeLessThan(bar.top);
  });
});
