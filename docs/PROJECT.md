# Projekt promptMask

## Cel

promptMask ma lokalnie analizować tekst wpisywany w natywnym edytorze modelu,
pokazywać możliwe dane wrażliwe i pozwalać użytkownikowi świadomie je zastąpić.
Narzędzie ogranicza ryzyko przypadkowego wysłania, ale nie gwarantuje pełnej
anonimizacji ani braku wcześniejszego odczytu tekstu przez stronę.

Pierwszym dostawcą jest ChatGPT w przeglądarkach Chrome i Edge. Architektura ma
umożliwiać późniejsze adaptery innych modeli bez przenoszenia detektorów do
warstwy DOM lub platformy.

## Docelowy zakres pierwszego prototypu

- tekst wpisany albo wklejony do natywnego pola rozmowy,
- lokalna detekcja PESEL, praktycznych adresów e-mail i polskich telefonów,
- lista propozycji z typem, ukrytym podglądem i decyzją,
- ręczne wskazanie dodatkowego fragmentu,
- deterministyczne rozstrzyganie nakładających się zakresów,
- spójne oznaczenia identycznej wartości i typu w jednej sesji rozmowy,
- podmiana tylko aktualnego, jawnie zatwierdzonego zakresu,
- oddzielny odbiór Chrome i Edge oraz lokalny ZIP instalacyjny.

To zakres docelowy, a nie lista funkcji obecnie gotowych. Aktualny stan jest
zawsze opisany w `STATUS.md`.

## Poza pierwszym prototypem

- automatyczna detekcja nazwisk,
- pola strukturalne typu `patientName`,
- pliki, PDF, OCR, obrazy i głos,
- backend, własna historia rozmów i odczyt całej strony,
- LLM używany do detekcji,
- przywracanie oryginałów w odpowiedziach,
- automatyczne wysyłanie wiadomości,
- Firefox, Safari, aplikacje desktopowe i urządzenia mobilne.

Każde rozszerzenie tej listy wymaga osobnego etapu oraz ponownej oceny granicy
danych i uprawnień.

## Architektura

```text
natywny edytor ── content script ── czyste detektory i zakresy
                         │
                         ├── ukryte podglądy ── panel decyzji
                         │                         │
                         └──── zatwierdzona podmiana zakresu
```

### Warstwy

| Katalog | Odpowiedzialność | Czego nie zna |
| --- | --- | --- |
| `src/core` | typy, zakresy, podglądy i podmiany | React, Chrome, DOM |
| `src/detectors` | czyste reguły PESEL, e-mail i telefonu | UI, Chrome, DOM |
| `src/app` | panel i stan interakcji | selektory ChatGPT |
| `src/platform/chromium` | komunikaty, manifestowe API i przyszły storage | reguły detekcji |
| `src/providers/chatgpt` | odczyt, obserwacja i podmiana w natywnym edytorze | React panelu |

### Kierunek zależności

Logika domenowa nie importuje platformy. Adapter zewnętrzny implementuje mały
kontrakt potrzebny aplikacji. Kod ChatGPT może uruchamiać detekcję i maskowanie,
ale nie może zawierać ich reguł. Dodanie detektora powinno wymagać implementacji,
rejestracji i testów, bez zmiany adaptera DOM.

## Model stanu

- `draftRevision` zmienia się przy każdej zmianie tekstu.
- Decyzja panelu wskazuje wersję i identyfikator zakresu.
- Podmiana jest możliwa tylko wtedy, gdy wersja i wartość zakresu nadal pasują.
- Brak wykryć, błąd analizy i wynik bez wybranych podmian są trzema różnymi
  stanami.

## Decyzje techniczne

- TypeScript, React, Vite i Vitest; jedna paczka i jeden lockfile.
- Manifest V3 oraz `chrome.sidePanel` dla wspólnego kodu Chrome/Edge.
- Content script jest osobnym, samodzielnym bundłem bez importów runtime.
- Surowy szkic znajduje się w natywnym DOM i jest lokalnie odczytywany przez
  content script. Nie jest przekazywany do panelu ani service workera.
- DOM otrzymuje tekst przez bezpieczne API tekstowe, nigdy przez `innerHTML`.
- Integracja odmawia modyfikacji zamiast zgadywać selektor albo używać starego
  zakresu.
- Zależności są przypięte do konkretnych wersji; aktualizacja jest osobnym,
  testowanym zadaniem.
