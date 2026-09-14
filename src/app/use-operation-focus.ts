import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { PanelFeedback } from "./side-panel-state";

interface FocusRequest {
  sessionId: string;
  source: HTMLElement;
}

export const useOperationFocus = (
  headingRef: RefObject<HTMLHeadingElement | null>,
  operationPending: boolean,
  feedback: PanelFeedback | null,
  currentSessionId: string | null,
) => {
  const requestRef = useRef<FocusRequest | null>(null);

  const cancel = useCallback(() => {
    requestRef.current = null;
  }, []);

  const request = useCallback((source: HTMLElement, sessionId: string) => {
    requestRef.current = { sessionId, source };
  }, []);

  useEffect(() => {
    const cancelOnFocusMove = (event: FocusEvent): void => {
      const request = requestRef.current;
      if (request && event.target !== request.source) cancel();
    };
    const cancelOnPointerMove = (event: PointerEvent): void => {
      const request = requestRef.current;
      if (request && event.target !== request.source) cancel();
    };
    const cancelWhenHidden = (): void => {
      if (document.hidden) cancel();
    };
    document.addEventListener("focusin", cancelOnFocusMove, true);
    document.addEventListener("pointerdown", cancelOnPointerMove, true);
    document.addEventListener("visibilitychange", cancelWhenHidden);
    window.addEventListener("blur", cancel);
    window.addEventListener("pagehide", cancel);
    return () => {
      document.removeEventListener("focusin", cancelOnFocusMove, true);
      document.removeEventListener("pointerdown", cancelOnPointerMove, true);
      document.removeEventListener("visibilitychange", cancelWhenHidden);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("pagehide", cancel);
      cancel();
    };
  }, [cancel]);

  useEffect(() => {
    const request = requestRef.current;
    if (!request) return;
    if (request.sessionId !== currentSessionId) {
      cancel();
      return;
    }
    if (operationPending || !feedback) return;
    requestRef.current = null;
    if (!request.source.isConnected && !document.hidden) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [cancel, currentSessionId, feedback, headingRef, operationPending]);

  return { cancelOperationFocus: cancel, requestOperationFocus: request };
};
