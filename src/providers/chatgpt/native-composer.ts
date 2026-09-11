const SELECTOR_GROUPS = [
  ["#mobile-composer-prompt"],
  ["#prompt-textarea"],
  ['[data-testid="prompt-textarea"]'],
  ['form [contenteditable="true"][role="textbox"]'],
  ["form textarea"],
] as const;

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
