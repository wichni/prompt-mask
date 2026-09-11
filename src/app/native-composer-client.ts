import {
  isPanelEvent,
  isSupportedChatGptUrl,
  PANEL_CONTENT_PORT,
  type MaskCommand,
  type PanelCommand,
  type PanelEvent,
  type UndoCommand,
} from "../platform/chromium/messages";

export interface NativeComposerSession {
  disconnect: () => void;
  mask: (command: MaskCommand) => boolean;
  undo: (command: UndoCommand) => boolean;
}

export const watchNativeComposer = (
  onEvent: (event: PanelEvent) => void,
): NativeComposerSession => {
  let activePort: chrome.runtime.Port | null = null;
  let activeTabId: number | null = null;
  let generation = 0;
  let disposed = false;

  const postCommand = (command: PanelCommand): boolean => {
    if (!activePort) return false;
    try {
      activePort.postMessage(command);
      return true;
    } catch {
      return false;
    }
  };

  const connect = async (): Promise<void> => {
    const currentGeneration = ++generation;
    activePort?.disconnect();
    activePort = null;
    onEvent({ type: "HOST_STATUS", state: "SEARCHING" });

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (disposed || currentGeneration !== generation) return;
      if (!tab?.id || !tab.url || !isSupportedChatGptUrl(tab.url)) {
        activeTabId = null;
        onEvent({
          type: "HOST_STATUS",
          state: "ERROR",
          error: "UNSUPPORTED_TAB",
        });
        return;
      }

      activeTabId = tab.id;
      const port = chrome.tabs.connect(tab.id, {
        name: PANEL_CONTENT_PORT,
        frameId: 0,
      });
      activePort = port;
      port.onMessage.addListener((message: unknown) => {
        if (port === activePort && isPanelEvent(message)) onEvent(message);
      });
      port.onDisconnect.addListener(() => {
        void chrome.runtime.lastError;
        if (!disposed && port === activePort) {
          activePort = null;
          onEvent({
            type: "HOST_STATUS",
            state: "ERROR",
            error: "CONTENT_SCRIPT_UNAVAILABLE",
          });
        }
      });
    } catch {
      if (!disposed && currentGeneration === generation) {
        onEvent({
          type: "HOST_STATUS",
          state: "ERROR",
          error: "CONTENT_SCRIPT_UNAVAILABLE",
        });
      }
    }
  };

  const handleTabActivated = (): void => void connect();
  const handleTabUpdated = (
    tabId: number,
    changeInfo: { status?: string },
  ): void => {
    if (tabId === activeTabId && changeInfo.status === "complete") void connect();
  };

  chrome.tabs.onActivated.addListener(handleTabActivated);
  chrome.tabs.onUpdated.addListener(handleTabUpdated);
  void connect();

  return {
    mask: postCommand,
    undo: postCommand,
    disconnect: () => {
      disposed = true;
      generation += 1;
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      activePort?.disconnect();
      activePort = null;
    },
  };
};
