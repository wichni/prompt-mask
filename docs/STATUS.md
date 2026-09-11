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
- rozróżnienie zakończonej analizy bez wykryć od analizy trwającej, błędu i
  braku dostępu do pola,
- odrzucenie nieaktualnej wersji, zmienionego zakresu i nadmiarowych pól,
- losowa tożsamość sesji szkicu wiążąca snapshot, decyzję automatycznego
  maskowania i jej wynik; wymiana pola, zmiana URL rozmowy oraz ponowne
  połączenie unieważniają wcześniejszą decyzję także wtedy, gdy rewizja i
  położenia wykryć są takie same,
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
- pakowanie ZIP i obsługa innych dostawców modeli,
- adapter `contenteditable` nie zachowuje jeszcze granic akapitów przy odczycie,
  zapisie i cofnięciu,
- wybór edytora nie odrzuca jeszcze każdego ukrytego lub nieedytowalnego
  kandydata o preferowanym identyfikatorze.

## Dowody automatyczne

- `npm run typecheck` — zaliczony,
- `npm test` — zaliczone testy: 87/87,
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
  odmowy dla syntetycznego kliknięcia i integracji ze stanem panelu.

## Dowody interfejsu

Użytkownik potwierdził na Chrome, że poprzednia chroniona ramka działała, ale nie
spełniała oczekiwanego UX. Została usunięta. Brief opisuje dwa wcześniejsze
screeny jako dowód wykrycia e-maila i telefonu oraz podmiany e-maila, ale tych
plików nie ma w bieżącym materiale do niezależnej weryfikacji. Nie stanowią więc
dowodu PESEL-u, podmiany telefonu, całej bieżącej zmiany UI ani działania w Edge.
Aktualny selektor publicznej strony to `textarea#mobile-composer-prompt`;
bieżąca wersja wymaga ponownego odbioru. Ręczne zaznaczenie, przejście fokusu do
panelu, `[DANE_N]` i cofnięcie nie zostały jeszcze odebrane na prawdziwej stronie.
Zrzut użytkownika z Chrome potwierdza widoczny panel i stan „Zaznaczenie gotowe
do maskowania”, ale nie potwierdza wykonanej podmiany, cofnięcia ani nowej
kontrolki `[•••]`.

## Wymagany odbiór użytkownika

Instrukcja znajduje się w `README.md`. Odbiór trzeba przeprowadzić oddzielnie w
Chrome i Edge. Test ma potwierdzić wykrycia, pojedyncze, zbiorcze i ręczne
maskowanie, stabilność panelu, brak automatycznego wysłania i poprawną reakcję
po zmianie szkicu. Dla ręcznego wyboru trzeba sprawdzić drugi identyczny
fragment, oba kierunki, przejście fokusu, Unicode i wiele wierszy, odmowę dla
oznaczenia, wszystkie warunki wygaśnięcia oraz pozycję, fokus i zachowanie
kontrolki `[•••]`. Dla cofania trzeba dodatkowo potwierdzić pojedynczą, zbiorczą
i ręczną operację, wygaśnięcie po edycji i wysłaniu oraz zmianę rozmowy.

## Następny kandydat na etap

Adapter edytora: jednoznaczny wybór widocznego, edytowalnego pola oraz
zachowanie akapitów, `br`, pustych wierszy, zakresów i cofania. To propozycja z
kolejki, nie zatwierdzony zakres.
