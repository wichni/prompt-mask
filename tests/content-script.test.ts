import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PANEL_CONTENT_PORT,
  type AnalysisSnapshot,
  type ManualMaskResult,
  type MaskResult,
  type PanelEvent,
  type SelectionState,
  type UndoResult,
} from "../src/platform/chromium/messages";

interface ListenerSlot<T> {
  listener?: T;
}

const runtimeId = "prompt-mask-test";
const onConnect: ListenerSlot<(port: chrome.runtime.Port) => void> = {};

const createPort = (senderUrl: string) => {
  const message: ListenerSlot<(value: unknown) => void> = {};
  const disconnect: ListenerSlot<() => void> = {};
  return {
    name: PANEL_CONTENT_PORT,
    sender: { id: runtimeId, url: senderUrl },
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onMessage: {
      addListener: (listener: (value: unknown) => void) => {
        message.listener = listener;
      },
    },
    onDisconnect: {
      addListener: (listener: () => void) => {
        disconnect.listener = listener;
      },
    },
    fireMessage: (value: unknown) => message.listener?.(value),
    fireDisconnect: () => disconnect.listener?.(),
  };
};

const snapshots = (port: ReturnType<typeof createPort>): AnalysisSnapshot[] =>
  port.postMessage.mock.calls
    .map(([message]) => message as unknown)
    .filter(
      (message): message is AnalysisSnapshot =>
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "ANALYSIS_SNAPSHOT",
    );

const maskResults = (port: ReturnType<typeof createPort>): MaskResult[] =>
  port.postMessage.mock.calls
    .map(([message]) => message as unknown)
    .filter(
      (message): message is MaskResult =>
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "MASK_RESULT",
    );

const manualMaskResults = (
  port: ReturnType<typeof createPort>,
): ManualMaskResult[] =>
  events(port).filter(
    (message): message is ManualMaskResult =>
      message.type === "MANUAL_MASK_RESULT",
  );

const selectionStates = (
  port: ReturnType<typeof createPort>,
): SelectionState[] =>
  events(port).filter(
    (message): message is SelectionState => message.type === "SELECTION_STATE",
  );

const selectTextareaRange = (
  textarea: HTMLTextAreaElement,
  start: number,
  end: number,
  direction: "forward" | "backward" = "forward",
): void => {
  textarea.focus();
  textarea.setSelectionRange(start, end, direction);
  textarea.dispatchEvent(new Event("select", { bubbles: true }));
};

const events = (port: ReturnType<typeof createPort>): PanelEvent[] =>
  port.postMessage.mock.calls.map(([message]) => message as PanelEvent);

const undoResults = (port: ReturnType<typeof createPort>): UndoResult[] =>
  events(port).filter(
    (message): message is UndoResult => message.type === "UNDO_RESULT",
  );

beforeEach(async () => {
  vi.resetModules();
  document
    .querySelectorAll("#prompt-mask-manual-shortcut")
    .forEach((element) => element.remove());
  document.body.innerHTML = '<textarea id="mobile-composer-prompt"></textarea>';
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal(
    "MutationObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
    },
  );
  vi.stubGlobal("chrome", {
    runtime: {
      id: runtimeId,
      getURL: (path: string) => `chrome-extension://${runtimeId}/${path}`,
      onConnect: {
        addListener: (listener: (port: chrome.runtime.Port) => void) => {
          onConnect.listener = listener;
        },
      },
    },
  });
  await import("../src/providers/chatgpt/content-script");
});

describe("native composer analysis", () => {
  it("starts only for the trusted side panel", () => {
    const untrusted = createPort("chrome-extension://other/side-panel.html");

    onConnect.listener?.(untrusted as unknown as chrome.runtime.Port);

    expect(untrusted.disconnect).toHaveBeenCalledOnce();
    expect(untrusted.postMessage).not.toHaveBeenCalled();
  });

  it("reports local findings without forwarding the raw draft", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "PESEL 02070803628, anna.test@example.com, +48 500 600 700";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);

    onConnect.listener?.(panel as unknown as chrome.runtime.Port);

    const snapshot = snapshots(panel).at(-1);
    expect(snapshot?.detections.map(({ kind }) => kind)).toEqual([
      "PESEL",
      "EMAIL",
      "PHONE",
    ]);
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "anna.test@example.com",
    );
  });

  it("masks only an assigned email value and restores the exact log on undo", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original = "email=ada.one@example.net; status=422";
    textarea.value = original;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    expect(snapshot.detections).toEqual([
      expect.objectContaining({ kind: "EMAIL", maskedPreview: "a•••@e•••.net" }),
    ]);
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "ada.one@example.net",
    );

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(textarea.value).toBe("email=[EMAIL_1]; status=422");
    expect(snapshots(panel).at(-1)?.detections).toEqual([]);
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe(original);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("masks structured patient fields without forwarding their values", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value =
      '{"patientName":"Żaneta Próba","patientFirstName":"Iga","patientLastName":"Modelowa","patientId":"PT-Z19-44","password":"P@ss-demo-7!Q","error":"E_17"}';
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    expect(snapshot.detections.map(({ kind }) => kind)).toEqual([
      "PATIENT_NAME",
      "PATIENT_FIRST_NAME",
      "PATIENT_LAST_NAME",
      "PATIENT_ID",
      "PASSWORD",
    ]);
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "Żaneta Próba",
    );
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain("Iga");
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "Modelowa",
    );
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "PT-Z19-44",
    );
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "P@ss-demo-7!Q",
    );

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(textarea.value).toBe(
      '{"patientName":"[PATIENT_NAME_1]","patientFirstName":"[PATIENT_FIRST_NAME_1]","patientLastName":"[PATIENT_LAST_NAME_1]","patientId":"[PATIENT_ID_1]","password":"[PASSWORD_1]","error":"E_17"}',
    );
    expect(() => JSON.parse(textarea.value)).not.toThrow();
  });

  it("masks contextual secrets without forwarding them and restores them on undo", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original =
      "client_secret=demo-client-Z8x!; Authorization: Bearer demo.jwt.token-7X";
    textarea.value = original;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    expect(snapshot.detections).toEqual([
      expect.objectContaining({ kind: "SECRET", maskedPreview: "•••" }),
      expect.objectContaining({ kind: "SECRET", maskedPreview: "•••" }),
    ]);
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "demo-client-Z8x!",
    );
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "demo.jwt.token-7X",
    );

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(textarea.value).toBe(
      "client_secret=[SECRET_1]; Authorization: Bearer [SECRET_2]",
    );
    expect(snapshots(panel).at(-1)?.detections).toEqual([]);
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe(original);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("preserves quoted Bearer syntax through masking, rescan and undo", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original =
      'curl -H "Authorization: Bearer demo.jwt.token-7X" https://example.invalid';
    textarea.value = original;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    expect(snapshot.detections).toEqual([
      expect.objectContaining({ kind: "SECRET", maskedPreview: "•••" }),
    ]);
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "demo.jwt.token-7X",
    );

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(textarea.value).toBe(
      'curl -H "Authorization: Bearer [SECRET_1]" https://example.invalid',
    );
    expect(snapshots(panel).at(-1)?.detections).toEqual([]);
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe(original);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("preserves email= before a local part containing equals and restores it", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original = "email=qa=demo@example.com status=422";
    textarea.value = original;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    expect(snapshot.detections).toEqual([
      expect.objectContaining({ kind: "EMAIL", maskedPreview: "q•••@e•••.com" }),
    ]);
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "qa=demo@example.com",
    );

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(textarea.value).toBe("email=[EMAIL_1] status=422");
    expect(snapshots(panel).at(-1)?.detections).toEqual([]);
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe(original);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("bulk-masks quoted Bearer and assigned email without leaking values", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original = [
      'curl -H "Authorization: Bearer demo.jwt.token-7X" https://example.invalid',
      "email=qa=demo@example.com status=422",
    ].join("\n");
    textarea.value = original;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    expect(snapshot.detections.map(({ kind }) => kind)).toEqual([
      "SECRET",
      "EMAIL",
    ]);
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "demo.jwt.token-7X",
    );
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "qa=demo@example.com",
    );

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(textarea.value).toBe(
      [
        'curl -H "Authorization: Bearer [SECRET_1]" https://example.invalid',
        "email=[EMAIL_1] status=422",
      ].join("\n"),
    );
    expect(snapshots(panel).at(-1)?.detections).toEqual([]);
  });

  it("bulk-masks contextual PESEL fields and restores them on undo", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original = [
      "pesel=02070803627; status=CHECKSUM_INVALID",
      '{"PESEL":"02323203627","status":"INVALID_BIRTH_DATE"}',
    ].join("\n");
    textarea.value = original;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    expect(snapshot.detections.map(({ kind }) => kind)).toEqual([
      "PESEL",
      "PESEL",
    ]);
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "02070803627",
    );
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "02323203627",
    );

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(textarea.value).toBe(
      [
        "pesel=[PESEL_1]; status=CHECKSUM_INVALID",
        '{"PESEL":"[PESEL_2]","status":"INVALID_BIRTH_DATE"}',
      ].join("\n"),
    );
    expect(snapshots(panel).at(-1)?.detections).toEqual([]);
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe(original);
    expect(snapshots(panel).at(-1)?.detections).toHaveLength(2);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("masks a complete JSON password containing a PESEL and restores it on undo", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original = '{"password":"demo:02070803628:tail"}';
    textarea.value = original;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    expect(snapshot.detections).toEqual([
      expect.objectContaining({ kind: "PASSWORD", maskedPreview: "•••" }),
    ]);
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "02070803628",
    );

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(textarea.value).toBe('{"password":"[PASSWORD_1]"}');
    expect(snapshots(panel).at(-1)?.detections).toEqual([]);
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe(original);
    expect(snapshots(panel).at(-1)?.detections).toEqual([
      expect.objectContaining({ kind: "PASSWORD", maskedPreview: "•••" }),
    ]);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("masks a bare password assignment once and restores it on undo", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original = "password=Tmp!Pass-44; status=401";
    textarea.value = original;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    expect(snapshot.detections).toEqual([
      expect.objectContaining({ kind: "PASSWORD", maskedPreview: "•••" }),
    ]);
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "Tmp!Pass-44",
    );

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(textarea.value).toBe("password=[PASSWORD_1]; status=401");
    expect(snapshots(panel).at(-1)?.detections).toEqual([]);
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe(original);
    expect(snapshots(panel).at(-1)?.detections).toEqual([
      expect.objectContaining({ kind: "PASSWORD", maskedPreview: "•••" }),
    ]);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("rescans the native field after a user input event", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);

    textarea.value = "Kontakt anna.test@example.com";
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));

    expect(snapshots(panel).at(-1)?.detections).toEqual([
      expect.objectContaining({ kind: "EMAIL" }),
    ]);
  });

  it("invalidates panel state when ChatGPT replaces the composer", () => {
    const original = document.querySelector<HTMLTextAreaElement>("textarea")!;
    original.value = "Kontakt anna.test@example.com";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const previousEventCount = panel.postMessage.mock.calls.length;

    const replacement = document.createElement("textarea");
    replacement.id = "mobile-composer-prompt";
    replacement.value = "Telefon +48 500 600 700";
    original.replaceWith(replacement);
    replacement.dispatchEvent(new InputEvent("input", { bubbles: true }));

    const newEvents = panel.postMessage.mock.calls
      .slice(previousEventCount)
      .map(([event]) => event);
    expect(newEvents).toEqual([
      { type: "HOST_STATUS", state: "SEARCHING" },
      { type: "HOST_STATUS", state: "READY" },
      expect.objectContaining({
        type: "ANALYSIS_SNAPSHOT",
        revision: 1,
        detections: [expect.objectContaining({ kind: "PHONE" })],
      }),
    ]);
  });

  it("rejects a delayed decision after replacing the composer", () => {
    const original = document.querySelector<HTMLTextAreaElement>("textarea")!;
    original.value = "500600700";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const previous = snapshots(panel).at(-1)!;
    const delayedCommand = {
      type: "MASK_DETECTIONS",
      sessionId: previous.sessionId,
      revision: previous.revision,
      detectionIds: previous.detections.map(({ id }) => id),
    };

    const replacement = document.createElement("textarea");
    replacement.id = "mobile-composer-prompt";
    replacement.value = "600700800";
    original.replaceWith(replacement);
    replacement.dispatchEvent(new InputEvent("input", { bubbles: true }));
    const current = snapshots(panel).at(-1)!;

    expect(current.revision).toBe(previous.revision);
    expect(current.detections.map(({ id }) => id)).toEqual(
      previous.detections.map(({ id }) => id),
    );
    expect(current.sessionId).not.toBe(previous.sessionId);

    panel.fireMessage(delayedCommand);

    expect(replacement.value).toBe("600700800");
    expect(maskResults(panel).at(-1)).toMatchObject({
      status: "ERROR",
      sessionId: previous.sessionId,
      error: "STALE_TEXT",
    });
  });

  it("rejects a delayed decision after the conversation URL changes", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "500600700";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const previous = snapshots(panel).at(-1)!;

    window.history.pushState({}, "", "/c/next-synthetic-conversation");
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
    const current = snapshots(panel).at(-1)!;
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: previous.sessionId,
      revision: previous.revision,
      detectionIds: previous.detections.map(({ id }) => id),
    });

    expect(current.sessionId).not.toBe(previous.sessionId);
    expect(textarea.value).toBe("500600700");
    expect(maskResults(panel).at(-1)).toMatchObject({
      status: "ERROR",
      sessionId: previous.sessionId,
      error: "STALE_TEXT",
    });
  });

  it("rejects a decision created before reconnecting the panel", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "500600700";
    const firstPanel = createPort(
      `chrome-extension://${runtimeId}/side-panel.html`,
    );
    onConnect.listener?.(firstPanel as unknown as chrome.runtime.Port);
    const previous = snapshots(firstPanel).at(-1)!;
    firstPanel.fireDisconnect();

    const reconnectedPanel = createPort(
      `chrome-extension://${runtimeId}/side-panel.html`,
    );
    onConnect.listener?.(reconnectedPanel as unknown as chrome.runtime.Port);
    const current = snapshots(reconnectedPanel).at(-1)!;
    reconnectedPanel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: previous.sessionId,
      revision: previous.revision,
      detectionIds: previous.detections.map(({ id }) => id),
    });

    expect(current.sessionId).not.toBe(previous.sessionId);
    expect(textarea.value).toBe("500600700");
    expect(maskResults(reconnectedPanel).at(-1)).toMatchObject({
      status: "ERROR",
      sessionId: previous.sessionId,
      error: "STALE_TEXT",
    });
  });

  it("confirms masking only after rescanning the changed textarea", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Kontakt anna.test@example.com lub +48 500 600 700";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;
    const email = snapshot.detections.find(({ kind }) => kind === "EMAIL")!;

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: [email.id],
    });

    expect(textarea.value).toBe("Kontakt [EMAIL_1] lub +48 500 600 700");
    expect(snapshots(panel).at(-1)?.detections).toHaveLength(1);
    expect(snapshots(panel).at(-1)?.detections[0]?.kind).toBe("PHONE");
    expect(maskResults(panel).at(-1)).toEqual({
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId: snapshot.sessionId,
      requestRevision: snapshot.revision,
      detectionIds: [email.id],
      resultRevision: snapshot.revision + 1,
      remainingDetections: 1,
      undoOperationId: 1,
    });
  });

  it("masks repeated findings in one write and preserves existing placeholders", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = [
      "Wcześniej [PHONE_3].",
      "Numery: 500600700 | 500600700",
      "🙂 500600700, 500600700.",
    ].join("\n");
    const inputListener = vi.fn();
    textarea.addEventListener("input", inputListener);
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    expect(snapshot.detections).toHaveLength(4);
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(textarea.value).toBe(
      [
        "Wcześniej [PHONE_3].",
        "Numery: [PHONE_4] | [PHONE_5]",
        "🙂 [PHONE_6], [PHONE_7].",
      ].join("\n"),
    );
    expect(inputListener).toHaveBeenCalledOnce();
    expect(maskResults(panel).at(-1)).toEqual({
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId: snapshot.sessionId,
      requestRevision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
      resultRevision: snapshot.revision + 1,
      remainingDetections: 0,
      undoOperationId: 1,
    });
  });

  it("rejects an old bulk plan after an unreported text change", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Kontakt anna.test@example.com i 500600700";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    textarea.value = "Nowy tekst z numerem 600700800";
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(textarea.value).toBe("Nowy tekst z numerem 600700800");
    expect(snapshots(panel).at(-1)?.detections).toEqual([
      expect.objectContaining({ kind: "PHONE" }),
    ]);
    expect(maskResults(panel).at(-1)).toEqual({
      type: "MASK_RESULT",
      status: "ERROR",
      sessionId: snapshot.sessionId,
      requestRevision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
      error: "STALE_TEXT",
    });
  });

  it("rejects a multi-item command that is not the complete visible set", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value =
      "PESEL 02070803628, anna.test@example.com, telefon 500600700";
    const inputListener = vi.fn();
    textarea.addEventListener("input", inputListener);
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;
    const partialIds = snapshot.detections.slice(0, 2).map(({ id }) => id);

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: partialIds,
    });

    expect(inputListener).not.toHaveBeenCalled();
    expect(textarea.value).toContain("anna.test@example.com");
    expect(maskResults(panel).at(-1)).toEqual({
      type: "MASK_RESULT",
      status: "ERROR",
      sessionId: snapshot.sessionId,
      requestRevision: snapshot.revision,
      detectionIds: partialIds,
      error: "STALE_TEXT",
    });
  });

  it("does not write twice when the same bulk command arrives again", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Kontakt anna.test@example.com i 500600700";
    const inputListener = vi.fn();
    textarea.addEventListener("input", inputListener);
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;
    const command = {
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    };

    panel.fireMessage(command);
    panel.fireMessage(command);

    expect(inputListener).toHaveBeenCalledOnce();
    expect(maskResults(panel).map(({ status }) => status)).toEqual([
      "SUCCESS",
      "ERROR",
    ]);
    expect(maskResults(panel).at(-1)).toMatchObject({
      status: "ERROR",
      error: "STALE_TEXT",
    });
  });

  it("reports a stale masking decision as a failure", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "PESEL 02070803628";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision + 1,
      detectionIds: [snapshot.detections[0]!.id],
    });

    expect(textarea.value).toBe("PESEL 02070803628");
    expect(maskResults(panel).at(-1)).toEqual({
      type: "MASK_RESULT",
      status: "ERROR",
      sessionId: snapshot.sessionId,
      requestRevision: snapshot.revision + 1,
      detectionIds: [snapshot.detections[0]!.id],
      error: "STALE_TEXT",
    });
  });

  it("masks only the selected repeated fragment and undoes the manual operation", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original =
      "Jan Testowy zgłosił błąd. Jan Testowy czeka 🙂\nna odpowiedź.";
    textarea.value = original;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    textarea.focus();
    textarea.setSelectionRange(0, "Jan Testowy".length);
    textarea.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    const firstSelection = selectionStates(panel).at(-1);
    const start = original.lastIndexOf("Jan Testowy");
    textarea.setSelectionRange(start, start + "Jan Testowy".length, "backward");
    textarea.dispatchEvent(
      new KeyboardEvent("keyup", { bubbles: true, key: "ArrowLeft", shiftKey: true }),
    );
    const selection = selectionStates(panel).at(-1);

    expect(selection).toMatchObject({
      type: "SELECTION_STATE",
      state: "READY",
    });
    expect(firstSelection).toMatchObject({ state: "READY" });
    if (firstSelection?.state !== "READY") throw new Error("Expected selection");
    expect(selection).not.toEqual(firstSelection);
    const shortcut = document.querySelector<HTMLDivElement>(
      "#prompt-mask-manual-shortcut",
    )!;
    expect(shortcut.style.display).toBe("block");
    const selectionEventCount = selectionStates(panel).length;
    shortcut.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, composed: true }),
    );
    expect(selectionStates(panel)).toHaveLength(selectionEventCount);
    expect(JSON.stringify(panel.postMessage.mock.calls)).not.toContain(
      "Jan Testowy",
    );
    if (selection?.state !== "READY") throw new Error("Expected selection");
    panel.fireMessage({
      type: "MASK_SELECTION",
      selectionId: selection.selectionId,
    });

    expect(textarea.value).toBe(
      "Jan Testowy zgłosił błąd. [DANE_1] czeka 🙂\nna odpowiedź.",
    );
    expect(shortcut.style.display).toBe("none");
    expect(manualMaskResults(panel).at(-1)).toMatchObject({
      status: "SUCCESS",
      selectionId: selection.selectionId,
      remainingDetections: 0,
    });
    const result = manualMaskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected manual success");
    panel.fireMessage({
      type: "MASK_SELECTION",
      selectionId: selection.selectionId,
    });
    expect(textarea.value).toBe(
      "Jan Testowy zgłosił błąd. [DANE_1] czeka 🙂\nna odpowiedź.",
    );
    expect(manualMaskResults(panel).map(({ status }) => status)).toEqual([
      "SUCCESS",
      "ERROR",
    ]);
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe(original);
    expect(selectionStates(panel).at(-1)).toEqual({
      type: "SELECTION_STATE",
      state: "NONE",
    });
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("preserves paragraph structure while manually masking and undoing", () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true" role="textbox"><p>Jan Testowy</p><p>Opis przypadku</p></div>';
    const editable = document.querySelector<HTMLElement>("#prompt-textarea")!;
    const originalHtml = editable.innerHTML;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const range = document.createRange();
    range.selectNodeContents(editable.firstElementChild!);
    const domSelection = window.getSelection()!;
    domSelection.removeAllRanges();
    domSelection.addRange(range);
    editable.firstElementChild!.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true }),
    );
    const selection = selectionStates(panel).at(-1);
    if (selection?.state !== "READY") throw new Error("Expected selection");

    panel.fireMessage({
      type: "MASK_SELECTION",
      selectionId: selection.selectionId,
    });

    expect(editable.querySelectorAll("p")).toHaveLength(2);
    expect(editable.firstElementChild?.textContent).toBe("[DANE_1]");
    expect(editable.lastElementChild?.textContent).toBe("Opis przypadku");
    const result = manualMaskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected manual success");

    panel.fireMessage({
      type: "UNDO_MASK",
      operationId: result.undoOperationId,
    });

    expect(editable.innerHTML).toBe(originalHtml);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("masks across a paragraph boundary and restores every boundary on undo", () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true" role="textbox"><p>Jan Testowy</p><p>Opis przypadku</p><p>Dalej</p></div>';
    const editable = document.querySelector<HTMLElement>("#prompt-textarea")!;
    const originalHtml = editable.innerHTML;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const range = document.createRange();
    range.setStart(editable.children[0]!.firstChild!, 4);
    range.setEnd(editable.children[1]!.firstChild!, 4);
    const domSelection = window.getSelection()!;
    domSelection.removeAllRanges();
    domSelection.addRange(range);
    editable.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    const selection = selectionStates(panel).at(-1);
    if (selection?.state !== "READY") throw new Error("Expected selection");

    panel.fireMessage({
      type: "MASK_SELECTION",
      selectionId: selection.selectionId,
    });

    expect(editable.innerHTML).toBe(
      "<p>Jan [DANE_1] przypadku</p><p>Dalej</p>",
    );
    const result = manualMaskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected manual success");
    panel.fireMessage({
      type: "UNDO_MASK",
      operationId: result.undoOperationId,
    });

    expect(editable.innerHTML).toBe(originalHtml);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("preserves paragraph structure for a bulk mask and undo", () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true" role="textbox"><p>Numer 500600700</p><p>Drugi 600700800</p></div>';
    const editable = document.querySelector<HTMLElement>("#prompt-textarea")!;
    const originalHtml = editable.innerHTML;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(editable.querySelectorAll("p")).toHaveLength(2);
    expect(editable.children[0]?.textContent).toBe("Numer [PHONE_1]");
    expect(editable.children[1]?.textContent).toBe("Drugi [PHONE_2]");
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");

    panel.fireMessage({
      type: "UNDO_MASK",
      operationId: result.undoOperationId,
    });

    expect(editable.innerHTML).toBe(originalHtml);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("masks the only visible editable candidate and leaves a hidden match unchanged", () => {
    document.body.innerHTML = [
      '<div id="mobile-composer-prompt" contenteditable="true" hidden><p>500600700</p></div>',
      '<form><textarea id="actual-editor">600700800</textarea></form>',
    ].join("");
    const hidden = document.querySelector<HTMLElement>(
      "#mobile-composer-prompt",
    )!;
    const actual = document.querySelector<HTMLTextAreaElement>("#actual-editor")!;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: snapshot.detections.map(({ id }) => id),
    });

    expect(hidden.textContent).toBe("500600700");
    expect(actual.value).toBe("[PHONE_1]");
    expect(maskResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("does not revive a selection after editing back to identical text", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original = "Klient Testowy czeka";
    textarea.value = original;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    selectTextareaRange(textarea, 0, "Klient Testowy".length);
    const selection = selectionStates(panel).at(-1);
    if (selection?.state !== "READY") throw new Error("Expected selection");

    textarea.value = `${original}.`;
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
    textarea.value = original;
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
    panel.fireMessage({
      type: "MASK_SELECTION",
      selectionId: selection.selectionId,
    });

    expect(textarea.value).toBe(original);
    expect(manualMaskResults(panel).at(-1)).toEqual({
      type: "MANUAL_MASK_RESULT",
      status: "ERROR",
      selectionId: selection.selectionId,
      error: "STALE_SELECTION",
    });
  });

  it("rejects a selection after a structure-only DOM change", () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true" role="textbox"><p>Jan Testowy</p><p>Opis</p></div>';
    const editable = document.querySelector<HTMLElement>("#prompt-textarea")!;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const range = document.createRange();
    range.selectNodeContents(editable.firstElementChild!);
    const domSelection = window.getSelection()!;
    domSelection.removeAllRanges();
    domSelection.addRange(range);
    editable.firstElementChild!.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true }),
    );
    const selection = selectionStates(panel).at(-1);
    if (selection?.state !== "READY") throw new Error("Expected selection");

    editable.firstElementChild!.innerHTML = "<strong>Jan Testowy</strong>";
    panel.fireMessage({
      type: "MASK_SELECTION",
      selectionId: selection.selectionId,
    });

    expect(editable.innerHTML).toBe(
      "<p><strong>Jan Testowy</strong></p><p>Opis</p>",
    );
    expect(manualMaskResults(panel).at(-1)).toEqual({
      type: "MANUAL_MASK_RESULT",
      status: "ERROR",
      selectionId: selection.selectionId,
      error: "STALE_SELECTION",
    });
  });

  it("rejects whitespace and generated placeholders without blocking JSON brackets", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "  [EMAIL_1] [JSON]";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);

    selectTextareaRange(textarea, 0, 2);
    expect(selectionStates(panel)).toHaveLength(0);
    selectTextareaRange(textarea, 3, 10);
    expect(selectionStates(panel).at(-1)).toEqual({
      type: "SELECTION_STATE",
      state: "INVALID",
      reason: "PLACEHOLDER_OVERLAP",
    });
    const jsonStart = textarea.value.indexOf("[JSON]");
    selectTextareaRange(textarea, jsonStart, jsonStart + "[JSON]".length);
    expect(selectionStates(panel).at(-1)).toMatchObject({ state: "READY" });

    const history = document.createElement("p");
    history.textContent = "Treść historii";
    document.body.append(history);
    history.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    expect(selectionStates(panel).at(-1)).toEqual({
      type: "SELECTION_STATE",
      state: "NONE",
    });

    selectTextareaRange(textarea, jsonStart, jsonStart + "[JSON]".length);
    textarea.setSelectionRange(jsonStart, jsonStart);
    textarea.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    expect(selectionStates(panel).at(-1)).toEqual({
      type: "SELECTION_STATE",
      state: "NONE",
    });
  });

  it("preserves a concurrent user edit when a manual write cannot be confirmed", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Klient Testowy czeka";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    selectTextareaRange(textarea, 0, "Klient Testowy".length);
    const selection = selectionStates(panel).at(-1);
    if (selection?.state !== "READY") throw new Error("Expected selection");
    textarea.addEventListener(
      "input",
      () => {
        textarea.value = "Nowsza edycja użytkownika";
      },
      { once: true },
    );

    panel.fireMessage({
      type: "MASK_SELECTION",
      selectionId: selection.selectionId,
    });

    expect(textarea.value).toBe("Nowsza edycja użytkownika");
    expect(manualMaskResults(panel).at(-1)).toEqual({
      type: "MANUAL_MASK_RESULT",
      status: "ERROR",
      selectionId: selection.selectionId,
      error: "MASK_FAILED",
    });
  });

  it("does not write when a manual placeholder would exceed the text limit", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original = "a".repeat(12_000);
    textarea.value = original;
    const inputListener = vi.fn();
    textarea.addEventListener("input", inputListener);
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    selectTextareaRange(textarea, 0, 1);
    const selection = selectionStates(panel).at(-1);
    if (selection?.state !== "READY") throw new Error("Expected selection");

    panel.fireMessage({
      type: "MASK_SELECTION",
      selectionId: selection.selectionId,
    });

    expect(textarea.value).toBe(original);
    expect(inputListener).not.toHaveBeenCalled();
    expect(manualMaskResults(panel).at(-1)).toMatchObject({
      status: "ERROR",
      error: "MASK_FAILED",
    });
  });

  it("invalidates a manual selection when another mask runs and limits repeats", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Klient Testowy anna.test@example.com";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;
    selectTextareaRange(textarea, 0, "Klient Testowy".length);
    const selection = selectionStates(panel).at(-1);
    if (selection?.state !== "READY") throw new Error("Expected selection");

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      detectionIds: [snapshot.detections[0]!.id],
    });
    panel.fireMessage({
      type: "MASK_SELECTION",
      selectionId: selection.selectionId,
    });
    panel.fireMessage({
      type: "MASK_SELECTION",
      selectionId: selection.selectionId,
    });

    expect(textarea.value).toBe("Klient Testowy [EMAIL_1]");
    expect(manualMaskResults(panel).map(({ status }) => status)).toEqual([
      "ERROR",
      "ERROR",
    ]);
    expect(selectionStates(panel)).toContainEqual({
      type: "SELECTION_STATE",
      state: "NONE",
    });
  });

  it("undoes one mask exactly once and reanalyzes the restored draft", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original = "Kontakt anna.test@example.com 🙂\nTelefon 500600700.";
    textarea.value = original;
    textarea.setSelectionRange(4, 4);
    const inputListener = vi.fn();
    textarea.addEventListener("input", inputListener);
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    const email = initial.detections.find(({ kind }) => kind === "EMAIL")!;

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: [email.id],
    });
    const maskResult = maskResults(panel).at(-1)!;
    if (maskResult.status !== "SUCCESS") throw new Error("Expected mask success");
    const operationId = maskResult.undoOperationId;
    panel.fireMessage({ type: "UNDO_MASK", operationId });
    panel.fireMessage({ type: "UNDO_MASK", operationId });

    expect(textarea.value).toBe(original);
    expect(textarea.selectionStart).toBe(4);
    expect(inputListener).toHaveBeenCalledTimes(2);
    expect(snapshots(panel).at(-1)?.detections.map(({ kind }) => kind)).toEqual([
      "EMAIL",
      "PHONE",
    ]);
    expect(undoResults(panel).map(({ status }) => status)).toEqual([
      "SUCCESS",
      "ERROR",
    ]);
  });

  it("undoes a bulk mask as one operation", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const original = "E-mail anna.test@example.com, telefon 500600700";
    textarea.value = original;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: initial.detections.map(({ id }) => id),
    });
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe(original);
    expect(snapshots(panel).at(-1)?.detections).toHaveLength(2);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("replaces the previous undo record after another confirmed mask", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "anna.test@example.com 500600700";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    const email = initial.detections.find(({ kind }) => kind === "EMAIL")!;

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: [email.id],
    });
    const afterEmail = snapshots(panel).at(-1)!;
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: afterEmail.sessionId,
      revision: afterEmail.revision,
      detectionIds: [afterEmail.detections[0]!.id],
    });
    const phoneResult = maskResults(panel).at(-1)!;
    if (phoneResult.status !== "SUCCESS") throw new Error("Expected mask success");
    panel.fireMessage({
      type: "UNDO_MASK",
      operationId: phoneResult.undoOperationId,
    });

    expect(textarea.value).toBe("[EMAIL_1] 500600700");
    expect(snapshots(panel).at(-1)?.detections).toEqual([
      expect.objectContaining({ kind: "PHONE" }),
    ]);
  });

  it("invalidates undo after editing even if the text later becomes identical", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Kontakt anna.test@example.com";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: [initial.detections[0]!.id],
    });
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");
    const masked = textarea.value;

    textarea.value = `${masked} dopisek`;
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
    textarea.value = masked;
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe(masked);
    expect(
      events(panel).filter(({ type }) => type === "UNDO_INVALIDATED"),
    ).toEqual([
      {
        type: "UNDO_INVALIDATED",
        operationId: result.undoOperationId,
        reason: "DRAFT_CHANGED",
      },
    ]);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "ERROR" });
  });

  it("does not undo over a structure-only DOM change", () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true" role="textbox"><p>Kontakt anna.test@example.com</p><p>Opis</p></div>';
    const editable = document.querySelector<HTMLElement>("#prompt-textarea")!;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: [initial.detections[0]!.id],
    });
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");

    editable.firstElementChild!.innerHTML =
      "Kontakt <strong>[EMAIL_1]</strong>";
    panel.fireMessage({
      type: "UNDO_MASK",
      operationId: result.undoOperationId,
    });

    expect(editable.innerHTML).toBe(
      "<p>Kontakt <strong>[EMAIL_1]</strong></p><p>Opis</p>",
    );
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "ERROR" });
  });

  it("does not confirm a write after a synchronous structure-only reaction", () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true" role="textbox"><p>Kontakt anna.test@example.com</p><p>Opis</p></div>';
    const editable = document.querySelector<HTMLElement>("#prompt-textarea")!;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    editable.addEventListener(
      "input",
      () => {
        editable.firstElementChild!.innerHTML =
          "Kontakt <strong>[EMAIL_1]</strong>";
      },
      { once: true },
    );

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: [initial.detections[0]!.id],
    });

    expect(editable.innerHTML).toBe(
      "<p>Kontakt <strong>[EMAIL_1]</strong></p><p>Opis</p>",
    );
    expect(maskResults(panel).at(-1)).toMatchObject({
      status: "ERROR",
      error: "MASK_FAILED",
    });
  });

  it("reports an error, preserves page changes and recovers after an unsupported mask", () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true" role="textbox"><p>Kontakt audit@example.com</p><p>Opis przypadku testowego</p></div>';
    const editable = document.querySelector<HTMLElement>("#prompt-textarea")!;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    editable.addEventListener(
      "input",
      () => {
        const marker = document.createElement("span");
        marker.textContent = "[ZNACZNIK_STRONY]";
        editable.append(marker);
        editable.append(document.createElement("img"));
      },
      { once: true },
    );

    expect(() =>
      panel.fireMessage({
        type: "MASK_DETECTIONS",
        sessionId: initial.sessionId,
        revision: initial.revision,
        detectionIds: [initial.detections[0]!.id],
      }),
    ).not.toThrow();
    expect(maskResults(panel)).toEqual([
      {
        type: "MASK_RESULT",
        status: "ERROR",
        sessionId: initial.sessionId,
        requestRevision: initial.revision,
        detectionIds: [initial.detections[0]!.id],
        error: "MASK_FAILED",
      },
    ]);
    expect(editable.textContent).toContain("[ZNACZNIK_STRONY]");

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: [initial.detections[0]!.id],
    });
    expect(maskResults(panel).at(-1)).toMatchObject({
      status: "ERROR",
      sessionId: initial.sessionId,
      error: "STALE_TEXT",
    });

    editable.innerHTML =
      "<p>Kontakt recovery@example.com</p><p>Nowy opis testowy</p>";
    editable.dispatchEvent(new InputEvent("input", { bubbles: true }));
    const recovered = snapshots(panel).at(-1)!;
    expect(recovered.sessionId).not.toBe(initial.sessionId);
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: recovered.sessionId,
      revision: recovered.revision,
      detectionIds: [recovered.detections[0]!.id],
    });

    expect(editable.textContent).toContain("Kontakt [EMAIL_1]");
    expect(maskResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("reports one bulk masking error after the composer becomes unsupported", () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true" role="textbox"><p>Kontakt audit@example.com i 500600700</p><p>Opis przypadku testowego</p></div>';
    const editable = document.querySelector<HTMLElement>("#prompt-textarea")!;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    editable.addEventListener(
      "input",
      () => editable.append(document.createElement("img")),
      { once: true },
    );

    expect(() =>
      panel.fireMessage({
        type: "MASK_DETECTIONS",
        sessionId: initial.sessionId,
        revision: initial.revision,
        detectionIds: initial.detections.map(({ id }) => id),
      }),
    ).not.toThrow();

    expect(maskResults(panel)).toHaveLength(1);
    expect(maskResults(panel)[0]).toMatchObject({
      status: "ERROR",
      detectionIds: initial.detections.map(({ id }) => id),
      error: "MASK_FAILED",
    });
  });

  it("still reports the mask result when the recovery scan itself throws", () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true" role="textbox"><p>Kontakt audit@example.com</p><p>Opis przypadku testowego</p></div>';
    const editable = document.querySelector<HTMLElement>("#prompt-textarea")!;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    const getComputedStyle = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element, pseudoElement) =>
        nativeGetComputedStyle(element, pseudoElement),
      );
    editable.addEventListener(
      "input",
      () => {
        editable.append(document.createElement("img"));
        getComputedStyle.mockImplementation(() => {
          throw new Error("SYNTHETIC_STYLE_FAILURE");
        });
      },
      { once: true },
    );

    expect(() =>
      panel.fireMessage({
        type: "MASK_DETECTIONS",
        sessionId: initial.sessionId,
        revision: initial.revision,
        detectionIds: [initial.detections[0]!.id],
      }),
    ).not.toThrow();

    expect(maskResults(panel)).toHaveLength(1);
    expect(maskResults(panel)[0]).toMatchObject({
      status: "ERROR",
      error: "MASK_FAILED",
    });
    getComputedStyle.mockRestore();
  });

  it("cleans up a manual mask after the composer becomes unsupported", () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true" role="textbox"><p>Klient Testowy</p><p>Opis przypadku testowego</p></div>';
    const editable = document.querySelector<HTMLElement>("#prompt-textarea")!;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const range = document.createRange();
    range.selectNodeContents(editable.firstElementChild!);
    const domSelection = window.getSelection()!;
    domSelection.removeAllRanges();
    domSelection.addRange(range);
    editable.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    const selection = selectionStates(panel).at(-1);
    if (selection?.state !== "READY") throw new Error("Expected selection");
    const shortcut = document.querySelector<HTMLElement>(
      "#prompt-mask-manual-shortcut",
    )!;
    editable.addEventListener(
      "input",
      () => editable.append(document.createElement("img")),
      { once: true },
    );

    expect(() =>
      panel.fireMessage({
        type: "MASK_SELECTION",
        selectionId: selection.selectionId,
      }),
    ).not.toThrow();
    const afterFailure = editable.innerHTML;
    panel.fireMessage({
      type: "MASK_SELECTION",
      selectionId: selection.selectionId,
    });

    expect(manualMaskResults(panel)[0]).toEqual({
      type: "MANUAL_MASK_RESULT",
      status: "ERROR",
      selectionId: selection.selectionId,
      error: "MASK_FAILED",
    });
    expect(manualMaskResults(panel)[1]).toMatchObject({
      status: "ERROR",
      error: "STALE_SELECTION",
    });
    expect(editable.innerHTML).toBe(afterFailure);
    expect(shortcut.style.display).toBe("none");
  });

  it("keeps undo after focus and caret changes without editing", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Kontakt anna.test@example.com";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: [initial.detections[0]!.id],
    });
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");

    textarea.blur();
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe("Kontakt anna.test@example.com");
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("clears undo when the active composer form is submitted", () => {
    document.body.innerHTML =
      '<form><textarea id="mobile-composer-prompt"></textarea></form>';
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Kontakt anna.test@example.com";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: [initial.detections[0]!.id],
    });
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");

    textarea.form!.dispatchEvent(new Event("submit", { bubbles: true }));
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe("Kontakt [EMAIL_1]");
    expect(events(panel)).toContainEqual({
      type: "UNDO_INVALIDATED",
      operationId: result.undoOperationId,
      reason: "CONTEXT_CHANGED",
    });
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "ERROR" });
  });

  it("does not carry undo to a replaced composer with identical text", () => {
    const original = document.querySelector<HTMLTextAreaElement>("textarea")!;
    original.value = "Kontakt anna.test@example.com";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: [initial.detections[0]!.id],
    });
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");

    const replacement = document.createElement("textarea");
    replacement.id = "mobile-composer-prompt";
    replacement.value = original.value;
    original.replaceWith(replacement);
    replacement.dispatchEvent(new InputEvent("input", { bubbles: true }));
    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(replacement.value).toBe("Kontakt [EMAIL_1]");
    expect(events(panel)).toContainEqual({
      type: "UNDO_INVALIDATED",
      operationId: result.undoOperationId,
      reason: "CONTEXT_CHANGED",
    });
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "ERROR" });
  });

  it("does not overwrite a synchronous edit triggered during undo", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Kontakt anna.test@example.com";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: [initial.detections[0]!.id],
    });
    const result = maskResults(panel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");
    textarea.addEventListener(
      "input",
      () => {
        textarea.value = "Nowsza edycja użytkownika";
      },
      { once: true },
    );

    panel.fireMessage({ type: "UNDO_MASK", operationId: result.undoOperationId });

    expect(textarea.value).toBe("Nowsza edycja użytkownika");
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "ERROR" });
  });

  it("reports a failed undo and recovers after the composer becomes supported", () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true" role="textbox"><p>Kontakt audit@example.com</p><p>Opis przypadku testowego</p></div>';
    const editable = document.querySelector<HTMLElement>("#prompt-textarea")!;
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: [initial.detections[0]!.id],
    });
    const masked = maskResults(panel).at(-1)!;
    if (masked.status !== "SUCCESS") throw new Error("Expected mask success");
    editable.addEventListener(
      "input",
      () => editable.append(document.createElement("img")),
      { once: true },
    );

    expect(() =>
      panel.fireMessage({
        type: "UNDO_MASK",
        operationId: masked.undoOperationId,
      }),
    ).not.toThrow();
    expect(undoResults(panel)).toEqual([
      {
        type: "UNDO_RESULT",
        status: "ERROR",
        operationId: masked.undoOperationId,
        error: "UNDO_FAILED",
      },
    ]);

    const failedHtml = editable.innerHTML;
    panel.fireMessage({
      type: "UNDO_MASK",
      operationId: masked.undoOperationId,
    });
    expect(editable.innerHTML).toBe(failedHtml);
    expect(undoResults(panel).at(-1)).toMatchObject({ status: "ERROR" });

    editable.innerHTML =
      "<p>Kontakt recovery@example.com</p><p>Nowy opis testowy</p>";
    editable.dispatchEvent(new InputEvent("input", { bubbles: true }));
    const recovered = snapshots(panel).at(-1)!;
    panel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: recovered.sessionId,
      revision: recovered.revision,
      detectionIds: [recovered.detections[0]!.id],
    });

    expect(maskResults(panel).at(-1)).toMatchObject({ status: "SUCCESS" });
  });

  it("does not restore undo after the content component disconnects", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Kontakt anna.test@example.com";
    const firstPanel = createPort(
      `chrome-extension://${runtimeId}/side-panel.html`,
    );
    onConnect.listener?.(firstPanel as unknown as chrome.runtime.Port);
    const initial = snapshots(firstPanel).at(-1)!;
    firstPanel.fireMessage({
      type: "MASK_DETECTIONS",
      sessionId: initial.sessionId,
      revision: initial.revision,
      detectionIds: [initial.detections[0]!.id],
    });
    const result = maskResults(firstPanel).at(-1)!;
    if (result.status !== "SUCCESS") throw new Error("Expected mask success");
    firstPanel.fireDisconnect();

    const reconnectedPanel = createPort(
      `chrome-extension://${runtimeId}/side-panel.html`,
    );
    onConnect.listener?.(reconnectedPanel as unknown as chrome.runtime.Port);
    reconnectedPanel.fireMessage({
      type: "UNDO_MASK",
      operationId: result.undoOperationId,
    });

    expect(textarea.value).toBe("Kontakt [EMAIL_1]");
    expect(undoResults(reconnectedPanel).at(-1)).toMatchObject({
      status: "ERROR",
    });
  });
});
