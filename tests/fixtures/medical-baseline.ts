import type { EvaluatedDetection } from "../helpers/medical-evaluation";

export const medicalBaseline: Record<string, EvaluatedDetection[]> = {
  "MED-01": [{ kind: "PESEL", start: 21, end: 32 }],
  "MED-02": [{ kind: "PESEL", start: 21, end: 32 }],
  "MED-03": [{ kind: "PESEL", start: 10, end: 21 }],
  "MED-04": [{ kind: "EMAIL", start: 17, end: 38 }],
  "MED-05": [{ kind: "PHONE", start: 27, end: 42 }],
  "MED-06": [{ kind: "PATIENT_NAME", start: 16, end: 28 }],
  "MED-07": [{ kind: "PATIENT_ID", start: 22, end: 34 }],
  "MED-08": [
    { kind: "EMAIL", start: 8, end: 28 },
    { kind: "EMAIL", start: 50, end: 70 },
  ],
  "SEC-01": [{ kind: "PASSWORD", start: 13, end: 26 }],
  "SEC-02": [
    { kind: "SECRET", start: 14, end: 30 },
    { kind: "SECRET", start: 40, end: 56 },
  ],
  "SEC-03": [{ kind: "SECRET", start: 22, end: 39 }],
  "SEC-04": [{ kind: "SECRET", start: 39, end: 51 }],
  "MIX-01": [
    { kind: "PESEL", start: 11, end: 22 },
    { kind: "SECRET", start: 46, end: 58 },
  ],
  "MIX-02": [
    { kind: "PATIENT_ID", start: 14, end: 23 },
    { kind: "EMAIL", start: 34, end: 54 },
    { kind: "PASSWORD", start: 68, end: 79 },
  ],
  "MIX-03": [{ kind: "PHONE", start: 34, end: 45 }],
  "MIX-04": [
    { kind: "EMAIL", start: 8, end: 27 },
    { kind: "PHONE", start: 34, end: 45 },
    { kind: "EMAIL", start: 54, end: 73 },
    { kind: "PHONE", start: 80, end: 91 },
  ],
  "NEG-01": [],
  "NEG-02": [],
  "NEG-03": [],
  "NEG-04": [{ kind: "PHONE", start: 20, end: 29 }],
  "NEG-05": [],
  "NEG-06": [],
  "EDGE-01": [{ kind: "EMAIL", start: 38, end: 62 }],
  "EDGE-02": [{ kind: "SECRET", start: 55, end: 68 }],
};
