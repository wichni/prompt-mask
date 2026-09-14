# Status projektu

Stan na: 14.09.2026
Wersja manifestu: `0.1.0`

## Działa obecnie

- panel boczny Manifest V3 z React i TypeScript, z akcją „Schowaj” korzystającą
  z natywnego zamknięcia globalnego panelu,
- obserwacja natywnego edytora ChatGPT bez dodatkowego pola; przy schowanym
  panelu strona otrzymuje mały responsywny licznik i ograniczony dymek,
  kotwiczone przy edytorze i mieszczące się w bieżącym viewporcie, a `[•••]`
  pozostaje dostępne wyłącznie przy otwartym panelu,
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
  `patientLastName`, `patientId` i `password` w JSON oraz ograniczonym formacie
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
- dymek wyłącznie z liczbą wykryć, debounce 700 ms, ograniczeniem do jednego
  nowego dymka na 10 sekund, automatycznym ukryciem i obsługą Escape/hover/fokusu,
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
  dla poprawnego zaznaczenia i korzystający z tej samej ręcznej operacji,
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
- pakowanie ZIP i obsługa innych dostawców modeli.

## Dowody automatyczne

- `npm run typecheck` — zaliczony,
- `npm run test:medical` — zaliczone testy: 19/19,
- `npm test -- tests/content-script.test.ts` — zaliczone testy: 53/53 bez
  timeoutu po zwolnieniu portów i nasłuchów każdej instancji testowej,
- `npm test` — zaliczone testy: 313/313 w 19 plikach,
- `npm run build` — zaliczony; manifest nie publikuje już zasobów dodatkowego
  pola, a content script pozostaje samodzielnym bundłem,
- testy BG-001 obejmują analizę bez panelu, pauzę i świeże wznowienie, ścisłe
  sygnały widoczności, odrzucenie komendy przed potwierdzeniem panelu, routing
  dwóch okien, otwarcie przy braku opcjonalnego `sender.tab.url`, odrzucone
  `open()`/`close()`, licznik i dymek bez surowych danych, debounce/cooldown oraz
  anulowanie spóźnionego fokusu; pozycjonowanie ma regresje dla szerokiego,
  wąskiego i bardzo małego viewportu oraz zmiany rozmiaru okna,
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

- Workflow `CI` dla UI-001 na `main`, SHA
  `140c9ad9f6b5b3a7e8daf41916ec692eecfd5847`, zakończył się powodzeniem:
  [run 34821116452](https://github.com/wichni/prompt-mask/actions/runs/34821116452).
  Run potwierdza typecheck, testy 282/282 i build tej rewizji.
- Workflow obejmuje też pull requesty do `main` i uruchomienie ręczne. Zielony
  run nie jest dowodem wymaganej blokady scalania; w czasie przeglądu API GitHub
  zwracało dla `main` `protected: false`. Zmiany administracyjne repozytorium
  pozostają poza tym etapem.
- Dla roboczego BG-001 zdalne CI oczekuje na autoryzowaną publikację nowej
  rewizji.

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
BG-001 ma obecnie wyłącznie dowody automatyczne z atrap DOM i API. Nie wykonano
jeszcze natywnej ścieżki licznik → otwarcie → Schowaj/X → ponowne otwarcie,
restartu workera ani odbioru fokusu na prawdziwej stronie w Chrome lub Edge.

## Wymagany odbiór użytkownika

Instrukcja znajduje się w `README.md`. Odbiór trzeba przeprowadzić oddzielnie w
Chrome i Edge. Test ma potwierdzić wykrycia, pojedyncze, zbiorcze i ręczne
maskowanie, stabilność panelu, brak automatycznego wysłania i poprawną reakcję
po zmianie szkicu. Dla ręcznego wyboru trzeba sprawdzić drugi identyczny
fragment, oba kierunki, przejście fokusu, Unicode i wiele wierszy, odmowę dla
oznaczenia, wszystkie warunki wygaśnięcia oraz pozycję, fokus i zachowanie
kontrolki `[•••]`. Dla licznika i dymka trzeba potwierdzić szeroki i wąski
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

BG-001 jest w stanie roboczym na bazie UI-001
`140c9ad9f6b5b3a7e8daf41916ec692eecfd5847`. Rozdziela aktywność analizy od
widoczności panelu, dodaje licznik, ograniczony dymek, natywne „Schowaj”, ścisły
routing workera i poprawkę spóźnionego fokusu. Nie zmienia detektorów, reguł
maskowania ani uprawnień; podnosi minimum Chrome do 142. Lokalnie zaliczono
typecheck, pełne 313/313, build i kontrolę diffu. Zdalne CI BG-001 oraz ręczny
odbiór w Chrome i Edge oczekują.
