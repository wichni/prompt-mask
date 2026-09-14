import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelEvent } from "../src/platform/chromium/messages";

const composerMock = vi.hoisted(() => ({
  disconnect: vi.fn(),
  mask: vi.fn(() => true),
  maskSelection: vi.fn(() => true),
  undo: vi.fn(() => true),
  onEvent: undefined as ((event: PanelEvent) => void) | undefined,
}));
const sidePanelMock = vi.hoisted(() => ({
  close: vi.fn(async () => true),
}));

vi.mock("../src/app/native-composer-client", () => ({
  watchNativeComposer: (onEvent: (event: PanelEvent) => void) => {
    composerMock.onEvent = onEvent;
    return {
      disconnect: composerMock.disconnect,
      mask: composerMock.mask,
      maskSelection: composerMock.maskSelection,
      undo: composerMock.undo,
    };
  },
}));
vi.mock("../src/platform/chromium/side-panel-client", () => ({
  closeCurrentSidePanel: sidePanelMock.close,
}));

import { SidePanel } from "../src/app/SidePanel";

const sessionId = "00000000-0000-4000-8000-000000000001";

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
  composerMock.maskSelection.mockReset();
  composerMock.maskSelection.mockReturnValue(true);
  composerMock.undo.mockReset();
  composerMock.undo.mockReturnValue(true);
  composerMock.onEvent = undefined;
  sidePanelMock.close.mockReset();
  sidePanelMock.close.mockResolvedValue(true);
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
    expect(container.textContent).toContain("Propozycje pojawią się");
    expect(container.querySelector(".bulk-mask")).toBeNull();
    expect(container.querySelector(".feedback")).toBeNull();
    expect(container.querySelector(".status-placeholder")).toBeNull();

    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
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

    expect(container.textContent).toContain("Do sprawdzenia2");
    expect(container.textContent).not.toContain("Pomiń");
    expect(container.textContent).not.toContain("Długość");
    expect(container.querySelector<HTMLButtonElement>(".bulk-mask")?.disabled).toBe(
      false,
    );
    expect(container.querySelector(".review-count")?.getAttribute("aria-live")).toBe(
      "polite",
    );
    expect(container.querySelectorAll("button")).toHaveLength(5);
    expect(
      [...container.querySelectorAll("button")].map((button) => button.textContent),
    ).toEqual([
      "Schowaj",
      "Maskuj wszystkie (2)",
      "Maskuj",
      "Maskuj",
      "Maskuj zaznaczenie",
    ]);
    expect(container.querySelectorAll(".detection-icon svg")).toHaveLength(2);
    expect(
      container.querySelectorAll(".detection-icon svg[aria-hidden='true']"),
    ).toHaveLength(2);
    expect(
      container.querySelector<HTMLButtonElement>(".single-mask")?.ariaLabel,
    ).toBe("Maskuj pozycję 1: E-mail");
  });

  it("does not steal focus after the user moves to another target", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
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
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();

    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
      revision: 2,
      length: 17,
      detections: [],
    });
    emit({
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId,
      requestRevision: 1,
      detectionIds: ["EMAIL:8:29"],
      resultRevision: 2,
      remainingDetections: 0,
      undoOperationId: 1,
    });

    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("does not carry panel focus intent into a page shortcut operation", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
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
    emit({ type: "HOST_STATUS", state: "SEARCHING" });
    emit({ type: "MANUAL_MASK_STARTED", selectionId: 17 });
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId: "00000000-0000-4000-8000-000000000002",
      revision: 1,
      length: 8,
      detections: [],
    });
    emit({
      type: "MANUAL_MASK_RESULT",
      status: "SUCCESS",
      selectionId: 17,
      resultRevision: 1,
      remainingDetections: 0,
      undoOperationId: 2,
    });

    expect(document.activeElement).not.toBe(
      container.querySelector("#review-heading"),
    );
  });

  it("keeps the panel visible when native close fails", async () => {
    sidePanelMock.close.mockResolvedValue(false);

    await act(async () => {
      container.querySelector<HTMLButtonElement>(".hide-panel")?.click();
      await Promise.resolve();
    });

    expect(sidePanelMock.close).toHaveBeenCalledOnce();
    expect(container.querySelector(".hide-error")?.textContent).toContain(
      "Nie udało się schować panelu",
    );
    expect(container.querySelector<HTMLButtonElement>(".hide-panel")?.disabled).toBe(
      false,
    );
  });

  it("shows structured patient-data categories without receiving raw values", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
      revision: 1,
      length: 50,
      detections: [
        {
          id: "PATIENT_NAME:16:28",
          kind: "PATIENT_NAME",
          maskedPreview: "•••",
        },
        {
          id: "PATIENT_ID:41:50",
          kind: "PATIENT_ID",
          maskedPreview: "•••",
        },
        {
          id: "PATIENT_FIRST_NAME:1:4",
          kind: "PATIENT_FIRST_NAME",
          maskedPreview: "•••",
        },
        {
          id: "PATIENT_LAST_NAME:5:13",
          kind: "PATIENT_LAST_NAME",
          maskedPreview: "•••",
        },
        {
          id: "PASSWORD:14:27",
          kind: "PASSWORD",
          maskedPreview: "•••",
        },
        {
          id: "SECRET:28:41",
          kind: "SECRET",
          maskedPreview: "•••",
        },
      ],
    });

    expect(container.textContent).toContain("Imię i nazwisko pacjenta");
    expect(container.textContent).toContain("Identyfikator pacjenta");
    expect(container.textContent).toContain("Imię pacjenta");
    expect(container.textContent).toContain("Nazwisko pacjenta");
    expect(container.textContent).toContain("Hasło");
    expect(container.textContent).toContain("Sekret");
    expect(container.textContent).not.toContain("Żaneta Próba");
    expect(container.textContent).not.toContain("PT-Z19-44");
  });

  it("enables manual masking with zero detections and confirms only after rescan", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
      revision: 1,
      length: 13,
      detections: [],
    });
    const manual = container.querySelector<HTMLButtonElement>(".manual-mask")!;
    expect(manual.disabled).toBe(true);
    expect(container.textContent).toContain(
      "Zaznacz fragment w polu wiadomości.",
    );

    emit({ type: "SELECTION_STATE", state: "READY", selectionId: 6 });
    expect(manual.disabled).toBe(false);
    expect(container.textContent).toContain("Zaznaczenie gotowe do maskowania");
    act(() => {
      manual.click();
      manual.click();
    });
    expect(composerMock.maskSelection).toHaveBeenCalledOnce();
    expect(composerMock.maskSelection).toHaveBeenCalledWith({
      type: "MASK_SELECTION",
      selectionId: 6,
    });
    expect(container.textContent).not.toContain("Zamaskowano zaznaczony");

    emit({ type: "SELECTION_STATE", state: "NONE" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
      revision: 2,
      length: 10,
      detections: [],
    });
    emit({
      type: "MANUAL_MASK_RESULT",
      status: "SUCCESS",
      selectionId: 6,
      resultRevision: 2,
      remainingDetections: 0,
      undoOperationId: 4,
    });

    expect(container.querySelector(".feedback-message")?.textContent).toBe(
      "Zamaskowano zaznaczony fragment.",
    );
    expect(container.querySelector(".undo-mask")).not.toBeNull();
  });

  it("shows progress and success for masking started by the page shortcut", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
      revision: 1,
      length: 13,
      detections: [],
    });
    emit({ type: "SELECTION_STATE", state: "READY", selectionId: 11 });
    emit({ type: "MANUAL_MASK_STARTED", selectionId: 11 });

    expect(
      [...container.querySelectorAll<HTMLButtonElement>("button")].every(
        ({ disabled }) => disabled,
      ),
    ).toBe(true);

    emit({ type: "SELECTION_STATE", state: "NONE" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
      revision: 2,
      length: 8,
      detections: [],
    });
    emit({
      type: "MANUAL_MASK_RESULT",
      status: "SUCCESS",
      selectionId: 11,
      resultRevision: 2,
      remainingDetections: 0,
      undoOperationId: 5,
    });

    expect(container.querySelector(".feedback-message")?.textContent).toBe(
      "Zamaskowano zaznaczony fragment.",
    );
    expect(container.querySelector(".undo-mask")).not.toBeNull();
  });

  it("distinguishes an empty draft from text without findings", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
      revision: 1,
      length: 0,
      detections: [],
    });

    expect(container.textContent).toContain("Zacznij pisać");
    expect(container.textContent).not.toContain("Brak wykryć");
    expect(container.querySelector(".bulk-mask")).toBeNull();

    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
      revision: 2,
      length: 16,
      detections: [],
    });

    expect(container.textContent).not.toContain("Zacznij pisać");
    expect(container.textContent).toContain("Brak wykryć");
  });

  it("shows the actual connection error without enabling actions", () => {
    emit({
      type: "HOST_STATUS",
      state: "ERROR",
      error: "UNSUPPORTED_TAB",
    });

    expect(container.textContent).toContain("Analiza niedostępna");
    expect(container.textContent).toContain(
      "Otwórz aktywną kartę https://chatgpt.com.",
    );
    expect(container.querySelector(".review-count")?.textContent).toBe("—");
    expect(container.querySelector(".bulk-mask")).toBeNull();
    expect(container.querySelector<HTMLButtonElement>(".manual-mask")?.disabled).toBe(
      true,
    );
  });

  it("announces success only after the updated snapshot and result", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
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
      sessionId,
      revision: 1,
      detectionIds: ["EMAIL:8:29"],
    });

    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
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
      sessionId,
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
      sessionId,
      revision: 1,
      length: 12,
      detections: [],
    });
    expect(container.textContent).toContain("Brak wykryć");
    expect(container.textContent).toContain(
      "Nie znaleziono obsługiwanych danych. Sprawdź też pozostałą treść.",
    );

    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
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

  it("sends the visible set once without presenting stale findings", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
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
    const bulkButton = container.querySelector<HTMLButtonElement>(".bulk-mask")!;

    act(() => {
      bulkButton.click();
      bulkButton.click();
    });

    expect(composerMock.mask).toHaveBeenCalledOnce();
    expect(composerMock.mask).toHaveBeenCalledWith({
      type: "MASK_DETECTIONS",
      sessionId,
      revision: 1,
      detectionIds: ["EMAIL:8:29", "PHONE:34:49"],
    });
    expect(
      [...container.querySelectorAll<HTMLButtonElement>("button")].every(
        ({ disabled }) => disabled,
      ),
    ).toBe(true);
    expect(container.textContent).toContain("Maskowanie…");
    expect(container.textContent).toContain("Aktualizuję analizę…");
    expect(container.textContent).not.toContain("a•••@e•••.com");
    expect(container.querySelector(".bulk-mask")).toBeNull();

    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
      revision: 2,
      length: 24,
      detections: [],
    });
    emit({
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId,
      requestRevision: 1,
      detectionIds: ["EMAIL:8:29", "PHONE:34:49"],
      resultRevision: 2,
      remainingDetections: 0,
      undoOperationId: 1,
    });

    expect(container.querySelector(".feedback")?.textContent).toContain(
      "Zamaskowane fragmenty: 2.",
    );
    expect(container.textContent).toContain("Do sprawdzenia0");
    expect(container.querySelector(".bulk-mask")).toBeNull();
    expect(document.activeElement).toBe(
      container.querySelector("#review-heading"),
    );
  });

  it("shows a distinct information status after a stale operation", () => {
    emit({ type: "HOST_STATUS", state: "READY" });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
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
      sessionId,
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
      sessionId,
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
      sessionId,
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
      sessionId,
      revision: 2,
      length: 17,
      detections: [],
    });
    emit({
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId,
      requestRevision: 1,
      detectionIds: ["EMAIL:8:29"],
      resultRevision: 2,
      remainingDetections: 0,
      undoOperationId: 7,
    });
    const undo = container.querySelector<HTMLButtonElement>(".undo-mask")!;

    expect(undo.textContent).toBe("Cofnij");
    expect(container.querySelector(".hide-warning")?.textContent).toBe(
      "Schowanie kończy możliwość cofnięcia.",
    );
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
      sessionId,
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
      sessionId,
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
      sessionId,
      revision: 2,
      length: 17,
      detections: [],
    });
    emit({
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId,
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
      sessionId,
      revision: 3,
      length: 18,
      detections: [],
    });
    emit({
      type: "ANALYSIS_SNAPSHOT",
      sessionId,
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
