import type { DetectionKind } from "../../core/detection";
import type { DraftSessionId } from "../../platform/chromium/messages";
import type { NoticeView } from "./background-notice";
import { kindLabels } from "./page-control-kinds";

export const createCategoryButtons = (
  view: NoticeView | null,
  isTrustedActivation: (event: Event) => boolean,
  maskKind: (kind: DetectionKind, sessionId: DraftSessionId, revision: number) => boolean,
  onFailure: () => void,
): HTMLButtonElement[] =>
  view?.categories.map(({ kind, count }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${kindLabels[kind]} · ${count}`;
    button.setAttribute("aria-label", `Maskuj wszystkie: ${kindLabels[kind]} (${count})`);
    button.title = `Maskuj wszystkie: ${kindLabels[kind]} (${count})`;
    button.addEventListener("click", (event) => {
      if (!isTrustedActivation(event)) return;
      if (!maskKind(kind, view.sessionId, view.revision)) onFailure();
    });
    return button;
  }) ?? [];
