# Status projektu

Stan na: 11.09.2026
Wersja manifestu: `0.1.0`

## Działa obecnie

- panel boczny Manifest V3 z React i TypeScript,
- obserwacja natywnego edytora ChatGPT bez dodatkowego pola; jedynym elementem
  pomocniczym na stronie jest mała kontrolka `[•••]` przy edytorze,
- lokalna analiza tekstu podczas pisania,
- detekcja PESEL z datą i sumą kontrolną,
- detekcja praktycznych adresów e-mail i polskich numerów telefonu,
- lista propozycji z typem i częściowo ukrytym podglądem,
- biało-niebieski panel ze stałym miejscem na dostępny komunikat operacji,
- jedna jawna akcja „Maskuj”; brak decyzji pozostawia propozycję widoczną,
- jawna akcja „Maskuj wszystkie wykryte (N)”, która zatwierdza aktualny zestaw
  wystąpień i zapisuje kompletny wynik do pola jednym wywołaniem adaptera,
- stała akcja „Maskuj zaznaczenie”, dostępna także bez wykryć; zastępuje dokładny
  bieżący zakres oznaczeniem `[DANE_N]` bez przekazywania jego treści do panelu,
- pomocniczy skrót `[•••]` nad prawą krawędzią aktywnego edytora, widoczny tylko
  dla poprawnego zaznaczenia i korzystający z tej samej ręcznej operacji,
- obsługa wyboru myszą i klawiaturą, powtórzeń, wielu węzłów oraz zakresów UTF-16
  z polskimi znakami, emoji i nowymi liniami,
- wspólna reprezentacja obsługiwanych `contenteditable`: akapity `p`/`div`,
  `br`, puste wiersze i jawnie dozwolone elementy liniowe,
- zakresowa modyfikacja DOM zachowująca akapity, wiersze i formatowanie poza
  zmienianym zakresem oraz strukturalne cofnięcie ostatniej operacji,
- fail-closed dla pustego wyboru, białych znaków, zakresu poza polem i zakresu
  nachodzącego na oznaczenie wygenerowane przez promptMask,
- podmiana wyłącznie aktualnego zakresu na `[PESEL_n]`, `[EMAIL_n]` lub
  `[PHONE_n]`,
- potwierdzenie dopiero po rzeczywistej podmianie i ponownej analizie aktualnego
  tekstu,
- jeden poziom „Cofnij” dla ostatniej potwierdzonej podmiany pojedynczej,
  zbiorczej lub ręcznej, dostępny wyłącznie w tym samym, niezmienionym szkicu,
- ponowna analiza przywróconego tekstu oraz fail-closed przy zmianie treści,
  wysłaniu, zmianie rozmowy, karty, pola lub niepewnym wyniku zapisu,
- jednoznaczne zakończenie maskowania i cofania po błędzie zapisu, odczytu,
  kontroli struktury lub analizy potwierdzającej; niepewny zapis unieważnia
  stare decyzje i cofanie bez automatycznego nadpisania zmian strony, a po
  powrocie obsługiwanego edytora nowa jawna operacja działa bez przeładowania,
- rozróżnienie zakończonej analizy bez wykryć od analizy trwającej, błędu i
  braku dostępu do pola,
- odrzucenie nieaktualnej wersji, zmienionego zakresu i nadmiarowych pól,
- losowa tożsamość sesji szkicu wiążąca snapshot, decyzję automatycznego
  maskowania i jej wynik; wymiana pola, zmiana URL rozmowy oraz ponowne
  połączenie unieważniają wcześniejszą decyzję także wtedy, gdy rewizja i
  położenia wykryć są takie same,
- wybór dokładnie jednego kandydata, który jest podłączony do aktywnego
  dokumentu, widoczny, edytowalny, niewyłączony i ma obsługiwaną strukturę;
  brak pewności kończy się odmową modyfikacji,
- brak automatycznego wysyłania, storage, telemetryki i wywołań sieciowych.

## Granica prywatności

Surowy tekst znajduje się w DOM ChatGPT i może być odczytany przez stronę przed
maskowaniem. Content script przechowuje go w pamięci podczas monitorowania,
analizy, walidacji podmiany, tymczasowego rekordu zaznaczenia oraz — dla jednego
poziomu cofania — do czasu pierwszej niezależnej zmiany lub utraty kontekstu.
Panel oraz service worker nie otrzymują szkicu, treści zaznaczenia, oryginału
rekordu ani pełnych wykrytych wartości.

Projektu nie wolno przedstawiać jako gwarancji, że OpenAI nie otrzymało surowej
treści. Aktualna funkcja pomaga użytkownikowi zauważyć i zmienić dane przed
świadomym wysłaniem.

## Nie działa jeszcze

- blokowanie wysłania przy nierozpatrzonych wykryciach,
- spójna mapa oznaczeń w całej rozmowie i `chrome.storage.session`,
- detekcja nazwisk, adresów pocztowych, dokumentów i innych kategorii,
- kopiowanie zatwierdzonego wyniku,
- pakowanie ZIP i obsługa innych dostawców modeli.

## Dowody automatyczne

- `npm run typecheck` — zaliczony,
- `npm test` — zaliczone testy: 121/121,
- `npm run build` — zaliczony; manifest nie publikuje już zasobów dodatkowego
  pola, a content script pozostaje samodzielnym bundłem,
- testy negatywne obejmują błędny PESEL, niejednoznaczny edytor, surowy tekst w
  komunikacie, obcy panel, nieaktualną decyzję, niepełny zestaw zbiorczy i
  powtórzone polecenie, unieważnienie cofania po edycji i wysłaniu, ręczny
  powrót do identycznego tekstu, zmianę pola, podwójne cofnięcie oraz edycję w
  trakcie zapisu. Ręczna ścieżka obejmuje drugi identyczny fragment, odwrotny
  kierunek zaznaczenia, Unicode i nowe linie, wiele węzłów DOM, białe znaki,
  kolizję z oznaczeniem, stare i powtórzone polecenie, niepotwierdzony zapis,
  integrację z cofnięciem i brak surowej treści w komunikatach. Brak odbiorcy
  portu jest obsłużony bez nieodczytanego `runtime.lastError`. Testy sesji
  szkicu odrzucają spóźnioną decyzję po wymianie pola, zmianie URL rozmowy i
  ponownym połączeniu, również przy ponownie użytej rewizji i identycznych
  identyfikatorach zakresów. Kontrolka `[•••]`
  ma testy pozycji, dostępnej nazwy, jednokrotnej aktywacji, izolacji zdarzeń,
  odmowy dla syntetycznego kliknięcia i integracji ze stanem panelu. Adapter DOM
  ma regresje dla dwóch akapitów, `br`, pustego wiersza, zaznaczenia przez
  granicę akapitu, zbiorczego maskowania, strukturalnego cofnięcia, nieznanej
  struktury, zmiany samej struktury szkicu, synchronicznej reakcji strony,
  ukrytego pola, interaktywnego pola w nieinteraktywnej warstwie i dwóch
  jednocześnie poprawnych kandydatów. Regresje F5 potwierdzają pojedyncze,
  zbiorcze i ręczne maskowanie oraz cofanie przy synchronicznym dodaniu
  nieobsługiwanego elementu, dokładnie jeden końcowy wynik pierwszej operacji,
  zachowanie znacznika dodanego przez stronę, odrzucenie starej decyzji,
  sprzątanie mimo błędu ponownej analizy i odzyskanie działania bez
  przeładowania rozszerzenia.

## CI

- Workflow `CI` z jobem `Verify` jest przygotowany w stanie roboczym na bazie
  `5827ed29e3a9f9cbcd16710a849d0f02707d83c8`. Obejmuje pull requesty do `main`,
  push do `main` i uruchomienie ręczne; używa Node.js z `.nvmrc`, `npm ci` oraz
  obowiązkowych kontroli typecheck, testów i builda.
- Workflow nie został jeszcze potwierdzony rzeczywistym uruchomieniem GitHub
  Actions. Nie ma więc linku do runa ani dowodu, że check jest wymagany przez
  reguły ochrony gałęzi. Zmiany administracyjne repozytorium pozostają poza tym
  etapem.
- Lokalny odpowiednik joba zaliczono na Node.js `24.21.0` i npm `11.19.0`:
  czyste `npm ci`, `npm run typecheck`, `npm test` (121/121) oraz
  `npm run build` zakończyły się kodem 0.

## Dowody interfejsu

Użytkownik potwierdził na Chrome, że poprzednia chroniona ramka działała, ale nie
spełniała oczekiwanego UX. Została usunięta. Brief opisuje dwa wcześniejsze
screeny jako dowód wykrycia e-maila i telefonu oraz podmiany e-maila, ale tych
plików nie ma w bieżącym materiale do niezależnej weryfikacji. Nie stanowią więc
dowodu PESEL-u, podmiany telefonu, całej bieżącej zmiany UI ani działania w Edge.
Aktualny selektor publicznej strony to `textarea#mobile-composer-prompt`;
pozostała część bieżącej wersji wymaga pełnego odbioru. Ręczne zaznaczenie,
przejście fokusu do panelu, `[DANE_N]` i cofnięcie nie zostały jeszcze odebrane
na prawdziwej stronie.
Zrzut użytkownika z Chrome potwierdza widoczny panel i stan „Zaznaczenie gotowe
do maskowania”, ale nie potwierdza wykonanej podmiany, cofnięcia ani nowej
kontrolki `[•••]`.
Zrzut z 11.09.2026 wykonany po pierwszej wersji poprawek F2/F3 pokazał
`COMPOSER_NOT_FOUND` mimo widocznego pola. Automatyczna regresja obejmuje teraz
interaktywne pole z `pointer-events: auto` wewnątrz warstwy z
`pointer-events: none`. Po poprawce i ponownym załadowaniu rozszerzenia użytkownik
potwierdził w Chrome, że zgłoszony brak pola już nie występuje. To potwierdza
rozpoznanie edytora, ale nie zastępuje pełnego odbioru maskowania i cofania.
F5 ma dowód automatyczny na atrapie DOM. Ręczny odbiór zwykłego maskowania i
cofania po tej zmianie nie został wykonany ani w Chrome, ani w Edge.

## Wymagany odbiór użytkownika

Instrukcja znajduje się w `README.md`. Odbiór trzeba przeprowadzić oddzielnie w
Chrome i Edge. Test ma potwierdzić wykrycia, pojedyncze, zbiorcze i ręczne
maskowanie, stabilność panelu, brak automatycznego wysłania i poprawną reakcję
po zmianie szkicu. Dla ręcznego wyboru trzeba sprawdzić drugi identyczny
fragment, oba kierunki, przejście fokusu, Unicode i wiele wierszy, odmowę dla
oznaczenia, wszystkie warunki wygaśnięcia oraz pozycję, fokus i zachowanie
kontrolki `[•••]`. Dla cofania trzeba dodatkowo potwierdzić pojedynczą, zbiorczą
i ręczną operację, wygaśnięcie po edycji i wysłaniu oraz zmianę rozmowy.

## Dokumentacja projektu

`AGENTS.md` i `DEVELOPMENT.md` wymagają aktualizacji właściwej dokumentacji w
tym samym zadaniu co zmieniane zachowanie oraz oszczędnego wczytywania kontekstu
przez `INDEX.md`. `PROJECT.md` oddziela bieżące detektory od kandydatów dla
materiałów programistów i testerów systemów medycznych. Kanoniczne opisy
instalacji i granicy danych pozostają odpowiednio w `README.md` i `SECURITY.md`.
Kontrola lokalnych odsyłaczy w siedmiu plikach dokumentacji nie wykazała
uszkodzonych celów.

## Bieżący etap infrastruktury

Automatyczne kontrole repozytorium są przygotowane lokalnie, ale etap pozostaje
nieodebrany do czasu pierwszego udanego przebiegu workflow dla wskazanej
rewizji. Następnego etapu produktu nie rozpoczęto.
