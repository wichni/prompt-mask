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

## Polecenia

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
git diff --check
```

`npm run build` tworzy `dist`, buduje panel oraz samodzielne skrypty rozszerzenia
i sprawdza odwołania manifestu. `dist` jest artefaktem lokalnym i nie jest
śledzony przez Git.

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
