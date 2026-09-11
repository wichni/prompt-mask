const enableActionClick = (): void => {
  void chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {
      // Payload-free by design. The panel remains available from the
      // extensions menu if this browser rejects the action setting.
    });
};

chrome.runtime.onInstalled.addListener(enableActionClick);
chrome.runtime.onStartup.addListener(enableActionClick);
enableActionClick();
