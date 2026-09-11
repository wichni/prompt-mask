import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findNativeComposer,
  readComposerText,
  writeComposerText,
} from "../src/providers/chatgpt/native-composer";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("native ChatGPT composer", () => {
  it("prefers the current ChatGPT textarea", () => {
    document.body.innerHTML = [
      '<textarea id="mobile-composer-prompt"></textarea>',
      '<form><textarea></textarea></form>',
    ].join("");

    expect(findNativeComposer(document)?.id).toBe("mobile-composer-prompt");
  });

  it("refuses an ambiguous fallback", () => {
    document.body.innerHTML = [
      '<form><textarea></textarea></form>',
      '<form><textarea></textarea></form>',
    ].join("");

    expect(findNativeComposer(document)).toBeNull();
  });

  it("reads content from textarea and contenteditable composers", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Tekst pola";
    const editable = document.createElement("div");
    editable.textContent = "Tekst DOM";

    expect(readComposerText(textarea)).toBe("Tekst pola");
    expect(readComposerText(editable)).toBe("Tekst DOM");
  });

  it("writes text, moves the caret and dispatches an input event", () => {
    const textarea = document.createElement("textarea");
    const listener = vi.fn();
    textarea.addEventListener("input", listener);

    writeComposerText(textarea, "Treść [PESEL_1]", 15);

    expect(textarea.value).toBe("Treść [PESEL_1]");
    expect(textarea.selectionStart).toBe(15);
    expect(listener).toHaveBeenCalledOnce();
  });
});
