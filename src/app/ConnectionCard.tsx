export const ConnectionCard = ({
  host,
  message,
}: {
  host: "CONNECTING" | "ERROR" | "READY";
  message: string;
}) => {
  const isReady = host === "READY";
  return (
    <section className="connection-status" aria-live="polite">
      <div className="connection-summary">
        <span
          aria-hidden="true"
          className={`connection-dot ${isReady ? "online" : ""}`}
        />
        <span>
          {host === "CONNECTING" && "Łączenie z edytorem…"}
          {host === "ERROR" && "Analiza niedostępna"}
          {isReady && "Analiza aktywna"}
        </span>
      </div>
      <strong className="chat-provider">ChatGPT</strong>
      {host === "ERROR" && <p>{message}</p>}
    </section>
  );
};
