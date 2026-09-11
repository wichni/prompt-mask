export const ConnectionCard = ({
  host,
  message,
}: {
  host: "CONNECTING" | "ERROR" | "READY";
  message: string;
}) => {
  const isReady = host === "READY";
  return (
    <section className="connection-card" aria-live="polite">
      <span className={`connection-dot ${isReady ? "online" : ""}`} />
      <div>
        <strong>
          {host === "CONNECTING" && "Łączenie z edytorem…"}
          {host === "ERROR" && "Analiza niedostępna"}
          {isReady && "Analiza aktywna"}
        </strong>
        <p>
          {host === "ERROR" && message}
          {isReady && "Tekst jest sprawdzany lokalnie podczas pisania."}
        </p>
      </div>
    </section>
  );
};
