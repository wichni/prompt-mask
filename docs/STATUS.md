# Status projektu

Stan na: 05.10.2026
Wersja manifestu: `0.1.0`

## Działa obecnie

- panel boczny Manifest V3 z React i TypeScript, z akcją „Schowaj” korzystającą
  z natywnego zamknięcia globalnego panelu; zamknięcie od razu odbiera staremu
  połączeniu prawo do decyzji oraz unieważnia sesję, zaznaczenie i cofanie,
- obserwacja natywnego edytora ChatGPT bez dodatkowego pola; przy schowanym
  panelu i dodatniej liczbie wykryć strona otrzymuje responsywny pasek z
  licznikiem i przyciskami typów. Pusty szkic, zwykły tekst oraz trwająca lub
  niedostępna analiza nie pokazują licznika; `[•••]` zależy od poprawnego
  zaznaczenia,
- lokalna analiza tekstu podczas pisania działa na widocznej obsługiwanej karcie
  również wtedy, gdy panel nigdy nie został otwarty albo jest schowany,
- pauza i świeże wznowienie po `visibilitychange`, `pagehide` i `pageshow`, z
  anulowaniem observera, RAF, timerów, zaznaczenia, cofania i starej sesji,
- detekcja samodzielnego PESEL-u z poprawną datą i sumą kontrolną oraz
  dokładnie 11 cyfr ASCII w jawnym polu `pesel` niezależnie od wyniku
  walidacji; etykieta określa przesłankę ochrony, nie poprawność numeru,
- detekcja praktycznych adresów e-mail z zachowaniem jawnej etykiety `email=`
  także wtedy, gdy część lokalna zawiera kolejny znak `=`, oraz odmową dla
  danych uwierzytelniających URI i polskich numerów telefonu,
- detekcja wartości dokładnych pól `patientName`, `patientFirstName`,
  `patientLastName`, `patientId` i `password` w JSON, zapisie obiektu z
  niecytowanym kluczem i podwójnie cytowaną wartością oraz ograniczonym formacie
  `klucz=wartość`, bez zgadywania nazwisk lub haseł w zwykłym tekście; pełna
  wartość hasła wygrywa z zawartym PESEL-em, e-mailem lub telefonem, a błędne
  cytowanie i istniejące oznaczenia nie dają częściowych wykryć,
- detekcja typu SECRET dla wartości dokładnych pól `client_secret`, `api_key` i
  `apiToken`, wartości po pełnym prefiksie nagłówka `Authorization: Bearer` oraz
  hasła URI; token Bearer zachowuje otaczające cudzysłowy, nawiasy i separatory,
  a cała wartość wygrywa z heurystykami i ma stały podgląd `•••`,
- lista propozycji z ikoną typu, nazwą i wyłącznie częściowo ukrytym podglądem,
- kompaktowy biało-niebieski panel z nazwą ChatGPT, licznikiem blisko góry i
  komunikatem operacji zajmującym miejsce tylko wtedy, gdy istnieje,
- przyciski „Telefon · N”, „E-mail · N”, „PESEL · N” i pozostałych obsługiwanych
  typów maskują wszystkie bieżące wystąpienia wybranego typu jednym zapisem,
  bez otwierania panelu; pasek ma też lokalne „Cofnij” po udanej podmianie,
- pasek nie zawiera wykrytych wartości, a `[•••]` wybiera pozycję poza nim,
- fokus po operacji związany z konkretną sesją i przyciskiem; zmiana celu,
  kontekstu, widoczności lub operacja uruchomiona przez `[•••]` anuluje żądanie,
- uczciwe rozróżnienie łączenia, pustego szkicu, tekstu bez wykryć, trwającej
  operacji i błędu; podczas operacji stara lista nie jest pokazywana jako
  aktualny wynik,
- jedna jawna akcja „Maskuj”; brak decyzji pozostawia propozycję widoczną,
- jawna akcja „Maskuj wszystkie (N)”, która zatwierdza aktualny zestaw
  wystąpień i zapisuje kompletny wynik do pola jednym wywołaniem adaptera,
- stała akcja „Maskuj zaznaczenie”, dostępna także bez wykryć; zastępuje dokładny
  bieżący zakres oznaczeniem `[DANE_N]` bez przekazywania jego treści do panelu,
- pomocniczy skrót `[•••]` nad prawą krawędzią aktywnego edytora, widoczny tylko
  dla poprawnego zaznaczenia także przy schowanym panelu i korzystający z tej
  samej ręcznej operacji,
- obsługa wyboru myszą i klawiaturą, powtórzeń, wielu węzłów oraz zakresów UTF-16
  z polskimi znakami, emoji i nowymi liniami,
- wspólna reprezentacja obsługiwanych `contenteditable`: akapity `p`/`div`,
  `br`, puste wiersze i jawnie dozwolone elementy liniowe,
- zakresowa modyfikacja DOM zachowująca akapity, wiersze i formatowanie poza
  zmienianym zakresem oraz strukturalne cofnięcie ostatniej operacji,
- fail-closed dla pustego wyboru, białych znaków, zakresu poza polem i zakresu
  nachodzącego na oznaczenie wygenerowane przez promptMask,
- podmiana wyłącznie aktualnego zakresu na oznaczenie właściwego typu, w tym
  `[PATIENT_NAME_n]`, `[PATIENT_FIRST_NAME_n]`, `[PATIENT_LAST_NAME_n]`,
  `[PATIENT_ID_n]`, `[PASSWORD_n]` i `[SECRET_n]`,
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
- detekcja imion i nazwisk poza dokładnymi polami pacjenta, aliasów pól,
  sekretów poza dokładnymi polami i kontekstami opisanymi wyżej, adresów
  pocztowych, dokumentów i innych kategorii,
- kopiowanie zatwierdzonego wyniku,
- automatyczne pakowanie ZIP w skryptach npm i obsługa innych dostawców modeli.

## Paczka konkursowa

- Przygotowano lokalny ZIP `release/promptMask-konkurs-0.1.0-2026-10-05.zip`
  z buildem bieżącego stanu roboczego na bazie
  `349d555feaacf38590d3f8ad6d2ea7e2bc8123b9`.
- Pakiet zawiera folder `rozszerzenie`, opis projektu, instrukcję instalacji
  i użytkowania oraz syntetyczny scenariusz demonstracji w TXT i wspólny PDF.
  Źródła materiałów są w `docs/contest`; instrukcja przygotowania kolejnej
  paczki znajduje się w `README.md`.
- 05.10.2026 lokalnie zaliczono typecheck, 341/341 testów w 20 plikach i build.
- Sprawdzono CRC i rozpakowanie 10 plików ZIP-a, zgodność kopii z buildem
  i dokumentami oraz odwołania manifestu i zasobów panelu. PDF obejmuje
  wszystkie 97 bloków tekstu źródłowego; osiem stron sprawdzono wizualnie.
  `git diff --check` zaliczono.
- To artefakt lokalny, poza Git. Nie oznacza publikacji, nowego zdalnego CI
  ani pełnego odbioru instalacji i działania bieżącej wersji w Chrome/Edge.

## Dowody automatyczne

- dla niecytowanych kluczy obiektu: `npm run typecheck`, `npm test` (341/341 w
  20 plikach), `npm run build` i `git diff --check` — zaliczone lokalnie; testy
  obejmują dokładne pola, aliasy i niepełne wartości, zachowanie składni po
  maskowaniu oraz brak surowej wartości w komunikatach panelu,
- dla bieżącego paska: `npm run typecheck`, `npm test` (330/330 w 20 plikach),
  `npm run build` i `git diff --check` — zaliczone lokalnie; regresje obejmują
  przyciski typów, lokalne cofanie, starą rewizję, brak surowych danych w
  kontrolkach oraz pozycję paska i `[•••]`,
- dla poprzedniej poprawki `[•••]`: `npm run typecheck`, `npm test` (329/329 w 20
  plikach), `npm run build` i `git diff --check` — zaliczone lokalnie przed
  zastąpieniem dymka paskiem,
- `npm run typecheck` — zaliczony,
- `npm run test:medical` — zaliczone testy: 19/19,
- `npm test -- tests/content-script.test.ts` — zaliczone testy: 62/62 bez
  timeoutu po zwolnieniu portów i nasłuchów każdej instancji testowej,
- `npm test` — zaliczone testy: 341/341 w 20 plikach,
- `npm run build` — zaliczony; manifest nie publikuje już zasobów dodatkowego
  pola, a content script pozostaje samodzielnym bundłem,
- testy BG-001 obejmują analizę bez panelu, pauzę i świeże wznowienie, ścisłe
  sygnały widoczności, odrzucenie komendy przed potwierdzeniem panelu, routing
  dwóch okien, otwarcie przy braku opcjonalnego `sender.tab.url`, odrzucone
  `open()`/`close()`, licznik i dymek bez surowych danych, debounce/cooldown oraz
  anulowanie spóźnionego fokusu; pozycjonowanie ma regresje dla szerokiego,
  wąskiego i bardzo małego viewportu oraz zmiany rozmiaru okna,
- regresje BG-001A obejmują odrzucenie opóźnionych sygnałów OPEN/CLOSED osobno
  dla każdego okna, restart workera z nowym źródłem kolejności, natychmiastową
  utratę uprawnień starego portu i cofania po CLOSED, odporność nowego połączenia
  na spóźnione READY/disconnect oraz aktualizację widocznego dymka przy zmianach
  3→1, 1→3 i 1→0 bez przedłużania timera. Fokus i hover są testowane niezależnie.
- regresja widoczności kontrolki potwierdza brak licznika podczas wyszukiwania,
  niedostępnej analizy i wyniku 0, jego pojawienie się dopiero dla dodatniej
  liczby, ponowne ukrycie po usunięciu ostatniego wykrycia oraz brak spóźnionego
  dymka błędu po nieudanym otwarciu panelu,
- testy MED-002/MED-003/MED-004 obejmują dokładne zakresy JSON i
  `klucz=wartość`,
  odrzucenie swobodnego tekstu, niecytowanej nazwy, aliasów, wartości z
  ucieczkami, nadmiernej długości i wielu niedomkniętych kandydatów,
  pierwszeństwo jawnego `patientId` przed heurystyką telefonu i `password` przed
  heurystykami PESEL-u, e-maila i telefonu, odmowę częściowego dopasowania
  niedomkniętych lub nieobsługiwanych przypisań, brak ponownego maskowania
  oznaczeń, prywatny podgląd panelu, walidację komunikatów, automatyczne
  maskowanie, poprawność JSON i brak pełnych wartości poza content scriptem,
- regresje granic e-maila potwierdzają dokładną wartość po `email=`, zachowanie
  etykiet i separatorów, brak fałszywego e-maila dla
  `scheme://user:password@host`, poprawne użycie po zwykłej etykiecie i w
  parametrze URL oraz pełną ścieżkę maskowania i cofnięcia w content scripcie,
- regresje sekretów obejmują dokładne pola JSON i przypisania, Bearer, hasło URI,
  pierwszeństwo nad heurystykami, powtórzoną wartość w haśle i hoście, limity,
  placeholdery, aliasy, niepełny kontekst, ścisłe komunikaty, podgląd `•••`,
  maskowanie, ponowną analizę i cofnięcie bez przekazania wartości do panelu,
- regresje MED-005 obejmują Bearer w pojedynczym i podwójnym cudzysłowie oraz
  JSON-ie, znaki tokenu i padding, limity, nieobsługiwany kandydat, pomijanie
  oznaczeń, dokładne zakresy UTF-16, `email=` z kolejnym `=` w części lokalnej,
  oba położenia parametru URL, pojedyncze i zbiorcze maskowanie, ponowną analizę,
  cofnięcie oraz brak pełnych wartości w komunikatach panelu,
- regresje MED-006 obejmują dokładny klucz `pesel` bez względu na wielkość
  liter, przypisania przez `=` i `:`, JSON string, oba rodzaje cudzysłowów,
  granice wartości i limitów białych znaków, indeksy UTF-16 po emoji, wiele
  rekordów, błędną sumę i datę, brak częściowych dopasowań, aliasy, escape,
  placeholdery, niecytowaną liczbę JSON, deduplikację poprawnego PESEL-u,
  pierwszeństwo `PASSWORD` i `SECRET`, parsowalność JSON, maskowanie zbiorcze,
  ponowną analizę, cofnięcie i brak pełnych wartości w komunikatach panelu,
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

- Workflow `CI` dla BG-001 na `main`, SHA
  `522753413d8b4ac4baa0bd2b409a7a3f7ed0a5c6`, zakończył się powodzeniem:
  [run 34828820574](https://github.com/wichni/prompt-mask/actions/runs/34828820574).
  Run potwierdza typecheck, testy 313/313 i build tej rewizji.
- Workflow `CI` dla UI-001 na `main`, SHA
  `140c9ad9f6b5b3a7e8daf41916ec692eecfd5847`, zakończył się powodzeniem:
  [run 34821116452](https://github.com/wichni/prompt-mask/actions/runs/34821116452).
  Run potwierdza typecheck, testy 282/282 i build tej rewizji.
- Workflow obejmuje też pull requesty do `main` i uruchomienie ręczne. Zielony
  run nie jest dowodem wymaganej blokady scalania; w czasie przeglądu API GitHub
  zwracało dla `main` `protected: false`. Zmiany administracyjne repozytorium
  pozostają poza tym etapem.
- BG-001A pozostaje zmianą lokalną. Zdalne CI tej poprawki oczekuje na osobno
  autoryzowaną publikację nowej rewizji.

## Pomiar MED-001 po MED-006

- W bazie `c793db72a9829aa7f4ff9c664a4e34dc11d283df` istnieją 24 syntetyczne
  przypadki, 28 niezależnych oznaczeń ochrony, jawna
  baza wyników obecnego silnika oraz testy obliczeń i podmiany.
- Dla kategorii obsługiwanych i reprezentowanych w korpusie dokładne wyniki to
  TP 26, FN 2 i FP 1 (czułość 92,86%, precyzja 96,30%). Pełny oczekiwany zakres
  ma te same wyniki, ponieważ wszystkie oznaczone kategorie mają obecnie jawny
  detektor.
  Pola `patientFirstName` i `patientLastName` mają testy jednostkowe i
  integracyjne, ale nie występują w korpusie MED-001-v1. Szczegóły są w
  [`MEDICAL_EVALUATION.md`](MEDICAL_EVALUATION.md).
- MED-002 zamyka oczekiwania `patientName` i `patientId` z `MED-06`, `MED-07`
  oraz części `MIX-02`. MED-003 wykrywa hasła z `SEC-01` i `MIX-02` oraz dodaje
  osobne pola imienia i nazwiska. MED-004 dodaje regresje poza korpusem dla
  pełnego hasła zawierającego PESEL i bezpiecznych granic przypisań; nie zmienia
  golda ani metryk MED-001-v1. Kolejna korekta zmienia wyłącznie bazę wyników
  silnika: e-maile w `MIX-04` mają dokładne zakresy, a `SEC-04` nie daje
  fałszywego e-maila. Etap sekretów dodaje sześć dokładnych TP bez zmiany golda.
  MED-006 zmienia `MED-02` i `MED-03` z FN na dokładne TP bez zmiany tekstów lub
  golda korpusu. Nadal widoczne są telefoniczny fałszywy alarm oraz nazwy
  pacjentów poza dokładnymi polami.

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
Zrzut użytkownika z 14.09.2026 potwierdza analizę w tle i licznik trzech wykryć,
ale ujawnił odmowę otwarcia panelu z kontrolki strony. Worker wymagał
opcjonalnego `sender.tab.url`, którego kontrakt Chrome nie gwarantuje. Regresja
automatyczna obejmuje teraz prawidłowego nadawcę bez tej metadanej; ręczne
potwierdzenie otwarcia po poprawce nadal oczekuje.
Kolejny zrzut z 14.09.2026 potwierdza licznik przy edytorze na szerokim
viewporcie przed korektą pozycji. Po poprawce licznik jest wyrównywany do prawej
krawędzi edytora z odstępem 4 px, a dymek przechodzi pod pole i zmienia układ na
węższym ekranie. Ręczny odbiór tych wariantów nadal oczekuje.
Zrzut użytkownika z 14.09.2026 o 12:16 ujawnił stale widoczny licznik
`promptMask · 0` przy pustym szkicu. Bieżąca korekta ukrywa całą kontrolkę dla
wyniku 0, wyszukiwania i niedostępnej analizy; ma na razie dowód automatyczny,
a ręczne potwierdzenie po przeładowaniu rozszerzenia oczekuje.
Zrzuty użytkownika z 15:25 pokazują stan sprzed MED-002: brak wykrycia
`patientName` oraz tylko istniejące wykrycie e-maila. Nie są dowodem działania
nowych kategorii; po buildzie i przeładowaniu rozszerzenia wymagają ponownego
odbioru na syntetycznym JSON-ie.
Zrzut użytkownika z 18:17 potwierdza w Chrome wykrycie dokładnego pola
`patientName` i istniejącego e-maila po MED-002. Na tym zrzucie `password` nie
jest wykryty, co było punktem wejścia MED-003. Zrzut nie potwierdza podmiany ani
działania pól dodanych w MED-003; wymaga to odbioru po ponownym buildzie i
przeładowaniu rozszerzenia.
MED-004 ma wyłącznie dowód automatyczny. Pełne hasło zawierające PESEL, brak
ponownego wykrycia oznaczenia i odmowa prefiksu niedomkniętego przypisania nie
zostały jeszcze odebrane ręcznie w Chrome ani Edge.
Korekta granic e-maila również ma wyłącznie dowód automatyczny; zachowanie
`email=` i odmowa dla danych uwierzytelniających URI nie zostały odebrane
ręcznie w Chrome ani Edge.
Sekrety kontekstowe również mają tylko dowód automatyczny; ich podgląd,
maskowanie i cofnięcie nie zostały odebrane ręcznie w Chrome ani Edge.
MED-005 ma tylko dowód automatyczny. Zachowanie cytowanego Bearer, parametru
`email=` z kolejnym `=` w adresie, podmiany zbiorczej i cofnięcia nie zostało
odebrane ręcznie w Chrome ani Edge.
MED-006 ma tylko dowód automatyczny. Różnica między błędnym PESEL-em bez
etykiety i w dokładnym polu `pesel`, zachowanie JSON, maskowanie zbiorcze oraz
cofnięcie nie zostały jeszcze odebrane ręcznie w Chrome ani Edge.
Użytkownik zgłosił po MED-006A, że rozszerzenie działa w Chrome. Zgłoszenie nie
zawiera wersji przeglądarki ani systemu i nie zastępuje pełnego odbioru
scenariuszy MED-006 lub UI-001; Edge nadal nie ma zgłoszonego odbioru.
Użytkownik zgłosił, że UI-001 został wgrany do `main` i przetestowany; wcześniej
potwierdził działanie w Chrome. Zgłoszenie nie zawiera wersji przeglądarki ani
systemu, zakresu wykonanych scenariuszy ani odbioru Edge. UI-001 ma też zielone
CI dokładnej rewizji `140c9ad9f6b5b3a7e8daf41916ec692eecfd5847`.
BG-001 ma zielone CI dokładnej rewizji bazowej, ale nie ma pełnego natywnego
odbioru. BG-001A ma obecnie wyłącznie dowody lokalne z atrap DOM i API. Nie
wykonano jeszcze natywnej ścieżki licznik → otwarcie → Schowaj/X → ponowne
otwarcie, restartu workera, szybkiej zmiany kart i okien ani odbioru aktualizacji
i fokusu dymka na prawdziwej stronie w Chrome lub Edge.
Zrzuty użytkownika z 29.09.2026 pokazują, że `[•••]` pojawia się przy otwartym
panelu, ale nie przy schowanym i zaznaczonym tekście; nowe testy atrapy DOM
obejmują wybór przed otwarciem panelu i po jego zamknięciu. Ręczny odbiór tej
poprawki w Chrome i Edge nadal oczekuje.
Zrzut użytkownika z 29.09.2026 o 14:21 pokazuje nachodzenie na siebie dymka,
licznika i `[•••]`. Bieżąca lokalna poprawka zastępuje dymek paskiem i
pozycjonuje skrót poza nim; odbiór rzeczywistej geometrii czeka.

## Wymagany odbiór użytkownika

Instrukcja znajduje się w `README.md`. Odbiór trzeba przeprowadzić oddzielnie w
Chrome i Edge. Test ma potwierdzić wykrycia, pojedyncze, zbiorcze i ręczne
maskowanie, stabilność panelu, brak automatycznego wysłania i poprawną reakcję
po zmianie szkicu. Dla ręcznego wyboru trzeba sprawdzić drugi identyczny
fragment, oba kierunki, przejście fokusu, Unicode i wiele wierszy, odmowę dla
oznaczenia, wszystkie warunki wygaśnięcia oraz pozycję, fokus i zachowanie
kontrolki `[•••]`. Dla paska i skrótu trzeba potwierdzić szeroki i wąski
viewport, zmianę rozmiaru okna oraz przejście pod edytor przy braku miejsca nad
nim. Dla cofania trzeba dodatkowo potwierdzić pojedynczą, zbiorczą i ręczną
operację, wygaśnięcie po edycji i wysłaniu oraz zmianę rozmowy.

## Dokumentacja projektu

`AGENTS.md` i `DEVELOPMENT.md` wymagają aktualizacji właściwej dokumentacji w
tym samym zadaniu co zmieniane zachowanie oraz oszczędnego wczytywania kontekstu
przez `INDEX.md`. `PROJECT.md` oddziela bieżące detektory od kandydatów dla
materiałów programistów i testerów systemów medycznych. Kanoniczne opisy
instalacji i granicy danych pozostają odpowiednio w `README.md` i `SECURITY.md`.
Kontrola lokalnych odsyłaczy w ośmiu plikach dokumentacji nie wykazała
uszkodzonych celów.

## Bieżący etap

Etap konkursowy przygotowuje samodzielną paczkę gotowego rozszerzenia
i dokumentację dla jury. Nie zmienia działania rozszerzenia ani granicy danych.
Zdalne CI i pełny ręczny odbiór Chrome/Edge bieżącego stanu nadal oczekują.
