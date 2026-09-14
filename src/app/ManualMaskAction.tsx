export const ManualMaskAction = ({
  disabled,
  instruction,
  onMask,
}: {
  disabled: boolean;
  instruction: string;
  onMask: (source: HTMLButtonElement) => void;
}) => (
  <div className="manual-mask-action">
    <div>
      <h2>Własny fragment</h2>
      <p className="manual-mask-instruction" aria-live="polite">
        {instruction}
      </p>
    </div>
    <button
      className="manual-mask"
      disabled={disabled}
      onClick={(event) => onMask(event.currentTarget)}
      type="button"
    >
      Maskuj zaznaczenie
    </button>
  </div>
);
