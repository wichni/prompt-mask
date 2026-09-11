import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureComposerRestorePoint,
  findNativeComposer,
  readComposerSelection,
  readComposerText,
  restoreComposerText,
  writeComposerText,
} from "../src/providers/chatgpt/native-composer";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("native ChatGPT composer", () => {
  it("accepts one current ChatGPT textarea", () => {
    document.body.innerHTML = [
      '<textarea id="mobile-composer-prompt"></textarea>',
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

  it("ignores a hidden matching element and selects the visible editor", () => {
    document.body.innerHTML = [
      '<div id="mobile-composer-prompt" hidden>500600700</div>',
      '<form><textarea id="actual-editor">600700800</textarea></form>',
    ].join("");

    expect(findNativeComposer(document)?.id).toBe("actual-editor");
  });

  it("accepts an interactive editor inside a non-interactive overlay", () => {
    document.body.innerHTML =
      '<form style="pointer-events:none"><textarea id="prompt-textarea" style="pointer-events:auto"></textarea></form>';

    expect(findNativeComposer(document)?.id).toBe("prompt-textarea");
  });

  it("refuses two simultaneously usable desktop and mobile editors", () => {
    document.body.innerHTML = [
      '<textarea id="mobile-composer-prompt"></textarea>',
      '<form><div id="prompt-textarea" contenteditable="true" role="textbox"></div></form>',
    ].join("");

    expect(findNativeComposer(document)).toBeNull();
  });

  it.each([
    ["readonly", '<textarea id="mobile-composer-prompt" readonly></textarea>'],
    ["disabled", '<textarea id="mobile-composer-prompt" disabled></textarea>'],
    [
      "CSS-hidden",
      '<form style="display:none"><textarea id="mobile-composer-prompt"></textarea></form>',
    ],
    [
      "aria-disabled",
      '<textarea id="mobile-composer-prompt" aria-disabled="TRUE"></textarea>',
    ],
    [
      "aria-readonly",
      '<textarea id="mobile-composer-prompt" aria-readonly=" true "></textarea>',
    ],
    [
      "wrong input type",
      '<input id="mobile-composer-prompt" type="button">',
    ],
    ["non-editable", '<div id="mobile-composer-prompt">tekst</div>'],
    [
      "hidden subtree",
      '<div id="prompt-textarea" contenteditable="true"><p>widoczne <span aria-hidden="TRUE">ukryte</span></p></div>',
    ],
    [
      "non-editable subtree",
      '<div id="prompt-textarea" contenteditable="true"><p>widoczne <span contenteditable="FALSE">zablokowane</span></p></div>',
    ],
    [
      "unsupported",
      '<div id="prompt-textarea" contenteditable="true"><table><tbody><tr><td>tekst</td></tr></tbody></table></div>',
    ],
  ])("rejects a %s editor", (_case, markup) => {
    document.body.innerHTML = markup;

    expect(findNativeComposer(document)).toBeNull();
  });

  it("reads content from textarea and contenteditable composers", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Tekst pola";
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.textContent = "Tekst DOM";

    expect(readComposerText(textarea)).toBe("Tekst pola");
    expect(readComposerText(editable)).toBe("Tekst DOM");
  });

  it("represents paragraphs, line breaks and an empty paragraph consistently", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.innerHTML = [
      "<p>Pierwszy<br>drugi</p>",
      "<p><br></p>",
      "<p>trzeci</p>",
    ].join("");

    expect(readComposerText(editable)).toBe("Pierwszy\ndrugi\n\ntrzeci");
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

  it("replaces one paragraph range without flattening adjacent paragraphs", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.innerHTML = "<p>Jan Testowy</p><p>Opis przypadku</p>";
    document.body.append(editable);

    writeComposerText(editable, "[DANE_1]\nOpis przypadku", 8, [
      { range: { start: 0, end: 11 }, replacement: "[DANE_1]" },
    ]);

    expect(editable.querySelectorAll("p")).toHaveLength(2);
    expect(editable.children[0]?.textContent).toBe("[DANE_1]");
    expect(editable.children[1]?.textContent).toBe("Opis przypadku");
  });

  it("preserves a br outside the edited range", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.innerHTML = "Telefon 500600700<br>Opis";
    document.body.append(editable);

    writeComposerText(editable, "Telefon [PHONE_1]\nOpis", 17, [
      { range: { start: 8, end: 17 }, replacement: "[PHONE_1]" },
    ]);

    expect(editable.querySelectorAll("br")).toHaveLength(1);
    expect(readComposerText(editable)).toBe("Telefon [PHONE_1]\nOpis");
  });

  it("removes a selected paragraph boundary but preserves later boundaries", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.innerHTML = "<p>Jan Testowy</p><p>Opis przypadku</p><p>Dalej</p>";
    document.body.append(editable);

    writeComposerText(editable, "Jan [DANE_1] przypadku\nDalej", 12, [
      { range: { start: 4, end: 16 }, replacement: "[DANE_1]" },
    ]);

    expect(readComposerText(editable)).toBe("Jan [DANE_1] przypadku\nDalej");
    expect(editable.querySelectorAll("p")).toHaveLength(2);
    expect(editable.children[1]?.textContent).toBe("Dalej");
  });

  it("restores the original contenteditable structure for undo", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.innerHTML =
      "<p>Jan <strong>Testowy</strong></p><p><br></p><p>Opis</p>";
    document.body.append(editable);
    const originalHtml = editable.innerHTML;
    const originalText = readComposerText(editable);
    const restorePoint = captureComposerRestorePoint(
      editable,
      originalText,
      originalText.length,
    )!;

    writeComposerText(editable, "[DANE_1]\n\nOpis", 8, [
      { range: { start: 0, end: 11 }, replacement: "[DANE_1]" },
    ]);
    restoreComposerText(editable, restorePoint);

    expect(editable.innerHTML).toBe(originalHtml);
    expect(readComposerText(editable)).toBe(originalText);
  });

  it("refuses an unsupported structure before changing it", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.innerHTML = "<p>Przed</p><ul><li>500600700</li></ul>";
    document.body.append(editable);
    const originalHtml = editable.innerHTML;

    expect(() =>
      writeComposerText(editable, "Przed\n[PHONE_1]", 17, [
        { range: { start: 6, end: 15 }, replacement: "[PHONE_1]" },
      ]),
    ).toThrow("UNSUPPORTED_COMPOSER");
    expect(editable.innerHTML).toBe(originalHtml);
  });

  it("reads normalized textarea selection in UTF-16 indices", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "🙂 Jan Testowy";
    textarea.setSelectionRange(3, 14, "backward");

    expect(readComposerSelection(textarea)).toEqual({ start: 3, end: 14 });
  });

  it("maps a multi-node contenteditable range and rejects cross-field selection", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
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

  it("maps a selection through a paragraph boundary", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.innerHTML = "<p>Jan Testowy</p><p>Opis przypadku</p>";
    document.body.append(editable);
    const first = editable.children[0]!.firstChild!;
    const second = editable.children[1]!.firstChild!;
    const range = document.createRange();
    range.setStart(first, 4);
    range.setEnd(second, 4);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(readComposerSelection(editable, selection)).toEqual({
      start: 4,
      end: 16,
    });
  });
});
