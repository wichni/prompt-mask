# Ocena detekcji dla przypadków medycznych

## Zakres i wersja

- zestaw: `MED-001-v1`, 24 przypadki i 28 oznaczonych zakresów ochrony,
- badany stan: roboczy na bazie
  `0602da6a1080ae0de99624bc1d63ffa37c509ef8`,
- silnik: stan roboczy po MED-005, z detektorami PESEL, e-maila, telefonu,
  dokładnych pól pacjenta i hasła oraz typu SECRET dla zatwierdzonych
  kontekstów,
- dane: wyłącznie wartości utworzone na potrzeby testów; bez logów firmy,
  danych pacjentów i działających sekretów.

To mały, celowo dobrany zestaw regresyjny. Wynik nie jest estymacją skuteczności
na wszystkich danych medycznych, liczbą zapobieżonych wycieków ani dowodem
anonimizacji. Przypadków nie wysyłano do modelu.

## Metoda

Każdy oczekiwany zakres jest oznaczony niezależnie od regexów produkcyjnych jako
`[start, end)` w jednostkach UTF-16. Anotacja zawiera kontrolną wartość, kategorię
i uzasadnienie. Test sprawdza wartość przez `String.slice`, poprawność zakresów,
brak nakładania oraz obecność treści, która ma pozostać.

Trafienie wymaga tej samej kategorii oraz dokładnie tego samego początku i końca.
Dopasowanie jest jeden do jednego. Pominięcie to FN, a wynik bez dopasowania to
FP. Częściowy zakres lub błędna kategoria daje jednocześnie FN i FP oraz osobną
informację o rozbieżności. Ręczne maskowanie nie jest liczone jako automatyczne
wykrycie.

Jawna baza w `tests/fixtures/medical-baseline.ts` zapisuje tylko typy i zakresy
obecnych wykryć. Test nie generuje jej ponownie. Zmiana detektora wymaga przeglądu
różnic i świadomej aktualizacji tego raportu.

## Wyniki

| Zakres | TP | FN | FP | Czułość | Precyzja |
| --- | ---: | ---: | ---: | ---: | ---: |
| PESEL | 2 | 2 | 0 | 50,00% | 100,00% |
| E-mail | 7 | 0 | 0 | 100,00% | 100,00% |
| Telefon | 4 | 0 | 1 | 100,00% | 80,00% |
| Nazwa pacjenta | 1 | 2 | 0 | 33,33% | 100,00% |
| Identyfikator pacjenta | 2 | 0 | 0 | 100,00% | 100,00% |
| Hasło | 2 | 0 | 0 | 100,00% | 100,00% |
| Kategorie obsługiwane i reprezentowane w korpusie | 24 | 4 | 1 | 85,71% | 96,00% |
| Sekret techniczny | 6 | 0 | 0 | 100,00% | 100,00% |
| Pełny oczekiwany zakres | 24 | 4 | 1 | 85,71% | 96,00% |

Pola `patientFirstName` i `patientLastName` są objęte testami jednostkowymi i
integracyjnymi, ale MED-001-v1 nie zawiera jeszcze osobnych oznaczeń tych
kategorii. Nie są więc doliczane do powyższych metryk.

W jednym z sześciu przypadków bez danych do ukrycia wystąpił fałszywy alarm.

| ID | TP | FN | FP | Najważniejszy wynik |
| --- | ---: | ---: | ---: | --- |
| MED-01 | 1 | 0 | 0 | poprawny PESEL |
| MED-02 | 0 | 1 | 0 | PESEL z błędną sumą pominięty |
| MED-03 | 0 | 1 | 0 | PESEL z niemożliwą datą pominięty |
| MED-04 | 1 | 0 | 0 | dokładny e-mail w JSON |
| MED-05 | 1 | 0 | 0 | dokładny telefon z prefiksem |
| MED-06 | 1 | 0 | 0 | dokładna wartość `patientName` w JSON |
| MED-07 | 1 | 0 | 0 | dokładna wartość `patientId` w przypisaniu |
| MED-08 | 2 | 0 | 0 | oba wystąpienia e-maila wykryte |
| SEC-01 | 1 | 0 | 0 | dokładna wartość `password` w JSON |
| SEC-02 | 2 | 0 | 0 | dokładne `client_secret` i `api_key` |
| SEC-03 | 1 | 0 | 0 | dokładna wartość Bearer |
| SEC-04 | 1 | 0 | 0 | dokładne hasło URI bez fałszywego e-maila |
| MIX-01 | 2 | 0 | 0 | dokładny PESEL i token Bearer |
| MIX-02 | 3 | 0 | 0 | wykryte `patientId`, e-mail i `password` |
| MIX-03 | 1 | 1 | 0 | telefon wykryty, nazwa pominięta |
| MIX-04 | 4 | 0 | 0 | dokładne e-maile i telefony, etykiety zachowane |
| NEG-01 | 0 | 0 | 0 | brak wykryć |
| NEG-02 | 0 | 0 | 0 | brak wykryć |
| NEG-03 | 0 | 0 | 0 | brak wykryć |
| NEG-04 | 0 | 0 | 1 | numer zlecenia uznany za telefon |
| NEG-05 | 0 | 0 | 0 | same nazwy pól zachowane |
| NEG-06 | 0 | 0 | 0 | istniejące oznaczenia zachowane |
| EDGE-01 | 1 | 1 | 0 | zakres e-maila poprawny po emoji, nazwa pominięta |
| EDGE-02 | 1 | 0 | 0 | dokładna wartość `apiToken` w JSON |

Korekta granic e-maila zachowuje etykiety `email=` w `MIX-04`. Kontekstowy
detektor SECRET obejmuje sześć dokładnych wartości z `SEC-02`–`SEC-04`,
`MIX-01` i `EDGE-02`, bez zmiany niezależnych adnotacji gold. `NEG-04` nadal
pokazuje koszt szerokiej heurystyki telefonu.

Poza bazowymi 24 przypadkami MED-004 dodaje regresje dla hasła zawierającego
poprawny PESEL oraz dla granic cytowanych i niecytowanych przypisań. Pełna
wartość dokładnego pola `password` pozostaje jednym wykryciem PASSWORD ze stałym
podglądem, a niezamknięty, nieobsługiwany lub już zamaskowany zapis nie daje
częściowego wykrycia. Te dodatkowe przypadki nie zmieniają golda ani powyższych
metryk MED-001-v1.

MED-005 dodaje poza korpusem regresje dla tokenu Bearer w cudzysłowach i JSON-ie,
nieobsługiwanych znaków i limitu wartości, istniejących oznaczeń, a także dla
`email=` z kolejnym `=` w części lokalnej adresu oraz w parametrze URL. Testy
sprawdzają dokładne zakresy UTF-16, składnię po podmianie, ponowną analizę,
cofnięcie i brak pełnych wartości w komunikatach. Zestaw `MED-001-v1`, gold i
powyższe metryki pozostają bez zmian; tych regresji nie należy przedstawiać jako
pomiaru skuteczności na wszystkich danych.

## Kontrole tekstu

Testy sprawdzają podmianę automatycznych wykryć, zachowanie kodów błędów,
separatorów i kolejności rekordów oraz parsowalność reprezentatywnych JSON-ów.
Strukturalne pola pacjenta, `password` i sekretów mają kontrole automatycznej
podmiany i parsowalności JSON. Nazwa w swobodnym tekście ma osobną kontrolę
ręcznego maskowania; nie poprawia to jej wyniku automatycznego.
Przypadek z emoji potwierdza zakresy UTF-16, a przypadek z ucieczkami —
nienaruszanie składni poza wybranym zakresem.

## Kolejność dalszych prac

MED-004 zamyka pierwszeństwo pełnej wartości hasła i granice jego przypisań.
MED-005 domyka cytowane granice Bearer oraz `email=` z kolejnym `=` w części
lokalnej. Po osobnym odbiorze Chrome i Edge dalszy etap wymaga nowej decyzji:

1. Rozważyć jawne pole PESEL dla wartości z błędną datą lub sumą kontrolną bez
   osłabiania walidacji wszystkich 11-cyfrowych ciągów. Nazwy poza dokładnymi
   polami nadal pozostają osobnym, ryzykownym kandydatem wymagającym korpusu
   negatywnego.

## Uruchomienie

```bash
npm run test:medical
```

Polecenie wykonuje test integralności zestawu, bazowego zachowania, obliczeń
metryk i podmiany. Ten plik jest kanonicznym raportem wyników MED-001.
