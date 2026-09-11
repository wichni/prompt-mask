import type { TextRange } from "../../core/masking";
import type { DraftSessionId } from "../../platform/chromium/messages";
import type { UndoDraftState } from "./undo-record";

export interface SelectionRecord extends TextRange {
  selectionId: number;
  sessionId: DraftSessionId;
  composer: HTMLElement;
  sourceUrl: string;
  contextGeneration: number;
  changeGeneration: number;
  revision: number;
  structure: UndoDraftState["structure"];
  selectedText: string;
}

export const createSelectionRecord = (
  selectionId: number,
  draft: UndoDraftState,
  range: TextRange,
): SelectionRecord => ({
  selectionId,
  sessionId: draft.sessionId,
  composer: draft.composer,
  sourceUrl: draft.sourceUrl,
  contextGeneration: draft.contextGeneration,
  changeGeneration: draft.changeGeneration,
  revision: draft.revision,
  structure: draft.structure,
  selectedText: draft.text.slice(range.start, range.end),
  ...range,
});

export const matchesSelectionDraft = (
  record: SelectionRecord,
  draft: UndoDraftState,
): boolean =>
  record.composer === draft.composer &&
  record.sessionId === draft.sessionId &&
  record.sourceUrl === draft.sourceUrl &&
  record.contextGeneration === draft.contextGeneration &&
  record.changeGeneration === draft.changeGeneration &&
  record.revision === draft.revision &&
  record.structure === draft.structure &&
  record.selectedText === draft.text.slice(record.start, record.end);
