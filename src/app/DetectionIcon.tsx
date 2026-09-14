import type { ReactNode } from "react";
import type { DetectionSummary } from "../platform/chromium/messages";

type IconName = "card" | "email" | "lock" | "person" | "phone";

const iconNames: Record<DetectionSummary["kind"], IconName> = {
  PESEL: "card",
  EMAIL: "email",
  PHONE: "phone",
  PATIENT_NAME: "person",
  PATIENT_FIRST_NAME: "person",
  PATIENT_LAST_NAME: "person",
  PATIENT_ID: "card",
  PASSWORD: "lock",
  SECRET: "lock",
};

const paths: Record<IconName, ReactNode> = {
  card: (
    <>
      <rect height="14" rx="2" width="18" x="3" y="5" />
      <path d="M7 9h.01M10 9h7M7 13h4M14 13h3" />
    </>
  ),
  email: (
    <>
      <rect height="14" rx="2" width="18" x="3" y="5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  lock: (
    <>
      <rect height="11" rx="2" width="16" x="4" y="10" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  phone: (
    <path d="M7 3h3l1.5 5-2 1.5a15 15 0 0 0 5 5L16 12.5l5 1.5v3c0 2.2-1.8 4-4 4A14 14 0 0 1 3 7c0-2.2 1.8-4 4-4Z" />
  ),
};

export const DetectionIcon = ({
  kind,
}: {
  kind: DetectionSummary["kind"];
}) => (
  <span aria-hidden="true" className="detection-icon">
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      {paths[iconNames[kind]]}
    </svg>
  </span>
);
