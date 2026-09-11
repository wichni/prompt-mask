import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PANEL_CONTENT_PORT,
  type AnalysisSnapshot,
  type MaskResult,
  type PanelEvent,
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

const events = (port: ReturnType<typeof createPort>): PanelEvent[] =>
  port.postMessage.mock.calls.map(([message]) => message as PanelEvent);

const undoResults = (port: ReturnType<typeof createPort>): UndoResult[] =>
  events(port).filter(
    (message): message is UndoResult => message.type === "UNDO_RESULT",
  );

beforeEach(async () => {
  vi.resetModules();
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

  it("confirms masking only after rescanning the changed textarea", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Kontakt anna.test@example.com lub +48 500 600 700";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const snapshot = snapshots(panel).at(-1)!;
    const email = snapshot.detections.find(({ kind }) => kind === "EMAIL")!;

    panel.fireMessage({
      type: "MASK_DETECTIONS",
      revision: snapshot.revision,
      detectionIds: [email.id],
    });

    expect(textarea.value).toBe("Kontakt [EMAIL_1] lub +48 500 600 700");
    expect(snapshots(panel).at(-1)?.detections).toHaveLength(1);
    expect(snapshots(panel).at(-1)?.detections[0]?.kind).toBe("PHONE");
    expect(maskResults(panel).at(-1)).toEqual({
      type: "MASK_RESULT",
      status: "SUCCESS",
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
      revision: snapshot.revision,
      detectionIds: partialIds,
    });

    expect(inputListener).not.toHaveBeenCalled();
    expect(textarea.value).toContain("anna.test@example.com");
    expect(maskResults(panel).at(-1)).toEqual({
      type: "MASK_RESULT",
      status: "ERROR",
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
      revision: snapshot.revision + 1,
      detectionIds: [snapshot.detections[0]!.id],
    });

    expect(textarea.value).toBe("PESEL 02070803628");
    expect(maskResults(panel).at(-1)).toEqual({
      type: "MASK_RESULT",
      status: "ERROR",
      requestRevision: snapshot.revision + 1,
      detectionIds: [snapshot.detections[0]!.id],
      error: "STALE_TEXT",
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
      revision: initial.revision,
      detectionIds: [email.id],
    });
    const afterEmail = snapshots(panel).at(-1)!;
    panel.fireMessage({
      type: "MASK_DETECTIONS",
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

  it("keeps undo after focus and caret changes without editing", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Kontakt anna.test@example.com";
    const panel = createPort(`chrome-extension://${runtimeId}/side-panel.html`);
    onConnect.listener?.(panel as unknown as chrome.runtime.Port);
    const initial = snapshots(panel).at(-1)!;
    panel.fireMessage({
      type: "MASK_DETECTIONS",
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
