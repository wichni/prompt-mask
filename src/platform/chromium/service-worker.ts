import { isSupportedChatGptUrl } from "./messages";
import {
  isOpenPanelRequest,
  type OpenPanelResponse,
  type PanelVisibilitySignal,
} from "./side-panel-signals";

const PANEL_PATH = "side-panel.html";
const visibilitySourceId = crypto.randomUUID();
let nextVisibilitySequence = 1;

interface WindowVisibilityState {
  generation: number;
  openTabIds: Set<number>;
}

const visibilityByWindow = new Map<number, WindowVisibilityState>();

const enableActionClick = (): void => {
  void chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {
      // Payload-free by design. The panel remains available from the
      // extensions menu if this browser rejects the action setting.
    });
};

const isTrustedPageSender = (sender: chrome.runtime.MessageSender): boolean =>
  sender.id === chrome.runtime.id &&
  sender.frameId === 0 &&
  Number.isSafeInteger(sender.tab?.id) &&
  Number.isSafeInteger(sender.tab?.windowId) &&
  Number(sender.tab?.windowId) >= 0 &&
  typeof sender.url === "string" &&
  isSupportedChatGptUrl(sender.url) &&
  (sender.tab?.url === undefined ||
    (typeof sender.tab.url === "string" &&
      isSupportedChatGptUrl(sender.tab.url)));

const handleOpenRequest = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: OpenPanelResponse) => void,
): boolean => {
  if (!isOpenPanelRequest(message) || !isTrustedPageSender(sender)) return false;

  let openResult: Promise<void>;
  try {
    openResult = chrome.sidePanel.open({
      windowId: sender.tab!.windowId,
    });
  } catch {
    sendResponse({
      type: "OPEN_PROMPT_MASK_PANEL_RESULT",
      status: "ERROR",
    });
    return false;
  }
  void openResult.then(
    () =>
      sendResponse({
        type: "OPEN_PROMPT_MASK_PANEL_RESULT",
        status: "OPENED",
      }),
    () =>
      sendResponse({
        type: "OPEN_PROMPT_MASK_PANEL_RESULT",
        status: "ERROR",
      }),
  );
  return true;
};

const notifyActiveTab = (
  windowId: number,
  state: PanelVisibilitySignal["state"],
): void => {
  const windowState = visibilityByWindow.get(windowId) ?? {
    generation: 0,
    openTabIds: new Set<number>(),
  };
  visibilityByWindow.set(windowId, windowState);
  windowState.generation += 1;
  const generation = windowState.generation;
  const sequence = nextVisibilitySequence++;
  const knownRecipients = new Set(windowState.openTabIds);

  void chrome.tabs
    .query({ active: true, windowId })
    .then(([tab]) => {
      if (windowState.generation !== generation) return;
      const activeTabId = Number.isSafeInteger(tab?.id) ? tab!.id! : null;
      const recipients =
        state === "OPEN" ? new Set<number>() : knownRecipients;
      if (activeTabId !== null) recipients.add(activeTabId);
      if (state === "OPEN" && activeTabId !== null) {
        windowState.openTabIds.add(activeTabId);
      }
      if (state === "CLOSED") windowState.openTabIds.clear();
      if (recipients.size === 0) return;
      const signal: PanelVisibilitySignal = {
        type: "PROMPT_MASK_PANEL_VISIBILITY",
        state,
        sourceId: visibilitySourceId,
        sequence,
      };
      return Promise.all(
        [...recipients].map((tabId) => chrome.tabs.sendMessage(tabId, signal)),
      );
    })
    .catch(() => {
      // The active tab may not be ChatGPT or its content script may be gone.
    });
};

const isPromptMaskPanel = (path: string): boolean =>
  path.replace(/^\//u, "") === PANEL_PATH;

chrome.runtime.onInstalled.addListener(enableActionClick);
chrome.runtime.onStartup.addListener(enableActionClick);
chrome.runtime.onMessage.addListener(handleOpenRequest);
chrome.sidePanel.onOpened.addListener((info) => {
  if (isPromptMaskPanel(info.path)) notifyActiveTab(info.windowId, "OPEN");
});
chrome.sidePanel.onClosed.addListener((info) => {
  if (isPromptMaskPanel(info.path)) notifyActiveTab(info.windowId, "CLOSED");
});
enableActionClick();
