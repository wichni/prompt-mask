# Zasady rozwoju

## Praca etapami

Etap powinien mieć jeden rezultat możliwy do samodzielnego sprawdzenia. Nie
łączymy w jednym etapie nowego detektora, przebudowy UI, zmiany storage i
pakowania, jeśli nie są nierozdzielne.

Każdy etap zawiera:

1. zakres i jawne elementy poza zakresem,
2. kryteria odbioru,
3. najwęższą implementację,
4. testy adekwatne do ryzyka,
5. self-review bezpieczeństwa i czytelności,
6. aktualizację `STATUS.md` i dokumentu obszaru,
7. raport Git oraz zatrzymanie przed następnym etapem.

## Oszczędne wczytywanie kontekstu

1. Zacznij od aktualnego `AGENTS.md`, zwięzłego `STATUS.md` i mapy w `INDEX.md`.
   Nie wczytuj ponownie niezmienionych dokumentów, które są już w kontekście
   bieżącego zadania.
2. Następnie otwórz dokument obszaru oraz potrzebny kod i testy. Najpierw
   wyszukuj ścieżki, symbole i konkretne fragmenty przez `rg`; poszerzaj zakres
   tylko wtedy, gdy wymaga tego zależność lub ryzyko.
3. Po zmianie HEAD porównaj stan z ostatnią zweryfikowaną bazą. Historyczne
   briefy, pełne logi i pozostałe moduły otwieraj tylko dla konkretnej brakującej
   decyzji lub dowodu.
4. `STATUS.md` utrzymuj jako opis teraźniejszości. Zastępuj nieaktualne
   podsumowania zamiast dokładać kolejne pełne raporty. Nie usuwaj jedynego
   uzasadnienia ważnej decyzji, zanim nie ma ono trwałego miejsca kanonicznego.
5. W dokumentacji i raporcie podawaj wynik kontroli oraz istotny błąd, bez
   kopiowania pełnych udanych logów. Nie ograniczaj wymaganych testów
   bezpieczeństwa lub poprawności w celu oszczędzania kontekstu.
6. Linkuj do kanonicznej reguły zamiast kopiować ją między dokumentami,
   briefami i komentarzami. Nowy dokument twórz dopiero dla odrębnego tematu i
   od razu dodaj go do `INDEX.md`.

Zwięzłość nie może usuwać warunków bezpieczeństwa ani ograniczeń produktu.
Dokumentacja i przykłady używają wyłącznie danych syntetycznych; nie są
magazynem szkiców, danych pacjentów ani sekretów.

## Polecenia

```bash
nvm use
npm ci
npm run dev
npm run typecheck
npm test
npm run test:medical
npm run build
git diff --check
```

Plik [`.nvmrc`](../.nvmrc) wskazuje rodzinę Node.js używaną lokalnie i w CI.
`npm ci` odtwarza zależności dokładnie z `package-lock.json`; zwykłe
`npm install` służy wyłącznie do świadomej zmiany zależności i lockfile.

`npm run build` tworzy `dist`, buduje panel oraz samodzielne skrypty rozszerzenia
i sprawdza odwołania manifestu. `dist` jest artefaktem lokalnym i nie jest
śledzony przez Git.

`npm run test:medical` uruchamia wersjonowany syntetyczny korpus MED-001.
Metoda, baza i wyniki są opisane w
[`MEDICAL_EVALUATION.md`](MEDICAL_EVALUATION.md); test należy także do zwykłego
`npm test` i istniejącego CI.

## Continuous Integration

Workflow [`CI`](../.github/workflows/ci.yml) uruchamia job `Verify` dla pull
requestów kierowanych do `main`, pushy do `main` oraz na żądanie. Na świeżym
runnerze `ubuntu-latest` odczytuje wersję Node.js z `.nvmrc`, instaluje
zależności przez `npm ci`, a następnie obowiązkowo wykonuje typecheck, testy i
produkcyjny build. Nowszy przebieg dla tego samego workflow i ref anuluje
starszy.

Lokalnym odpowiednikiem joba są kolejno:

```bash
nvm use
npm ci
npm run typecheck
npm test
npm run build
```

Wynik znajduje się w zakładce **Actions** repozytorium GitHub, w workflow
**CI** i checku **Verify**. Samo istnienie workflow nie potwierdza jego działania
ani nie włącza reguły wymagającej zaliczenia checka przed scaleniem; pierwszy
udany przebieg i ustawienia ochrony gałęzi trzeba odnotować oddzielnie.

## Reguły implementacji

- Modeluj zachowanie domenowe czystymi funkcjami i dyskryminowanymi uniami.
- Nie używaj wyjątków do zwykłych stanów produktu, takich jak brak wykryć.
- Efekty uboczne trzymaj na granicach: React, Chrome API, DOM i storage.
- Funkcja publiczna ma ujawniać intencję; komentarz wyjaśnia tylko nietypową
  decyzję lub ograniczenie platformy.
- Nie dodawaj interfejsu, fabryki ani rejestru „na przyszłość”. Dodaj abstrakcję,
  gdy chroni granicę albo istnieje drugi rzeczywisty wariant.
- Współdziel typy komunikatów, limity i reguły walidacji. Nie współdziel kodu,
  jeśli spina niezależne odpowiedzialności.
- Nowa zależność wymaga uzasadnienia, przypiętej wersji, lockfile i sprawdzenia
  znanych podatności.

## Tekst i zakresy

- Zakres ma postać `[start, end)` i odnosi się do konkretnej wersji wejścia.
- Indeksy są jednostkami UTF-16, zgodnymi z `String.slice` w JavaScript.
- Detektor nie modyfikuje wejścia.
- Nakładania rozstrzyga jeden deterministyczny moduł; nierozstrzygnięty konflikt
  jest widoczny dla użytkownika.
- Podmiany wykonuj od końca tekstu albo przez składanie segmentów. Globalne
  `replace()` jest niedozwolone.
- Testuj polskie znaki, emoji, powtórzenia, granice, konflikty, pominięcia i
  fałszywe alarmy.

## Testowanie

| Zmiana | Minimalny dowód |
| --- | --- |
| czysta logika | testy jednostkowe przypadków pozytywnych i negatywnych |
| stan UI | test unieważnienia i spóźnionego wyniku |
| komunikacja | test dozwolonego payloadu i odrzucenia nadmiarowych pól |
| adapter DOM | atrapa textarea/contenteditable/niejednoznacznego pola + odbiór ręczny |
| manifest lub build | produkcyjny build i kontrola zawartości `dist` |
| Chrome/Edge | osobny ręczny raport: system, wersja i rezultat |

Test atrapy nie potwierdza działania na rzeczywistej stronie. Odbioru
użytkownika nie przypisuj automatyzacji.

## Self-review

Przed raportem sprawdź:

- czy implementacja mieści się w zatwierdzonym etapie,
- czy każda odpowiedzialność ma jedno miejsce,
- czy uproszczenie nie osłabiło granicy bezpieczeństwa,
- czy nie ma duplikacji reguł domenowych,
- czy nazwy opisują zamiar,
- czy błędy nie zawierają danych,
- czy pliki mieszczą się w przybliżonym limicie 200 linii,
- czy dokumentacja odróżnia stan gotowy od planowanego,
- czy Git nie zawiera artefaktów, sekretów ani cudzych zmian.

## Zakończenie zadania i dokumentacja

Przed raportem porównaj zmienione zachowanie z dokumentem właściwego obszaru.
Kod i wymagana aktualizacja dokumentacji należą do tego samego zestawu zmian;
brak takiej aktualizacji oznacza nieukończone zadanie. Nie zmieniaj wszystkich
plików tylko z powodu daty. Jeśli dokument pozostaje zgodny, odnotuj to krótko
w raporcie.

Odpowiedzialności dokumentów są rozdzielone przez `INDEX.md`: `STATUS.md`
opisuje bieżący stan i dowody, `PROJECT.md` cel i kierunek, `SECURITY.md` granicę
danych, ten dokument sposób pracy, a `README.md` instalację, użycie i odbiór.
Usuwaj sprzeczne informacje o stanie bieżącym, zachowując istotne uzasadnienia
decyzji. Po zmianach sprawdź odsyłacze i zgodność z kodem; nie dodawaj testów
sprawdzających literalne brzmienie Markdown.

Raport wiąż z badaną rewizją. Dla niezatwierdzonych zmian użyj opisu „stan
roboczy na bazie `<SHA>`”, wskaż zmienione dokumenty i niewykonaną weryfikację.
