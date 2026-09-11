# Status projektu

Stan na: 11.09.2026
Wersja manifestu: `0.1.0`
Gałąź robocza: `main`, zmiany niezatwierdzone

## Działa obecnie

- panel boczny Manifest V3 z React i TypeScript,
- obserwacja natywnego edytora ChatGPT bez dodatkowego pola lub nakładki,
- lokalna analiza tekstu podczas pisania,
- detekcja PESEL z datą i sumą kontrolną,
- detekcja praktycznych adresów e-mail i polskich numerów telefonu,
- lista propozycji z typem i częściowo ukrytym podglądem,
- biało-niebieski panel ze stałym miejscem na dostępny komunikat operacji,
- jedna jawna akcja „Maskuj”; brak decyzji pozostawia propozycję widoczną,
- jawna akcja „Maskuj wszystkie wykryte (N)”, która zatwierdza aktualny zestaw
  wystąpień i zapisuje kompletny wynik do pola jednym wywołaniem adaptera,
- podmiana wyłącznie aktualnego zakresu na `[PESEL_n]`, `[EMAIL_n]` lub
  `[PHONE_n]`,
- potwierdzenie dopiero po rzeczywistej podmianie i ponownej analizie aktualnego
  tekstu,
- jeden poziom „Cofnij” dla ostatniej potwierdzonej podmiany pojedynczej lub
  zbiorczej, dostępny wyłącznie w tym samym, niezmienionym szkicu,
- ponowna analiza przywróconego tekstu oraz fail-closed przy zmianie treści,
  wysłaniu, zmianie rozmowy, karty, pola lub niepewnym wyniku zapisu,
- rozróżnienie zakończonej analizy bez wykryć od analizy trwającej, błędu i
  braku dostępu do pola,
- odrzucenie nieaktualnej wersji, zmienionego zakresu i nadmiarowych pól,
- brak automatycznego wysyłania, storage, telemetryki i wywołań sieciowych.

## Granica prywatności

Surowy tekst znajduje się w DOM ChatGPT i może być odczytany przez stronę przed
maskowaniem. Content script przechowuje go w pamięci podczas monitorowania,
analizy, walidacji podmiany oraz — dla jednego poziomu cofania — do czasu
pierwszej niezależnej zmiany lub utraty kontekstu. Panel oraz service worker nie
otrzymują szkicu, oryginału rekordu ani pełnych wykrytych wartości.

Projektu nie wolno przedstawiać jako gwarancji, że OpenAI nie otrzymało surowej
treści. Aktualna funkcja pomaga użytkownikowi zauważyć i zmienić dane przed
świadomym wysłaniem.

## Nie działa jeszcze

- blokowanie wysłania przy nierozpatrzonych wykryciach,
- ręczne wskazywanie dodatkowych fragmentów,
- spójna mapa oznaczeń w całej rozmowie i `chrome.storage.session`,
- detekcja nazwisk, adresów pocztowych, dokumentów i innych kategorii,
- kopiowanie zatwierdzonego wyniku,
- pakowanie ZIP i obsługa innych dostawców modeli.

## Dowody automatyczne

- `npm run typecheck` — zaliczony,
- `npm test` — zaliczone testy: 64/64,
- `npm run build` — zaliczony; manifest nie publikuje już zasobów dodatkowego
  pola, a content script pozostaje samodzielnym bundłem,
- testy negatywne obejmują błędny PESEL, niejednoznaczny edytor, surowy tekst w
  komunikacie, obcy panel, nieaktualną decyzję, niepełny zestaw zbiorczy i
  powtórzone polecenie, unieważnienie cofania po edycji i wysłaniu, ręczny
  powrót do identycznego tekstu, zmianę pola, podwójne cofnięcie oraz edycję w
  trakcie zapisu; brak odbiorcy portu jest obsłużony bez nieodczytanego
  `runtime.lastError`.

## Dowody interfejsu

Użytkownik potwierdził na Chrome, że poprzednia chroniona ramka działała, ale nie
spełniała oczekiwanego UX. Została usunięta. Brief opisuje dwa wcześniejsze
screeny jako dowód wykrycia e-maila i telefonu oraz podmiany e-maila, ale tych
plików nie ma w bieżącym materiale do niezależnej weryfikacji. Nie stanowią więc
dowodu PESEL-u, podmiany telefonu, całej bieżącej zmiany UI ani działania w Edge.
Aktualny selektor publicznej strony to `textarea#mobile-composer-prompt`;
bieżąca wersja wymaga ponownego odbioru.

## Wymagany odbiór użytkownika

Instrukcja znajduje się w `README.md`. Odbiór trzeba przeprowadzić oddzielnie w
Chrome i Edge. Test ma potwierdzić wykrycia, pojedyncze i zbiorcze maskowanie,
stabilność panelu, brak automatycznego wysłania i poprawną reakcję po zmianie
szkicu. Dla cofania trzeba dodatkowo potwierdzić pojedynczą i zbiorczą operację,
wygaśnięcie po edycji i wysłaniu oraz zmianę rozmowy.

## Następny kandydat na etap

Ręczne maskowanie wskazanego fragmentu. To propozycja z kolejki, nie
zatwierdzony zakres.
