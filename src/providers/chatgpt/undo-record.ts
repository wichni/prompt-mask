import type { DraftSessionId } from "../../platform/chromium/messages";
import type {
  ComposerRestorePoint,
  ComposerStructureSignature,
} from "./native-composer";

export interface UndoDraftState {
  sessionId: DraftSessionId;
  composer: HTMLElement;
  sourceUrl: string;
  contextGeneration: number;
  changeGeneration: number;
  revision: number;
  text: string;
  structure: ComposerStructureSignature;
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
  expectedStructure: ComposerStructureSignature;
  restorePoint: ComposerRestorePoint;
  mode: "SINGLE" | "ALL";
  count: number;
}

export const createUndoRecord = (
  operationId: number,
  before: UndoDraftState,
  after: UndoDraftState,
  restorePoint: ComposerRestorePoint,
  previousCaret: number,
  count: number,
): UndoRecord => ({
  operationId,
  sessionId: before.sessionId,
  composer: before.composer,
  sourceUrl: before.sourceUrl,
  contextGeneration: before.contextGeneration,
  changeGeneration: before.changeGeneration,
  resultRevision: after.revision,
  previousText: before.text,
  previousCaret,
  expectedText: after.text,
  expectedStructure: after.structure,
  restorePoint,
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
  record.expectedText === current.text &&
  record.expectedStructure === current.structure;
