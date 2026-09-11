import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findNativeComposer,
  readComposerSelection,
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

  it("reads normalized textarea selection in UTF-16 indices", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "🙂 Jan Testowy";
    textarea.setSelectionRange(3, 14, "backward");

    expect(readComposerSelection(textarea)).toEqual({ start: 3, end: 14 });
  });

  it("maps a multi-node contenteditable range and rejects cross-field selection", () => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    editable.innerHTML = "Ala <strong>Testowa</strong> czeka";
    const strongText = editable.querySelector("strong")!.firstChild!;
    const lastText = editable.lastChild!;
    document.body.append(editable);
    const range = document.createRange();
    range.setStart(strongText, 0);
    range.setEnd(lastText, 3);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(readComposerSelection(editable, selection)).toEqual({
      start: 4,
      end: 14,
    });

    const outside = document.createTextNode("poza");
    document.body.append(outside);
    const crossField = document.createRange();
    crossField.setStart(strongText, 0);
    crossField.setEnd(outside, 2);
    selection.removeAllRanges();
    selection.addRange(crossField);
    expect(readComposerSelection(editable, selection)).toBeNull();
  });
});
