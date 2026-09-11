import type { DraftSessionId } from "../../platform/chromium/messages";

export interface UndoDraftState {
  sessionId: DraftSessionId;
  composer: HTMLElement;
  sourceUrl: string;
  contextGeneration: number;
  changeGeneration: number;
  revision: number;
  text: string;
}

export interface UndoRecord {
  operationId: number;
  sessionId: DraftSessionId;
  composer: HTMLElement;
  sourceUrl: string;
  contextGeneration: number;
  changeGeneration: number;
  resultRevision: number;
  previousText: string;
  previousCaret: number;
  expectedText: string;
  mode: "SINGLE" | "ALL";
  count: number;
}

export const createUndoRecord = (
  operationId: number,
  before: UndoDraftState,
  resultRevision: number,
  expectedText: string,
  previousCaret: number,
  count: number,
): UndoRecord => ({
  operationId,
  sessionId: before.sessionId,
  composer: before.composer,
  sourceUrl: before.sourceUrl,
  contextGeneration: before.contextGeneration,
  changeGeneration: before.changeGeneration,
  resultRevision,
  previousText: before.text,
  previousCaret,
  expectedText,
  mode: count === 1 ? "SINGLE" : "ALL",
  count,
});

export const matchesUndoDraft = (
  record: UndoRecord,
  current: UndoDraftState,
): boolean =>
  record.composer === current.composer &&
  record.sessionId === current.sessionId &&
  record.sourceUrl === current.sourceUrl &&
  record.contextGeneration === current.contextGeneration &&
  record.changeGeneration === current.changeGeneration &&
  record.resultRevision === current.revision &&
  record.expectedText === current.text;
