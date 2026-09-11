import { createManualMaskingPlan } from "../../core/masking";
import type { SelectionState } from "../../platform/chromium/messages";
import { readComposerSelection, readComposerText } from "./native-composer";
import {
  createSelectionRecord,
  matchesSelectionDraft,
  type SelectionRecord,
} from "./selection-record";
import type { UndoDraftState } from "./undo-record";

interface SelectionControllerDependencies {
  findComposer: () => HTMLElement | null;
  getDraft: () => UndoDraftState | null;
  getUrl: () => string;
  onState: (state: SelectionState) => void;
  onStaleContext: () => void;
  shouldPreserveSelection: (event: Event) => boolean;
}

export class SelectionController {
  private nextSelectionId = 1;
  private currentRecord: SelectionRecord | null = null;
  private currentState: SelectionState = {
    type: "SELECTION_STATE",
    state: "NONE",
  };

  constructor(private readonly dependencies: SelectionControllerDependencies) {}

  get record(): SelectionRecord | null {
    return this.currentRecord;
  }

  get state(): SelectionState {
    return this.currentState;
  }

  discard = (notify = true): void => {
    const hadSelection =
      this.currentRecord !== null || this.currentState.state !== "NONE";
    this.currentRecord = null;
    if (notify && hadSelection) {
      this.publish({ type: "SELECTION_STATE", state: "NONE" });
    }
  };

  capture = (activeComposer: HTMLElement): void => {
    const draft = this.dependencies.getDraft();
    if (
      !draft ||
      activeComposer !== draft.composer ||
      this.dependencies.getUrl() !== draft.sourceUrl ||
      readComposerText(activeComposer) !== draft.text
    ) {
      this.discard();
      this.dependencies.onStaleContext();
      return;
    }
    const range = readComposerSelection(activeComposer);
    if (!range) {
      this.discard();
      return;
    }
    const prepared = createManualMaskingPlan(draft.text, range);
    if (prepared.status === "PLACEHOLDER_OVERLAP") {
      this.currentRecord = null;
      this.publish({
        type: "SELECTION_STATE",
        state: "INVALID",
        reason: "PLACEHOLDER_OVERLAP",
      });
      return;
    }
    if (prepared.status !== "READY") {
      this.discard();
      return;
    }
    if (
      this.currentRecord?.start === range.start &&
      this.currentRecord.end === range.end &&
      matchesSelectionDraft(this.currentRecord, draft)
    ) {
      return;
    }
    this.currentRecord = createSelectionRecord(
      this.nextSelectionId++,
      draft,
      range,
    );
    this.publish({
      type: "SELECTION_STATE",
      state: "READY",
      selectionId: this.currentRecord.selectionId,
    });
  };

  handleGesture = (event: Event): void => {
    if (this.dependencies.shouldPreserveSelection(event)) return;
    const target = event.target;
    const activeComposer = this.dependencies.findComposer();
    if (
      activeComposer &&
      target instanceof Node &&
      (target === activeComposer || activeComposer.contains(target))
    ) {
      this.capture(activeComposer);
      return;
    }
    this.discard();
  };

  handleSelectionChange = (): void => {
    const activeComposer = this.dependencies.findComposer();
    if (!activeComposer) {
      this.discard();
      return;
    }
    const domSelection = window.getSelection();
    if (domSelection && !domSelection.isCollapsed) {
      const anchorInside = this.isInside(activeComposer, domSelection.anchorNode);
      const focusInside = this.isInside(activeComposer, domSelection.focusNode);
      if (anchorInside && focusInside) this.capture(activeComposer);
      else this.discard();
      return;
    }
    if (document.activeElement === activeComposer) this.capture(activeComposer);
  };

  reset = (): void => {
    this.currentRecord = null;
    this.currentState = { type: "SELECTION_STATE", state: "NONE" };
  };

  private isInside(composer: HTMLElement, node: Node | null): boolean {
    return node === composer || (node !== null && composer.contains(node));
  }

  private publish(state: SelectionState): void {
    this.currentState = state;
    this.dependencies.onState(state);
  }
}
