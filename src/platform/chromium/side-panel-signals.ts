const hasOnlyKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean => {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    keys.every((key) => expected.includes(key))
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type OpenPanelRequest = { type: "OPEN_PROMPT_MASK_PANEL" };
export type PanelViewReady = { type: "PROMPT_MASK_PANEL_READY" };
export type PanelVisibilitySignal = {
  type: "PROMPT_MASK_PANEL_VISIBILITY";
  state: "OPEN" | "CLOSED";
};
export type OpenPanelResponse = {
  type: "OPEN_PROMPT_MASK_PANEL_RESULT";
  status: "OPENED" | "ERROR";
};

export const OPEN_PANEL_REQUEST: OpenPanelRequest = {
  type: "OPEN_PROMPT_MASK_PANEL",
};
export const PANEL_VIEW_READY: PanelViewReady = {
  type: "PROMPT_MASK_PANEL_READY",
};

export const isOpenPanelRequest = (
  value: unknown,
): value is OpenPanelRequest =>
  isRecord(value) &&
  value.type === "OPEN_PROMPT_MASK_PANEL" &&
  hasOnlyKeys(value, ["type"]);

export const isPanelViewReady = (value: unknown): value is PanelViewReady =>
  isRecord(value) &&
  value.type === "PROMPT_MASK_PANEL_READY" &&
  hasOnlyKeys(value, ["type"]);

export const isPanelVisibilitySignal = (
  value: unknown,
): value is PanelVisibilitySignal =>
  isRecord(value) &&
  value.type === "PROMPT_MASK_PANEL_VISIBILITY" &&
  (value.state === "OPEN" || value.state === "CLOSED") &&
  hasOnlyKeys(value, ["type", "state"]);

export const isOpenPanelResponse = (
  value: unknown,
): value is OpenPanelResponse =>
  isRecord(value) &&
  value.type === "OPEN_PROMPT_MASK_PANEL_RESULT" &&
  (value.status === "OPENED" || value.status === "ERROR") &&
  hasOnlyKeys(value, ["type", "status"]);
