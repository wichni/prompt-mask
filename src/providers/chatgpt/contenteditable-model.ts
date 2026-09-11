import type { TextEdit } from "../../core/masking";

interface DomPoint {
  node: Node;
  offset: number;
}

export interface ContentEditableModel {
  mode: "BLOCK" | "INLINE";
  text: string;
  offsetOf(node: Node, offset: number): number | null;
  pointAt(offset: number): DomPoint | null;
  topLevelBlock(point: DomPoint): HTMLElement | null;
}

const BLOCK_TAGS = new Set(["DIV", "P"]);
const INLINE_TAGS = new Set([
  "A",
  "B",
  "CODE",
  "EM",
  "I",
  "S",
  "SPAN",
  "STRONG",
  "U",
]);

const childIndex = (node: Node): number =>
  node.parentNode
    ? [...node.parentNode.childNodes].indexOf(node as ChildNode)
    : -1;

const normalizedAttribute = (
  element: HTMLElement,
  name: string,
): string | null =>
  element.getAttribute(name)?.trim().toLowerCase() ?? null;

const isHiddenNode = (element: HTMLElement): boolean => {
  if (
    element.hidden ||
    element.hasAttribute("inert") ||
    normalizedAttribute(element, "aria-hidden") === "true" ||
    normalizedAttribute(element, "contenteditable") === "false"
  ) {
    return true;
  }
  try {
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    return (
      style?.display === "none" ||
      style?.visibility === "hidden" ||
      style?.visibility === "collapse" ||
      style?.contentVisibility === "hidden" ||
      style?.opacity === "0"
    );
  } catch {
    return true;
  }
};

export const createContentEditableModel = (
  composer: HTMLElement,
): ContentEditableModel | null => {
  const nodes = [...composer.childNodes];
  const isBlockLayout =
    nodes.length > 0 &&
    nodes.every(
      (node) =>
        node instanceof HTMLElement && BLOCK_TAGS.has(node.tagName),
    );
  const hasBlock = nodes.some(
    (node) => node instanceof HTMLElement && BLOCK_TAGS.has(node.tagName),
  );
  if (hasBlock && !isBlockLayout) return null;

  const mode = isBlockLayout ? "BLOCK" : "INLINE";
  const points: Array<DomPoint | undefined> = [];
  const offsets = new Map<Node, Map<number, number>>();
  let text = "";

  const registerOffset = (
    node: Node,
    offset: number,
    textOffset = text.length,
  ): void => {
    const nodeOffsets = offsets.get(node) ?? new Map<number, number>();
    nodeOffsets.set(offset, textOffset);
    offsets.set(node, nodeOffsets);
  };

  const appendText = (node: Text): void => {
    const value = node.data;
    const start = text.length;
    text += value;
    for (let offset = 0; offset <= value.length; offset += 1) {
      points[start + offset] = { node, offset };
      registerOffset(node, offset, start + offset);
    }
  };

  const appendBreak = (element: HTMLElement): boolean => {
    const parent = element.parentNode;
    const index = childIndex(element);
    if (!parent || index < 0) return false;
    points[text.length] = { node: parent, offset: index };
    registerOffset(parent, index);
    text += "\n";
    points[text.length] = { node: parent, offset: index + 1 };
    registerOffset(parent, index + 1);
    return true;
  };

  const appendInline = (node: Node): boolean => {
    if (node instanceof Text) {
      appendText(node);
      return true;
    }
    if (!(node instanceof HTMLElement) || isHiddenNode(node)) return false;
    if (node.tagName === "BR") return appendBreak(node);
    if (!INLINE_TAGS.has(node.tagName)) return false;
    registerOffset(node, 0);
    for (const [index, child] of [...node.childNodes].entries()) {
      if (!appendInline(child)) return false;
      registerOffset(node, index + 1);
    }
    return true;
  };

  if (mode === "INLINE") {
    registerOffset(composer, 0);
    for (const [index, node] of nodes.entries()) {
      if (!appendInline(node)) return null;
      registerOffset(composer, index + 1);
    }
    points[0] ??= { node: composer, offset: 0 };
    points[text.length] ??= {
      node: composer,
      offset: composer.childNodes.length,
    };
  } else {
    const blocks = nodes as HTMLElement[];
    registerOffset(composer, 0);
    for (const [index, block] of blocks.entries()) {
      if (isHiddenNode(block)) return null;
      if (index > 0) {
        const previous = blocks[index - 1]!;
        points[text.length] = {
          node: previous,
          offset: previous.childNodes.length,
        };
        text += "\n";
        points[text.length] = { node: block, offset: 0 };
      }
      const children = [...block.childNodes];
      const placeholderBreak =
        children.length === 1 &&
        children[0] instanceof HTMLElement &&
        children[0].tagName === "BR";
      registerOffset(block, 0);
      if (!placeholderBreak) {
        for (const [childOffset, child] of children.entries()) {
          if (!appendInline(child)) return null;
          registerOffset(block, childOffset + 1);
        }
      } else {
        registerOffset(block, 1);
      }
      points[text.length] ??= {
        node: block,
        offset: block.childNodes.length,
      };
      registerOffset(composer, index + 1);
    }
  }

  return {
    mode,
    text,
    offsetOf: (node, offset) => offsets.get(node)?.get(offset) ?? null,
    pointAt: (offset) =>
      Number.isSafeInteger(offset) && offset >= 0 && offset <= text.length
        ? (points[offset] ?? null)
        : null,
    topLevelBlock: ({ node }) => {
      let current = node instanceof HTMLElement ? node : node.parentElement;
      while (current && current.parentElement !== composer) {
        current = current.parentElement;
      }
      return current?.parentElement === composer && BLOCK_TAGS.has(current.tagName)
        ? current
        : null;
    },
  };
};

const insertText = (range: Range, replacement: string): void => {
  range.deleteContents();
  range.collapse(true);
  if (replacement) range.insertNode(document.createTextNode(replacement));
};

const replaceAcrossBlocks = (
  composer: HTMLElement,
  start: DomPoint,
  end: DomPoint,
  startBlock: HTMLElement,
  endBlock: HTMLElement,
  replacement: string,
): void => {
  const startRange = document.createRange();
  startRange.setStart(start.node, start.offset);
  startRange.setEnd(startBlock, startBlock.childNodes.length);
  startRange.deleteContents();

  const endRange = document.createRange();
  endRange.setStart(endBlock, 0);
  endRange.setEnd(end.node, end.offset);
  endRange.deleteContents();

  if (replacement) startBlock.append(document.createTextNode(replacement));
  while (endBlock.firstChild) startBlock.append(endBlock.firstChild);
  let sibling = startBlock.nextSibling;
  while (sibling) {
    const next = sibling.nextSibling;
    sibling.remove();
    if (sibling === endBlock) break;
    sibling = next;
  }
  if (!composer.contains(startBlock)) throw new Error("STALE_BLOCK_STRUCTURE");
};

export const applyContentEditableEdits = (
  composer: HTMLElement,
  edits: readonly TextEdit[],
): void => {
  const descendingEdits = [...edits].sort(
    (left, right) => right.range.start - left.range.start,
  );
  for (const edit of descendingEdits) {
    if (edit.replacement.includes("\n")) throw new Error("UNSUPPORTED_EDIT");
    const model = createContentEditableModel(composer);
    const start = model?.pointAt(edit.range.start) ?? null;
    const end = model?.pointAt(edit.range.end) ?? null;
    if (!model || !start || !end) throw new Error("UNSUPPORTED_COMPOSER");
    const startBlock = model.topLevelBlock(start);
    const endBlock = model.topLevelBlock(end);
    if (model.mode === "BLOCK" && startBlock !== endBlock) {
      if (!startBlock || !endBlock) throw new Error("UNSUPPORTED_COMPOSER");
      replaceAcrossBlocks(
        composer,
        start,
        end,
        startBlock,
        endBlock,
        edit.replacement,
      );
    } else {
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      insertText(range, edit.replacement);
    }
  }
};
