# Granica bezpieczeństwa

## Założenie

promptMask jest lokalnym doradcą działającym nad natywnym edytorem ChatGPT.
Wykrywa wybrane wzorce i pozwala użytkownikowi zmienić konkretny fragment przed
ręcznym wysłaniem. Nie jest szczelną bramą DLP i nie gwarantuje anonimizacji.

## Świadomie przyjęte ograniczenie

Surowa treść powstaje w DOM ChatGPT. Strona może ją odczytać podczas pisania,
zanim promptMask pokaże ostrzeżenie lub wykona podmianę. Rozszerzenie nie jest w
stanie wiarygodnie wykluczyć autosave, telemetryki ani innej transmisji strony.

Obietnica produktu brzmi: „promptMask analizuje lokalnie i pomaga zamaskować
tekst przed świadomym wysłaniem”. Nie wolno jej zamieniać na: „OpenAI nigdy nie
otrzyma surowego tekstu”.

## Konteksty i dane

| Kontekst | Surowy tekst | Pełne wykryte wartości | Rola |
| --- | ---: | ---: | --- |
| strona ChatGPT | tak | tak | właściciel natywnego DOM |
| content script | tak, w pamięci | tak, w pamięci | analiza, podmiana i jeden tymczasowy rekord cofania |
| panel rozszerzenia | nie | nie | typ, ukryty podgląd i decyzja |
| service worker | nie | nie | otwieranie panelu |
| storage | nie | nie | obecnie nieużywany |

Content script nie loguje ani nie przekazuje surowego szkicu. Panel otrzymuje
tylko długość, wersję, listę `{ id, kind, maskedPreview }` oraz identyfikator i
status ostatniej operacji. Oryginał i oczekiwany wynik potrzebne do cofnięcia nie
opuszczają content scriptu i nie trafiają do trwałego magazynu.

## Dozwolony przepływ

```text
natywny edytor ChatGPT
  → lokalne detektory w content scripcie
  → ukryte podglądy w panelu
  → decyzja użytkownika z listą id i wersją
  → walidacja aktualnego tekstu i wszystkich wybranych zakresów
  → jeden zapis kompletnego tekstu z oznaczeniami w natywnym edytorze
  → opcjonalne cofnięcie po ponownej walidacji tego samego, niezmienionego szkicu
  → opcjonalne ręczne wysłanie przez użytkownika
```

## Reguły modyfikacji

Podmiana nie zachodzi, gdy:

- pole nie zostało znalezione jednoznacznie,
- decyzja ma nieznany typ lub dodatkowe pola,
- nadawca nie jest panelem bieżącego rozszerzenia,
- wersja decyzji nie odpowiada bieżącemu szkicowi,
- zbiorcza decyzja nie odpowiada dokładnie aktualnej liście propozycji,
- bieżący zakres nie zawiera wcześniej wykrytej wartości,
- zakresy nakładają się albo nie można przygotować kompletnego planu podmian,
- tekst przekracza limit 12 000 jednostek UTF-16,
- wystąpił błąd odczytu albo zapisu DOM.

Cofnięcie nie zachodzi, gdy rekord nie jest bieżący, tekst nie jest dokładnie
oczekiwanym wynikiem maskowania, zmieniła się rewizja lub generacja szkicu,
aktywny jest inny dokument, URL albo element edytora lub trwa inna operacja.
Pierwsza niezależna edycja, wysłanie formularza, zmiana kontekstu, utrata pola,
rozłączenie content scriptu albo niepewny zapis bezpowrotnie usuwa rekord.
Powrót do identycznego ciągu znaków nie odtwarza możliwości cofnięcia.

Błąd promptMask nie blokuje natywnego interfejsu ChatGPT. Użytkownik nadal może
wysłać surowy tekst, dlatego UI nie może sugerować pełnej ochrony.

## Zagrożenia i kontrolki

| Zagrożenie | Kontrolka |
| --- | --- |
| XSS przez wykrytą wartość | React i operacje tekstowe; brak produkcyjnego `innerHTML` |
| wyciek przez komunikat | ścisłe typy `unknown`; panel dostaje tylko ukryty podgląd |
| obcy panel lub komenda | dokładny `sender.id`, URL panelu i allowlista pól |
| użycie starego zakresu | wersja szkicu i ponowne porównanie wartości zakresu |
| błędny selektor | priorytet selektorów i odmowa przy niejednoznaczności |
| częściowa podmiana zbiorcza | walidacja całego planu przed jednym zapisem DOM |
| globalna podmiana wartości | zakresy `[start, end)` i składanie tekstu bez globalnego `replace()` |
| wyciek przez logi | brak logowania payloadów i wykrytych wartości |
| dodatkowy kanał sieciowy | brak API modeli, telemetryki i wywołań sieciowych rozszerzenia |
| ReDoS lub blokada UI | limit wejścia i liniowe, ograniczone wzorce |
| automatyczne wysłanie | rozszerzenie nie uruchamia przycisku ani skrótu wysyłania |
| cofnięcie w innym lub zmienionym szkicu | referencja pola, URL, rewizja i monotoniczne generacje kontekstu i zmian |
| nadpisanie późniejszej edycji przez cofnięcie | końcowa synchroniczna kontrola bezpośrednio przed zapisem i weryfikacja wyniku bez automatycznego rollbacku |
| wyciek oryginału z rekordu cofania | rekord tylko w pamięci content scriptu; panel otrzymuje wyłącznie identyfikator operacji i status |

## Zakres obecnych detektorów

- PESEL: 11 cyfr, poprawna zakodowana data i suma kontrolna,
- e-mail: praktyczny adres z domeną wieloczłonową,
- telefon: dziewięć cyfr, opcjonalne `+48`, spacje albo myślniki.

Detektory heurystyczne mogą generować fałszywe alarmy i pominięcia. Decyzja
zawsze należy do użytkownika.

## Checklist zmiany granicy

1. Czy nowy kontekst otrzymuje surowy tekst lub pełną wartość?
2. Czy komunikaty odrzucają dodatkowe pola i obcego nadawcę?
3. Czy stara decyzja może zmienić nowszy szkic?
4. Czy błąd kończy się brakiem modyfikacji?
5. Czy logi i storage pozostają bez payloadu?
6. Czy dodano test pozytywny, negatywny i test zakresu?
7. Czy zaktualizowano ten dokument oraz `STATUS.md`?
