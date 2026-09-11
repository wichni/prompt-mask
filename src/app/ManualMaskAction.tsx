export const ManualMaskAction = ({
  disabled,
  instruction,
  onMask,
}: {
  disabled: boolean;
  instruction: string;
  onMask: () => void;
}) => (
  <div className="manual-mask-action">
    <button
      className="manual-mask"
      disabled={disabled}
      onClick={onMask}
      type="button"
    >
      Maskuj zaznaczenie
    </button>
    <p className="manual-mask-instruction" aria-live="polite">
      {instruction}
    </p>
  </div>
);
