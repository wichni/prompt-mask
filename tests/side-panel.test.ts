import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelEvent } from "../src/platform/chromium/messages";

const composerMock = vi.hoisted(() => ({
  disconnect: vi.fn(),
  mask: vi.fn(() => true),
  undo: vi.fn(() => true),
  onEvent: undefined as ((event: PanelEvent) => void) | undefined,
}));

vi.mock("../src/app/native-composer-client", () => ({
  watchNativeComposer: (onEvent: (event: PanelEvent) => void) => {
    composerMock.onEvent = onEvent;
    return {
      disconnect: composerMock.disconnect,
      mask: composerMock.mask,
      undo: composerMock.undo,
    };
  },
}));

import { SidePanel } from "../src/app/SidePanel";

let container: HTMLDivElement;
let root: Root;

const emit = (event: PanelEvent): void => {
  act(() => composerMock.onEvent?.(event));
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  composerMock.disconnect.mockClear();
  composerMock.mask.mockReset();
  composerMock.mask.mockReturnValue(true);
  composerMock.undo.mockReset();
  composerMock.undo.mockReturnValue(true);
  composerMock.onEvent = undefined;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(SidePanel)));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("side panel", () => {
  it("shows one masking action per compact finding and no premature empty state", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    expect(container.textContent).not.toContain("Brak wykryć");
    expect(container.querySelector<HTMLButtonElement>(".bulk-mask")?.disabled).toBe(
      true,
    );

    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 1,
      length: 48,
      detections: [
        {
          id: "EMAIL:8:29",
          kind: "EMAIL",
          maskedPreview: "a•••@e•••.com",
        },
        {
          id: "PHONE:34:49",
          kind: "PHONE",
          maskedPreview: "+48 ••• ••• 700",
        },
      ],
    });

    expect(container.textContent).toContain("Do sprawdzenia: 2");
    expect(container.textContent).toContain(
      "Wybierz dane, które chcesz zamaskować",
    );
    expect(container.textContent).not.toContain("Pomiń");
    expect(container.textContent).not.toContain("Długość");
    expect(container.querySelector<HTMLButtonElement>(".bulk-mask")?.disabled).toBe(
      false,
    );
    expect(container.querySelectorAll("button")).toHaveLength(3);
    expect(
      [...container.querySelectorAll("button")].map((button) => button.textContent),
    ).toEqual(["Maskuj wszystkie wykryte (2)", "Maskuj", "Maskuj"]);
  });

  it("announces success only after the updated snapshot and result", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 1,
      length: 48,
      detections: [
        {
          id: "EMAIL:8:29",
          kind: "EMAIL",
          maskedPreview: "a•••@e•••.com",
        },
        {
          id: "PHONE:34:49",
          kind: "PHONE",
          maskedPreview: "+48 ••• ••• 700",
        },
      ],
    });

    act(() =>
      container.querySelector<HTMLButtonElement>(".single-mask")?.click(),
    );
    expect(container.textContent).not.toContain("Zamaskowano");
    expect(composerMock.mask).toHaveBeenCalledWith({
      type: "MASK_DETECTIONS",
      revision: 1,
      detectionIds: ["EMAIL:8:29"],
    });

    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 2,
      length: 36,
      detections: [
        {
          id: "PHONE:21:36",
          kind: "PHONE",
          maskedPreview: "+48 ••• ••• 700",
        },
      ],
    });
    expect(container.textContent).not.toContain("Zamaskowano");

    emit({
      type: "MASK_RESULT",
      status: "SUCCESS",
      requestRevision: 1,
      detectionIds: ["EMAIL:8:29"],
      resultRevision: 2,
      remainingDetections: 1,
      undoOperationId: 1,
    });
    expect(container.querySelector(".feedback-message")?.textContent).toBe(
      "Zamaskowano e-mail.",
    );
    expect(container.querySelector(".feedback .feedback-icon")?.textContent).toBe(
      "✓",
    );
    expect(container.textContent).not.toContain("Pozostało");

    emit({
      type: "HOST_STATUS",
      state: "SEARCHING",
    });
    expect(container.textContent).not.toContain("Zamaskowano");
  });

  it("shows the bounded empty and failure states", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 1,
      length: 12,
      detections: [],
    });
    expect(container.textContent).toContain(
      "Brak wykryć dla obsługiwanych typów danych",
    );

    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 2,
      length: 29,
      detections: [
        {
          id: "EMAIL:8:29",
          kind: "EMAIL",
          maskedPreview: "a•••@e•••.com",
        },
      ],
    });
    composerMock.mask.mockReturnValue(false);
    act(() => container.querySelector<HTMLButtonElement>(".bulk-mask")?.click());

    expect(container.querySelector(".feedback")?.textContent).toContain(
      "Błąd maskowania",
    );
    expect(container.querySelector(".feedback .feedback-icon")?.textContent).toBe(
      "!",
    );
    expect(container.textContent).toContain("a•••@e•••.com");
  });

  it("sends the visible set once and keeps the status slot in place", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 1,
      length: 48,
      detections: [
        {
          id: "EMAIL:8:29",
          kind: "EMAIL",
          maskedPreview: "a•••@e•••.com",
        },
        {
          id: "PHONE:34:49",
          kind: "PHONE",
          maskedPreview: "••• ••• 700",
        },
      ],
    });
    const statusSlot = container.querySelector(".operation-status");
    const bulkButton = container.querySelector<HTMLButtonElement>(".bulk-mask")!;

    act(() => {
      bulkButton.click();
      bulkButton.click();
    });

    expect(composerMock.mask).toHaveBeenCalledOnce();
    expect(composerMock.mask).toHaveBeenCalledWith({
      type: "MASK_DETECTIONS",
      revision: 1,
      detectionIds: ["EMAIL:8:29", "PHONE:34:49"],
    });
    expect(
      [...container.querySelectorAll<HTMLButtonElement>("button")].every(
        ({ disabled }) => disabled,
      ),
    ).toBe(true);

    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 2,
      length: 24,
      detections: [],
    });
    emit({
      type: "MASK_RESULT",
      status: "SUCCESS",
      requestRevision: 1,
      detectionIds: ["EMAIL:8:29", "PHONE:34:49"],
      resultRevision: 2,
      remainingDetections: 0,
      undoOperationId: 1,
    });

    expect(container.querySelector(".operation-status")).toBe(statusSlot);
    expect(container.querySelector(".bulk-mask")).toBe(bulkButton);
    expect(container.querySelector(".feedback")?.textContent).toContain(
      "Zamaskowane fragmenty: 2.",
    );
    expect(container.textContent).toContain("Do sprawdzenia: 0");
    expect(bulkButton.disabled).toBe(true);
  });

  it("shows a distinct information status after a stale operation", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 1,
      length: 29,
      detections: [
        {
          id: "EMAIL:8:29",
          kind: "EMAIL",
          maskedPreview: "a•••@e•••.com",
        },
      ],
    });
    act(() =>
      container.querySelector<HTMLButtonElement>(".single-mask")?.click(),
    );
    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 2,
      length: 30,
      detections: [
        {
          id: "EMAIL:9:30",
          kind: "EMAIL",
          maskedPreview: "a•••@e•••.com",
        },
      ],
    });
    emit({
      type: "MASK_RESULT",
      status: "ERROR",
      requestRevision: 1,
      detectionIds: ["EMAIL:8:29"],
      error: "STALE_TEXT",
    });

    expect(container.querySelector(".feedback.info")?.textContent).toContain(
      "Tekst się zmienił",
    );
    expect(container.querySelector(".feedback .feedback-icon")?.textContent).toBe(
      "i",
    );
  });

  it("offers one accessible undo action and confirms it after reanalysis", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 1,
      length: 29,
      detections: [
        {
          id: "EMAIL:8:29",
          kind: "EMAIL",
          maskedPreview: "a•••@e•••.com",
        },
      ],
    });
    act(() =>
      container.querySelector<HTMLButtonElement>(".single-mask")?.click(),
    );
    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 2,
      length: 17,
      detections: [],
    });
    emit({
      type: "MASK_RESULT",
      status: "SUCCESS",
      requestRevision: 1,
      detectionIds: ["EMAIL:8:29"],
      resultRevision: 2,
      remainingDetections: 0,
      undoOperationId: 7,
    });
    const undo = container.querySelector<HTMLButtonElement>(".undo-mask")!;

    expect(undo.textContent).toBe("Cofnij");
    expect(undo.getAttribute("aria-label")).toBe("Cofnij ostatnie maskowanie");
    act(() => undo.click());
    expect(composerMock.undo).toHaveBeenCalledOnce();
    expect(composerMock.undo).toHaveBeenCalledWith({
      type: "UNDO_MASK",
      operationId: 7,
    });
    expect(container.querySelector(".feedback-message")?.textContent).toBe(
      "Cofanie…",
    );
    expect(undo.disabled).toBe(true);
    expect(
      [...container.querySelectorAll<HTMLButtonElement>("button")].every(
        ({ disabled }) => disabled,
      ),
    ).toBe(true);

    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 3,
      length: 29,
      detections: [
        {
          id: "EMAIL:8:29",
          kind: "EMAIL",
          maskedPreview: "a•••@e•••.com",
        },
      ],
    });
    emit({
      type: "UNDO_RESULT",
      status: "SUCCESS",
      operationId: 7,
      resultRevision: 3,
    });

    expect(container.querySelector(".feedback-message")?.textContent).toBe(
      "Cofnięto ostatnie maskowanie.",
    );
    expect(container.querySelector(".undo-mask")).toBeNull();
    expect(container.textContent).toContain("a•••@e•••.com");
  });

  it("shows draft invalidation once and does not revive undo", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 1,
      length: 29,
      detections: [
        {
          id: "EMAIL:8:29",
          kind: "EMAIL",
          maskedPreview: "a•••@e•••.com",
        },
      ],
    });
    act(() =>
      container.querySelector<HTMLButtonElement>(".single-mask")?.click(),
    );
    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 2,
      length: 17,
      detections: [],
    });
    emit({
      type: "MASK_RESULT",
      status: "SUCCESS",
      requestRevision: 1,
      detectionIds: ["EMAIL:8:29"],
      resultRevision: 2,
      remainingDetections: 0,
      undoOperationId: 8,
    });

    emit({
      type: "UNDO_INVALIDATED",
      operationId: 8,
      reason: "DRAFT_CHANGED",
    });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 3,
      length: 18,
      detections: [],
    });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      revision: 4,
      length: 19,
      detections: [],
    });

    expect(container.querySelector(".feedback-message")?.textContent).toBe(
      "Tekst zmieniony — cofanie niedostępne.",
    );
    expect(container.querySelector(".undo-mask")).toBeNull();
    expect(composerMock.undo).not.toHaveBeenCalled();
  });
});
