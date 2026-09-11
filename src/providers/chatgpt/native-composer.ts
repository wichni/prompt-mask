import type { TextEdit } from "../../core/masking";
import {
  applyContentEditableEdits,
  createContentEditableModel,
} from "./contenteditable-model";

const COMPOSER_SELECTORS = [
  "#mobile-composer-prompt",
  "#prompt-textarea",
  '[data-testid="prompt-textarea"]',
  'form [contenteditable="true"][role="textbox"]',
  "form textarea",
] as const;

export interface ComposerSelection {
  start: number;
  end: number;
}

export type ComposerStructureSignature = string | null;

export type ComposerRestorePoint =
  | { kind: "TEXT_CONTROL"; text: string; caret: number }
  | { kind: "CONTENTEDITABLE"; text: string; caret: number; children: Node[] };

const isTextControl = (
  element: HTMLElement,
): element is HTMLTextAreaElement | HTMLInputElement =>
  element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement;

const hasEditableAttribute = (element: HTMLElement): boolean => {
  const value = element.getAttribute("contenteditable")?.trim().toLowerCase();
  return value === "" || value === "true";
};

const hasTrueAttribute = (element: HTMLElement, name: string): boolean =>
  element.getAttribute(name)?.trim().toLowerCase() === "true";

const isUnavailable = (element: HTMLElement, root: Document): boolean => {
  if (!element.isConnected || element.ownerDocument !== root) return true;
  if (
    hasTrueAttribute(element, "aria-disabled") ||
    hasTrueAttribute(element, "aria-readonly") ||
    (isTextControl(element) &&
      (element.disabled || element.readOnly || element.matches(":disabled")))
  ) {
    return true;
  }
  const elementStyle =
    element.ownerDocument.defaultView?.getComputedStyle(element);
  if (
    elementStyle?.visibility === "hidden" ||
    elementStyle?.visibility === "collapse" ||
    elementStyle?.pointerEvents === "none"
  ) {
    return true;
  }
  for (
    let current: HTMLElement | null = element;
    current;
    current = current.parentElement
  ) {
    if (
      current.hidden ||
      current.hasAttribute("inert") ||
      hasTrueAttribute(current, "aria-hidden")
    ) {
      return true;
    }
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (
      style?.display === "none" ||
      style?.contentVisibility === "hidden" ||
      style?.opacity === "0"
    ) {
      return true;
    }
  }
  try {
    if (
      typeof element.checkVisibility === "function" &&
      !element.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      })
    ) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
};

const isUsableComposer = (element: HTMLElement, root: Document): boolean => {
  if (isUnavailable(element, root)) return false;
  if (
    element instanceof HTMLInputElement &&
    element.type !== "text" &&
    element.type !== "search"
  ) {
    return false;
  }
  if (isTextControl(element)) return true;
  return (
    hasEditableAttribute(element) && createContentEditableModel(element) !== null
  );
};

export const findNativeComposer = (root: Document): HTMLElement | null => {
  const candidates = new Set<HTMLElement>();
  COMPOSER_SELECTORS.forEach((selector) => {
    root.querySelectorAll(selector).forEach((element) => {
      if (element instanceof HTMLElement && isUsableComposer(element, root)) {
        candidates.add(element);
      }
    });
  });
  return candidates.size === 1 ? [...candidates][0]! : null;
};

export const readComposerText = (composer: HTMLElement): string => {
  if (isTextControl(composer)) return composer.value;
  const model = createContentEditableModel(composer);
  if (!hasEditableAttribute(composer) || !model) {
    throw new Error("UNSUPPORTED_COMPOSER");
  }
  return model.text;
};

export const readComposerStructure = (
  composer: HTMLElement,
): ComposerStructureSignature =>
  isTextControl(composer) ? null : composer.innerHTML;

export const readComposerCaret = (composer: HTMLElement): number =>
  isTextControl(composer)
    ? (composer.selectionStart ?? readComposerText(composer).length)
    : readComposerText(composer).length;

export const readComposerSelection = (
  composer: HTMLElement,
  selection: Selection | null = window.getSelection(),
): ComposerSelection | null => {
  if (isTextControl(composer)) {
    const start = composer.selectionStart;
    const end = composer.selectionEnd;
    return start !== null && end !== null && start < end ? { start, end } : null;
  }
  if (
    !selection ||
    selection.rangeCount !== 1 ||
    selection.isCollapsed ||
    !composer.contains(selection.anchorNode) ||
    !composer.contains(selection.focusNode)
  ) {
    return null;
  }
  const model = createContentEditableModel(composer);
  if (!model) return null;
  const range = selection.getRangeAt(0);
  const start = model.offsetOf(range.startContainer, range.startOffset);
  const end = model.offsetOf(range.endContainer, range.endOffset);
  return start !== null && end !== null && start < end ? { start, end } : null;
};

const setNativeValue = (
  composer: HTMLTextAreaElement | HTMLInputElement,
  value: string,
): void => {
  const prototype =
    composer instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("MISSING_NATIVE_VALUE_SETTER");
  setter.call(composer, value);
};

const dispatchInput = (composer: HTMLElement): void => {
  composer.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertReplacementText",
    }),
  );
};

const applyTextEdits = (
  text: string,
  edits: readonly TextEdit[],
): string | null => {
  const sorted = [...edits].sort(
    (left, right) => left.range.start - right.range.start,
  );
  let cursor = 0;
  let result = "";
  for (const edit of sorted) {
    if (
      !Number.isSafeInteger(edit.range.start) ||
      !Number.isSafeInteger(edit.range.end) ||
      edit.range.start < cursor ||
      edit.range.start < 0 ||
      edit.range.end <= edit.range.start ||
      edit.range.end > text.length
    ) {
      return null;
    }
    result += text.slice(cursor, edit.range.start) + edit.replacement;
    cursor = edit.range.end;
  }
  return result + text.slice(cursor);
};

const setContentEditableCaret = (composer: HTMLElement, caret: number): void => {
  const point = createContentEditableModel(composer)?.pointAt(caret);
  const selection = window.getSelection();
  if (!point || !selection) throw new Error("INVALID_CARET");
  const range = document.createRange();
  range.setStart(point.node, point.offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

export const captureComposerRestorePoint = (
  composer: HTMLElement,
  expectedText: string,
  caret: number,
): ComposerRestorePoint | null => {
  try {
    if (readComposerText(composer) !== expectedText) return null;
    return isTextControl(composer)
      ? { kind: "TEXT_CONTROL", text: expectedText, caret }
      : {
          kind: "CONTENTEDITABLE",
          text: expectedText,
          caret,
          children: [...composer.childNodes].map((node) => node.cloneNode(true)),
        };
  } catch {
    return null;
  }
};

export const writeComposerText = (
  composer: HTMLElement,
  value: string,
  caret: number,
  edits: readonly TextEdit[] = [],
): ComposerStructureSignature => {
  if (isTextControl(composer)) {
    setNativeValue(composer, value);
    composer.setSelectionRange(caret, caret);
  } else {
    const current = readComposerText(composer);
    if (applyTextEdits(current, edits) !== value) throw new Error("INVALID_EDITS");
    applyContentEditableEdits(composer, edits);
    if (readComposerText(composer) !== value) throw new Error("WRITE_MISMATCH");
    setContentEditableCaret(composer, caret);
  }
  const expectedStructure = readComposerStructure(composer);
  dispatchInput(composer);
  return expectedStructure;
};

export const restoreComposerText = (
  composer: HTMLElement,
  restorePoint: ComposerRestorePoint,
): ComposerStructureSignature => {
  if (isTextControl(composer) && restorePoint.kind === "TEXT_CONTROL") {
    setNativeValue(composer, restorePoint.text);
    composer.setSelectionRange(restorePoint.caret, restorePoint.caret);
  } else if (!isTextControl(composer) && restorePoint.kind === "CONTENTEDITABLE") {
    composer.replaceChildren(
      ...restorePoint.children.map((node) => node.cloneNode(true)),
    );
    if (readComposerText(composer) !== restorePoint.text) {
      throw new Error("RESTORE_MISMATCH");
    }
    setContentEditableCaret(composer, restorePoint.caret);
  } else {
    throw new Error("RESTORE_TYPE_MISMATCH");
  }
  const expectedStructure = readComposerStructure(composer);
  dispatchInput(composer);
  return expectedStructure;
};
