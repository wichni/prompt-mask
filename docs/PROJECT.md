# Projekt promptMask

## Cel

promptMask ma lokalnie analizować tekst wpisywany w natywnym edytorze modelu,
pokazywać możliwe dane wrażliwe i pozwalać użytkownikowi świadomie je zastąpić.
Narzędzie ogranicza ryzyko przypadkowego wysłania, ale nie gwarantuje pełnej
anonimizacji ani braku wcześniejszego odczytu tekstu przez stronę.

Pierwszymi odbiorcami są programiści i testerzy systemów medycznych pracujący z
opisami błędów, logami i JSON-em. Narzędzie ma pomagać zauważać dane pacjentów
oraz rozpoznawalne sekrety techniczne, nie usuwając kontekstu potrzebnego do
zrozumienia problemu.

Pierwszym dostawcą jest ChatGPT w przeglądarkach Chrome i Edge. Architektura ma
umożliwiać późniejsze adaptery innych modeli bez przenoszenia detektorów do
warstwy DOM lub platformy.

## Docelowy zakres pierwszego prototypu

- tekst wpisany albo wklejony do natywnego pola rozmowy,
- lokalna detekcja PESEL, praktycznych adresów e-mail, polskich telefonów oraz
  jawnych pól `patientName`, `patientFirstName`, `patientLastName`, `patientId`
  i `password`, a także ograniczonych kontekstów sekretów technicznych,
- lista propozycji z typem, ukrytym podglądem i decyzją,
- ręczne wskazanie dodatkowego fragmentu,
- deterministyczne rozstrzyganie nakładających się zakresów,
- spójne oznaczenia identycznej wartości i typu w jednej sesji rozmowy,
- podmiana tylko aktualnego, jawnie zatwierdzonego zakresu,
- oddzielny odbiór Chrome i Edge oraz lokalny ZIP instalacyjny.

To zakres docelowy, a nie lista funkcji obecnie gotowych. Aktualny stan jest
zawsze opisany w `STATUS.md`.

## Kolejność przed pilotażem

1. UI-001 uporządkował otwarty panel bez zmiany analizy i przepływu danych.
2. BG-001 rozdziela cykl życia analizy od widoczności panelu, dodaje licznik,
   ograniczony dymek i poprawia wiązanie fokusu z operacją.
3. Pilotaż rozpocznie się dopiero po ręcznym odbiorze BG-001 w Chrome i Edge.

Inne czaty, dokumenty, nowe detektory i trwała historia oznaczeń pozostają w
kolejce odrębnych etapów.

## Kierunek rozwoju detekcji

Obecnie działają detektory PESEL-u, praktycznych adresów e-mail, polskich
numerów telefonu oraz wartości dokładnych pól `patientName`,
`patientFirstName`, `patientLastName`, `patientId`, `password`, `client_secret`,
`api_key` i `apiToken` w ograniczonych strukturach. Rozpoznawane są też wartości
po pełnym prefiksie nagłówka Bearer i hasła URI. Dostępne jest ręczne maskowanie
wskazanego fragmentu.
Rzeczywisty zakres i dowody są kanonicznie opisane w `STATUS.md`.

Syntetyczny zestaw MED-001 mierzy obecne wykrycia, pominięcia i fałszywe alarmy;
wyniki i uzasadnienie kolejności są w
[`MEDICAL_EVALUATION.md`](MEDICAL_EVALUATION.md). Jawne pola pacjenta są
obsługiwane w wąskim zakresie MED-002, a MED-003 dodaje dokładne pola imienia,
nazwiska i hasła. MED-004 domyka pierwszeństwo pełnej wartości hasła oraz
bezpieczne granice ograniczonych przypisań. Osobny zatwierdzony etap domknął
granice detektora e-mail dla przypisań w logach i danych uwierzytelniających URI.
MED-005 domyka granice cytowanego Bearer i adresu po `email=`, gdy część lokalna
zawiera kolejny `=`. MED-006 dodaje wąskie jawne pole `pesel` dla wartości
niespełniającej walidacji daty lub sumy kontrolnej; nie osłabia heurystyki
wszystkich 11-cyfrowych ciągów. Nazwy
pacjentów poza jawnymi polami nadal wymagają osobnego korpusu negatywnego.
Dowolnego hasła, sekretu lub nazwiska w swobodnym zdaniu nie należy przedstawiać
jako możliwego do niezawodnego wykrycia.

Ten kierunek nie oznacza, że wszystkie funkcje docelowego prototypu, pilotaż lub
pakiet instalacyjny są już zaimplementowane.

## Poza pierwszym prototypem

- automatyczna detekcja imion i nazwisk poza dokładnymi polami pacjenta,
- aliasy i złożone reprezentacje pól identyfikujących pacjenta,
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
                         ├── licznik i dymek przy schowanym panelu
                         ├── ukryte podglądy ── panel decyzji
                         │                         │
                         └──── zatwierdzona podmiana zakresu
```

### Warstwy

| Katalog | Odpowiedzialność | Czego nie zna |
| --- | --- | --- |
| `src/core` | typy, zakresy, podglądy i podmiany | React, Chrome, DOM |
| `src/detectors` | czyste reguły danych kontaktowych i pól pacjenta | UI, Chrome, DOM |
| `src/app` | panel i stan interakcji | selektory ChatGPT |
| `src/platform/chromium` | komunikaty, manifestowe API i przyszły storage | reguły detekcji |
| `src/providers/chatgpt` | odczyt, obserwacja i podmiana w natywnym edytorze | React panelu |

### Kierunek zależności

Logika domenowa nie importuje platformy. Adapter zewnętrzny implementuje mały
kontrakt potrzebny aplikacji. Kod ChatGPT może uruchamiać detekcję i maskowanie,
ale nie może zawierać ich reguł. Dodanie detektora powinno wymagać implementacji,
rejestracji i testów, bez zmiany adaptera DOM.

## Model stanu

- Losowy `sessionId` identyfikuje bieżący kontekst szkicu i zmienia się po
  wymianie pola, zmianie URL rozmowy lub ponownym połączeniu content scriptu.
- `revision` zmienia się po zmianie tekstu albo obsługiwanej struktury szkicu.
- Decyzja panelu wskazuje sesję, rewizję i identyfikatory wykrytych zakresów.
- Ręczne zaznaczenie i cofanie są dodatkowo związane z elementem, URL-em oraz
  monotonicznymi generacjami kontekstu i zmian.
- Podmiana jest możliwa tylko wtedy, gdy te warunki oraz bieżąca wartość zakresu
  nadal pasują. Szczegóły kontroli opisuje `SECURITY.md`.
- Brak wykryć, błąd analizy i wynik bez wybranych podmian są trzema różnymi
  stanami.

## Decyzje techniczne

- TypeScript, React, Vite i Vitest; jedna paczka i jeden lockfile.
- Manifest V3 oraz `chrome.sidePanel` dla wspólnego kodu Chrome/Edge.
- Minimalna wersja Chrome to 142 ze względu na natywne zdarzenie zamknięcia
  panelu; Edge zachowuje osobny odbiór kompatybilności.
- Content script jest osobnym, samodzielnym bundłem bez importów runtime.
- Surowy szkic znajduje się w natywnym DOM i jest lokalnie odczytywany przez
  content script. Nie jest przekazywany do panelu ani service workera.
- Obecna wersja nie używa storage. Ewentualne przyszłe użycie wymaga osobnego
  etapu i nie oznacza zgody na zapisywanie oryginalnych wartości; granicę danych
  definiuje `SECURITY.md`.
- DOM otrzymuje tekst przez bezpieczne API tekstowe, nigdy przez `innerHTML`.
- Integracja odmawia modyfikacji zamiast zgadywać selektor albo używać starego
  zakresu.
- Zależności są przypięte do konkretnych wersji; aktualizacja jest osobnym,
  testowanym zadaniem.
