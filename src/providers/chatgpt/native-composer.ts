const SELECTOR_GROUPS = [
  ["#mobile-composer-prompt"],
  ["#prompt-textarea"],
  ['[data-testid="prompt-textarea"]'],
  ['form [contenteditable="true"][role="textbox"]'],
  ["form textarea"],
] as const;

export interface ComposerSelection {
  start: number;
  end: number;
}

const uniqueElements = (
  root: Document,
  selectors: readonly string[],
): HTMLElement[] => {
  const elements = new Set<Element>();
  selectors.forEach((selector) => {
    root.querySelectorAll(selector).forEach((element) => elements.add(element));
  });
  return [...elements].filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );
};

export const findNativeComposer = (root: Document): HTMLElement | null => {
  for (const selectors of SELECTOR_GROUPS) {
    const candidates = uniqueElements(root, selectors);
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) return null;
  }
  return null;
};

export const readComposerText = (composer: HTMLElement): string =>
  composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement
    ? composer.value
    : composer.textContent ?? "";

export const readComposerCaret = (composer: HTMLElement): number =>
  composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement
    ? (composer.selectionStart ?? readComposerText(composer).length)
    : readComposerText(composer).length;

const isInsideComposer = (composer: HTMLElement, node: Node | null): boolean =>
  node !== null && (node === composer || composer.contains(node));

const boundaryOffset = (
  composer: HTMLElement,
  container: Node,
  offset: number,
): number | null => {
  if (!isInsideComposer(composer, container)) return null;
  let total = 0;
  const walker = document.createTreeWalker(composer, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node === container) {
      return total + Math.min(offset, node.textContent?.length ?? 0);
    }
    total += node.textContent?.length ?? 0;
  }
  if (container instanceof Element || container === composer) {
    const children = [...container.childNodes];
    if (offset > children.length) return null;
    const boundaryChild = children[offset] ?? null;
    const range = document.createRange();
    range.selectNodeContents(composer);
    range.setEnd(container, offset);
    const prefix = range.cloneContents().textContent ?? "";
    if (boundaryChild || offset === children.length) return prefix.length;
  }
  return null;
};

export const readComposerSelection = (
  composer: HTMLElement,
  selection: Selection | null = window.getSelection(),
): ComposerSelection | null => {
  if (
    composer instanceof HTMLTextAreaElement ||
    composer instanceof HTMLInputElement
  ) {
    const start = composer.selectionStart;
    const end = composer.selectionEnd;
    return start !== null && end !== null && start < end ? { start, end } : null;
  }
  if (
    !selection ||
    selection.rangeCount !== 1 ||
    selection.isCollapsed ||
    !isInsideComposer(composer, selection.anchorNode) ||
    !isInsideComposer(composer, selection.focusNode)
  ) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const start = boundaryOffset(
    composer,
    range.startContainer,
    range.startOffset,
  );
  const end = boundaryOffset(composer, range.endContainer, range.endOffset);
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

export const writeComposerText = (
  composer: HTMLElement,
  value: string,
  caret: number,
): void => {
  if (
    composer instanceof HTMLTextAreaElement ||
    composer instanceof HTMLInputElement
  ) {
    setNativeValue(composer, value);
    composer.setSelectionRange(caret, caret);
  } else {
    composer.textContent = value;
  }
  composer.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertReplacementText",
    }),
  );
};
