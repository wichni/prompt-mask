# Ocena detekcji dla przypadków medycznych

## Zakres i wersja

- zestaw: `MED-001-v1`, 24 przypadki i 28 oznaczonych zakresów ochrony,
- badany stan: roboczy na bazie
  `65e3a1d95af8e0b3ae25cb50e742ebbde6decc9d`,
- silnik: stan roboczy po MED-003 z detektorami PESEL, e-maila, telefonu oraz
  dokładnych pól `patientName`, `patientFirstName`, `patientLastName`,
  `patientId` i `password`,
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
| E-mail | 5 | 2 | 3 | 71,43% | 62,50% |
| Telefon | 4 | 0 | 1 | 100,00% | 80,00% |
| Nazwa pacjenta | 1 | 2 | 0 | 33,33% | 100,00% |
| Identyfikator pacjenta | 2 | 0 | 0 | 100,00% | 100,00% |
| Hasło | 2 | 0 | 0 | 100,00% | 100,00% |
| Kategorie obsługiwane i reprezentowane w korpusie | 16 | 6 | 4 | 72,73% | 80,00% |
| Pozostały sekret | 0 | 6 | 0 | 0,00% | nie dotyczy |
| Pełny oczekiwany zakres | 16 | 12 | 4 | 57,14% | 80,00% |

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
| SEC-02 | 0 | 2 | 0 | dwa sekrety konfiguracji pominięte |
| SEC-03 | 0 | 1 | 0 | token Bearer pominięty |
| SEC-04 | 0 | 1 | 1 | hasło i host URI uznane łącznie za e-mail |
| MIX-01 | 1 | 1 | 0 | PESEL wykryty, token pominięty |
| MIX-02 | 3 | 0 | 0 | wykryte `patientId`, e-mail i `password` |
| MIX-03 | 1 | 1 | 0 | telefon wykryty, nazwa pominięta |
| MIX-04 | 2 | 2 | 2 | telefony dokładne, oba zakresy e-maili za szerokie |
| NEG-01 | 0 | 0 | 0 | brak wykryć |
| NEG-02 | 0 | 0 | 0 | brak wykryć |
| NEG-03 | 0 | 0 | 0 | brak wykryć |
| NEG-04 | 0 | 0 | 1 | numer zlecenia uznany za telefon |
| NEG-05 | 0 | 0 | 0 | same nazwy pól zachowane |
| NEG-06 | 0 | 0 | 0 | istniejące oznaczenia zachowane |
| EDGE-01 | 1 | 1 | 0 | zakres e-maila poprawny po emoji, nazwa pominięta |
| EDGE-02 | 0 | 1 | 0 | token w JSON pominięty |

W `MIX-04` wzorzec e-maila obejmuje także prefiks `email=`, więc wykrycie nie
jest dokładnym trafieniem i automatyczna podmiana usuwa nazwę pola. W `SEC-04`
fragment `hasło@host` w URI wygląda dla obecnego wzorca jak e-mail. `NEG-04`
pokazuje koszt szerokiej heurystyki telefonu.

## Kontrole tekstu

Testy sprawdzają podmianę automatycznych wykryć, zachowanie kodów błędów,
separatorów i kolejności rekordów oraz parsowalność reprezentatywnych JSON-ów.
Strukturalne pola pacjenta i `password` mają kontrole automatycznej podmiany i
parsowalności JSON. Nazwa w swobodnym tekście oraz pozostałe sekrety mają osobne
kontrole ręcznego maskowania; nie poprawia to ich wyniku automatycznego.
Przypadek z emoji potwierdza zakresy UTF-16, a przypadek z ucieczkami —
nienaruszanie składni poza wybranym zakresem.

## Kolejność dalszych prac

1. Naprawić dokładność granic e-maila dla formatu `klucz=wartość` i URI.
   `MIX-04` oraz `SEC-04` odpowiadają za 2 FN i 3 FP, a obecne zakresy mogą
   usuwać kontekst techniczny. Regresje muszą zachować poprawne wyniki z
   `MED-04`, `MED-08`, `MIX-02` i `EDGE-01`.
2. Dodać osobno zatwierdzany, kontekstowy detektor pozostałych sekretów dla
   `client_secret`, kluczy API, nagłówka Bearer i hasła w URI. Obejmuje to 6 FN
   z `SEC-02`–`SEC-04`, `MIX-01` i `EDGE-02`; `NEG-05` ma chronić przed
   maskowaniem samej nazwy pola. Swobodny tekst nie powinien być traktowany jak
   niezawodny sekret.
3. Dopiero później rozważyć nazwy pacjentów poza dokładnymi polami. MED-002
   zamyka `MED-06`, `MED-07` i część `MIX-02`, a MED-003 dodaje dokładne pola
   imienia i nazwiska, ale `MIX-03` i `EDGE-01` pozostają FN. Szersza detekcja
   nazw ma wysoki koszt fałszywych alarmów i wymaga osobnego korpusu negatywnego.

## Uruchomienie

```bash
npm run test:medical
```

Polecenie wykonuje test integralności zestawu, bazowego zachowania, obliczeń
metryk i podmiany. Ten plik jest kanonicznym raportem wyników MED-001.
