import { useState } from "react";
import { closeCurrentSidePanel } from "../platform/chromium/side-panel-client";

export const PanelHeader = ({
  cancelOperationFocus,
  operationPending,
  undoAvailable,
}: {
  cancelOperationFocus: () => void;
  operationPending: boolean;
  undoAvailable: boolean;
}) => {
  const [closePending, setClosePending] = useState(false);
  const [closeError, setCloseError] = useState(false);

  const hidePanel = (): void => {
    if (operationPending || closePending) return;
    cancelOperationFocus();
    setCloseError(false);
    setClosePending(true);
    void closeCurrentSidePanel().then((closed) => {
      if (!closed) {
        setClosePending(false);
        setCloseError(true);
      }
    });
  };

  return (
    <>
      <header className="header">
        <h1>promptMask</h1>
        <button
          className="hide-panel"
          disabled={operationPending || closePending}
          onClick={hidePanel}
          type="button"
        >
          {closePending ? "Chowanie…" : "Schowaj"}
        </button>
      </header>
      {undoAvailable && (
        <p className="hide-warning">Schowanie kończy możliwość cofnięcia.</p>
      )}
      {closeError && (
        <p className="hide-error" role="alert">
          Nie udało się schować panelu. Spróbuj ponownie.
        </p>
      )}
    </>
  );
};
