import {
  isOpenPanelResponse,
  OPEN_PANEL_REQUEST,
} from "./side-panel-signals";

export const requestOpenSidePanel = async (): Promise<boolean> => {
  try {
    const response: unknown = await chrome.runtime.sendMessage(
      OPEN_PANEL_REQUEST,
    );
    return isOpenPanelResponse(response) && response.status === "OPENED";
  } catch {
    return false;
  }
};

export const closeCurrentSidePanel = async (): Promise<boolean> => {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    if (!Number.isSafeInteger(currentWindow.id)) return false;
    await chrome.sidePanel.close({ windowId: currentWindow.id! });
    return true;
  } catch {
    return false;
  }
};
