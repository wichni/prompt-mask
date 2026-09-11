import type { DetectionKind } from "../../src/core/detection";

export type MedicalCaseFormat = "DESCRIPTION" | "LOG" | "JSON";
export type ProtectedCategory = DetectionKind;

export interface ProtectedSpan {
  category: ProtectedCategory;
  subtype?: string;
  start: number;
  end: number;
  value: string;
  reason: string;
}

export interface PreservedFragment {
  value: string;
  reason: string;
}

export interface MedicalCase {
  id: string;
  title: string;
  format: MedicalCaseFormat;
  text: string;
  protectedSpans: ProtectedSpan[];
  mustPreserve: PreservedFragment[];
  knownLimitation?: string;
}

const defineCase = (definition: MedicalCase): MedicalCase => definition;

const preserve = (value: string, reason: string): PreservedFragment => ({
  value,
  reason,
});

export const MEDICAL_CORPUS_VERSION = "MED-001-v1";
export const MEDICAL_CORPUS_BASE_SHA =
  "65e3a1d95af8e0b3ae25cb50e742ebbde6decc9d";

export const medicalCases: MedicalCase[] = [
  defineCase({
    id: "MED-01",
    title: "Poprawny PESEL w opisie błędu",
    format: "DESCRIPTION",
    text: "Rejestracja pacjenta 02070803628 zakończyła się błędem REG-409.",
    protectedSpans: [
      { category: "PESEL", start: 21, end: 32, value: "02070803628", reason: "Identyfikator pacjenta" },
    ],
    mustPreserve: [preserve("REG-409", "Kod błędu potrzebny do diagnozy")],
  }),
  defineCase({
    id: "MED-02",
    title: "PESEL z błędną sumą kontrolną",
    format: "LOG",
    text: "Walidacja pola PESEL=02070803627 zwróciła CHECKSUM_INVALID.",
    protectedSpans: [
      { category: "PESEL", start: 21, end: 32, value: "02070803627", reason: "Wartość pola PESEL nadal wymaga ochrony" },
    ],
    mustPreserve: [preserve("CHECKSUM_INVALID", "Rodzaj błędu walidacji")],
    knownLimitation: "Obecny detektor odrzuca PESEL z błędną sumą kontrolną.",
  }),
  defineCase({
    id: "MED-03",
    title: "PESEL z niemożliwą datą w JSON",
    format: "JSON",
    text: '{"pesel":"02320803625","error":"INVALID_BIRTH_DATE"}',
    protectedSpans: [
      { category: "PESEL", start: 10, end: 21, value: "02320803625", reason: "Wartość identyfikującego pola pesel" },
    ],
    mustPreserve: [preserve("INVALID_BIRTH_DATE", "Rodzaj błędu walidacji")],
    knownLimitation: "Obecny detektor odrzuca PESEL z niemożliwą datą.",
  }),
  defineCase({
    id: "MED-04",
    title: "E-mail pacjenta w JSON",
    format: "JSON",
    text: '{"patientEmail":"ola.proba@example.com","status":"INVALID"}',
    protectedSpans: [
      { category: "EMAIL", start: 17, end: 38, value: "ola.proba@example.com", reason: "Adres kontaktowy pacjenta" },
    ],
    mustPreserve: [preserve('"patientEmail"', "Nazwa diagnozowanego pola")],
  }),
  defineCase({
    id: "MED-05",
    title: "Polski telefon z prefiksem i separatorami",
    format: "LOG",
    text: "SMS_GATEWAY odrzucił numer +48 501-234-567; status=422.",
    protectedSpans: [
      { category: "PHONE", start: 27, end: 42, value: "+48 501-234-567", reason: "Numer telefonu pacjenta" },
    ],
    mustPreserve: [preserve("SMS_GATEWAY", "Nazwa komponentu technicznego")],
  }),
  defineCase({
    id: "MED-06",
    title: "patientName z polskimi znakami",
    format: "JSON",
    text: '{"patientName":"Żaneta Próba","validation":"MISSING_CONSENT"}',
    protectedSpans: [
      { category: "PATIENT_NAME", start: 16, end: 28, value: "Żaneta Próba", reason: "Imię i nazwisko pacjenta" },
    ],
    mustPreserve: [preserve("MISSING_CONSENT", "Kod reguły biznesowej")],
  }),
  defineCase({
    id: "MED-07",
    title: "Alfanumeryczny identyfikator pacjenta",
    format: "LOG",
    text: "FHIR import patientId=PAT-A7F2-009 zakończony statusem DUPLICATE.",
    protectedSpans: [
      { category: "PATIENT_ID", start: 22, end: 34, value: "PAT-A7F2-009", reason: "Jednoznaczny identyfikator pacjenta" },
    ],
    mustPreserve: [preserve("DUPLICATE", "Wynik importu")],
  }),
  defineCase({
    id: "MED-08",
    title: "Powtórzony e-mail w logu",
    format: "LOG",
    text: "Kontakt ela.test@example.com odrzucony; retry dla ela.test@example.com.",
    protectedSpans: [
      { category: "EMAIL", start: 8, end: 28, value: "ela.test@example.com", reason: "Pierwsze wystąpienie adresu" },
      { category: "EMAIL", start: 50, end: 70, value: "ela.test@example.com", reason: "Drugie wystąpienie adresu" },
    ],
    mustPreserve: [preserve("retry", "Informacja o ponowieniu")],
  }),
  defineCase({
    id: "SEC-01",
    title: "Hasło w JSON",
    format: "JSON",
    text: '{"password":"P@ss-demo-7!Q","result":"AUTH_FAILED"}',
    protectedSpans: [
      { category: "PASSWORD", subtype: "PASSWORD", start: 13, end: 26, value: "P@ss-demo-7!Q", reason: "Wartość hasła" },
    ],
    mustPreserve: [preserve('"password"', "Nazwa diagnozowanego pola")],
  }),
  defineCase({
    id: "SEC-02",
    title: "Client secret i klucz API",
    format: "LOG",
    text: "client_secret=demo-client-Z8x!; api_key=sk_demo_A1b2C3d4; env=test",
    protectedSpans: [
      { category: "SECRET", subtype: "CLIENT_SECRET", start: 14, end: 30, value: "demo-client-Z8x!", reason: "Wartość client secret" },
      { category: "SECRET", subtype: "API_KEY", start: 40, end: 56, value: "sk_demo_A1b2C3d4", reason: "Syntetyczny klucz API" },
    ],
    mustPreserve: [preserve("env=test", "Kontekst środowiska testowego")],
  }),
  defineCase({
    id: "SEC-03",
    title: "Token Bearer w nagłówku",
    format: "LOG",
    text: "Authorization: Bearer demo.jwt.token-7X; response=401",
    protectedSpans: [
      { category: "SECRET", subtype: "BEARER_TOKEN", start: 22, end: 39, value: "demo.jwt.token-7X", reason: "Wartość tokenu Bearer" },
    ],
    mustPreserve: [preserve("Authorization: Bearer ", "Nazwa i schemat nagłówka")],
  }),
  defineCase({
    id: "SEC-04",
    title: "Hasło w URI połączenia",
    format: "LOG",
    text: "DB connect failed: postgresql://tester:demo-db-P4ss@db.invalid/clinic?ssl=true",
    protectedSpans: [
      { category: "SECRET", subtype: "URI_PASSWORD", start: 39, end: 51, value: "demo-db-P4ss", reason: "Hasło pomiędzy nazwą użytkownika i hostem URI" },
    ],
    mustPreserve: [
      preserve("postgresql://tester:", "Schemat i użytkownik potrzebne do diagnozy"),
      preserve("@db.invalid/clinic?ssl=true", "Host, baza i parametr po chronionym haśle"),
    ],
  }),
  defineCase({
    id: "MIX-01",
    title: "PESEL i token w logu integracji",
    format: "LOG",
    text: "Sync PESEL 02070803628; Authorization: Bearer sync-demo-T9; status=403",
    protectedSpans: [
      { category: "PESEL", start: 11, end: 22, value: "02070803628", reason: "Identyfikator pacjenta" },
      { category: "SECRET", subtype: "BEARER_TOKEN", start: 46, end: 58, value: "sync-demo-T9", reason: "Token integracji" },
    ],
    mustPreserve: [preserve("status=403", "Wynik wywołania")],
  }),
  defineCase({
    id: "MIX-02",
    title: "patientId, e-mail i hasło w JSON",
    format: "JSON",
    text: '{"patientId":"PT-Z19-44","email":"iwo.test@example.org","password":"Tmp!Pass-44","error":"LOGIN_17"}',
    protectedSpans: [
      { category: "PATIENT_ID", start: 14, end: 23, value: "PT-Z19-44", reason: "Identyfikator pacjenta" },
      { category: "EMAIL", start: 34, end: 54, value: "iwo.test@example.org", reason: "E-mail pacjenta" },
      { category: "PASSWORD", subtype: "PASSWORD", start: 68, end: 79, value: "Tmp!Pass-44", reason: "Hasło tymczasowe" },
    ],
    mustPreserve: [preserve("LOGIN_17", "Kod błędu")],
  }),
  defineCase({
    id: "MIX-03",
    title: "Nazwa, telefon i kod błędu",
    format: "DESCRIPTION",
    text: "Pacjent: Łukasz Modelowy\nTelefon: 502 345 678\nBłąd: ERR_M-204",
    protectedSpans: [
      { category: "PATIENT_NAME", start: 9, end: 24, value: "Łukasz Modelowy", reason: "Imię i nazwisko pacjenta" },
      { category: "PHONE", start: 34, end: 45, value: "502 345 678", reason: "Telefon pacjenta" },
    ],
    mustPreserve: [preserve("ERR_M-204", "Techniczny kod błędu")],
    knownLimitation: "Automatyczne maskowanie obejmuje tylko telefon.",
  }),
  defineCase({
    id: "MIX-04",
    title: "Dwa rekordy pacjentów",
    format: "LOG",
    text: "A email=ada.one@example.net phone=503-111-222\nB email=ben.two@example.net phone=504-333-444",
    protectedSpans: [
      { category: "EMAIL", start: 8, end: 27, value: "ada.one@example.net", reason: "E-mail rekordu A" },
      { category: "PHONE", start: 34, end: 45, value: "503-111-222", reason: "Telefon rekordu A" },
      { category: "EMAIL", start: 54, end: 73, value: "ben.two@example.net", reason: "E-mail rekordu B" },
      { category: "PHONE", start: 80, end: 91, value: "504-333-444", reason: "Telefon rekordu B" },
    ],
    mustPreserve: [preserve("A ", "Kolejność pierwszego rekordu"), preserve("B ", "Kolejność drugiego rekordu")],
  }),
  defineCase({
    id: "NEG-01",
    title: "Daty, HTTP i czas wykonania",
    format: "LOG",
    text: "2026-09-11T10:15:30Z status=504 duration=987ms retry=2",
    protectedSpans: [],
    mustPreserve: [preserve("status=504", "Kod odpowiedzi HTTP")],
  }),
  defineCase({
    id: "NEG-02",
    title: "Wyniki badań i jednostki",
    format: "DESCRIPTION",
    text: "Glukoza 5.4 mmol/L; CRP 3.2 mg/L; temperatura 36.7 °C.",
    protectedSpans: [],
    mustPreserve: [preserve("5.4 mmol/L", "Wartość i jednostka testu formatowania")],
  }),
  defineCase({
    id: "NEG-03",
    title: "Techniczny stack trace",
    format: "LOG",
    text: "at demo.clinic.Parser.read(Parser.java:42)\nCaused by: FormatException: missing field",
    protectedSpans: [],
    mustPreserve: [preserve("Parser.java:42", "Miejsce błędu")],
  }),
  defineCase({
    id: "NEG-04",
    title: "Dziewięciocyfrowe zlecenie techniczne",
    format: "LOG",
    text: "Techniczne jobOrder=731204589 nie jest identyfikatorem pacjenta ani telefonem.",
    protectedSpans: [],
    mustPreserve: [preserve("731204589", "Identyfikator techniczny wymagany w diagnozie")],
    knownLimitation: "Obecny detektor klasyfikuje numer zlecenia jako telefon.",
  }),
  defineCase({
    id: "NEG-05",
    title: "Nazwy pól bez wartości",
    format: "DESCRIPTION",
    text: "Odpowiedź opisuje pola password oraz Authorization, ale nie zawiera ich wartości.",
    protectedSpans: [],
    mustPreserve: [preserve("password", "Nazwa pola nie jest sekretem")],
  }),
  defineCase({
    id: "NEG-06",
    title: "Istniejące oznaczenia",
    format: "DESCRIPTION",
    text: "Porównaj [PESEL_1], [EMAIL_1], [PHONE_1] i [DANE_1] w neutralnym opisie.",
    protectedSpans: [],
    mustPreserve: [preserve("[PESEL_1]", "Istniejące oznaczenie nie jest daną wejściową")],
  }),
  defineCase({
    id: "EDGE-01",
    title: "Emoji i polskie znaki przed danymi",
    format: "DESCRIPTION",
    text: "🧪 Próba dla pacjentki Józefina Żółć: jozefina.test@example.pl; kod=FMT-8.",
    protectedSpans: [
      { category: "PATIENT_NAME", start: 23, end: 36, value: "Józefina Żółć", reason: "Imię i nazwisko pacjentki" },
      { category: "EMAIL", start: 38, end: 62, value: "jozefina.test@example.pl", reason: "E-mail po emoji i znakach diakrytycznych" },
    ],
    mustPreserve: [preserve("FMT-8", "Kod testu formatowania")],
    knownLimitation: "Obecna wersja nie wykrywa nazwy pacjentki.",
  }),
  defineCase({
    id: "EDGE-02",
    title: "JSON z ucieczkami i wieloma wierszami",
    format: "JSON",
    text: '{\n  "note": "Błąd \\"format\\"\\nlinia 2",\n  "apiToken": "json-demo-K8x",\n  "code": "JSON_422"\n}',
    protectedSpans: [
      { category: "SECRET", subtype: "API_TOKEN", start: 55, end: 68, value: "json-demo-K8x", reason: "Wartość tokenu w JSON" },
    ],
    mustPreserve: [preserve('\\"format\\"\\n', "Ucieczki w treści JSON"), preserve("JSON_422", "Kod błędu")],
  }),
];
