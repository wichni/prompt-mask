# promptMask

Rozszerzenie Chromium, które lokalnie analizuje tekst wpisywany w natywnym
edytorze ChatGPT także przy schowanym panelu. Dyskretny licznik przy edytorze
sygnalizuje liczbę propozycji, a użytkownik otwiera panel dopiero wtedy, gdy chce
je sprawdzić lub zamaskować.

## Działa obecnie

1. Użytkownik pisze normalnie w polu ChatGPT.
2. Content script lokalnie analizuje bieżący tekst.
3. Panel pokazuje możliwy PESEL, adres e-mail, polski numer telefonu albo
   wartość jawnego pola `patientName`, `patientFirstName`, `patientLastName`,
   `patientId`, `password`, `client_secret`, `api_key` lub `apiToken` w JSON i
   formacie `klucz=wartość`. Rozpoznaje też wartość nagłówka
   `Authorization: Bearer` i hasło w URI z jawnym `scheme://user:password@host`.
   Dokładne pole `pesel` może otrzymać propozycję także wtedy, gdy jego
   11-cyfrowa wartość nie przechodzi walidacji daty lub sumy kontrolnej.
4. „Maskuj” zastępuje wyłącznie aktualny wykryty zakres oznaczeniem, np.
   `[PESEL_1]`.
5. „Maskuj wszystkie (N)” zatwierdza dokładnie aktualną listę i wykonuje
   wszystkie podmiany jednym zapisem do pola.
6. Po ponownej analizie panel potwierdza wykonaną operację. Brak kliknięcia
   pozostawia propozycje widoczne.
7. „Cofnij” przy ostatnim potwierdzeniu przywraca stan bieżącego pola ChatGPT
   sprzed pojedynczej podmiany albo całej podmiany zbiorczej.
8. „Maskuj zaznaczenie” zastępuje dokładnie jeden aktualnie zaznaczony fragment
   ogólnym oznaczeniem `[DANE_N]`, również gdy detektory niczego nie znalazły.
9. Przy poprawnym zaznaczeniu nad prawą krawędzią edytora pojawia się mały skrót
   `[•••]`, uruchamiający dokładnie tę samą ręczną operację.
10. „Schowaj” zamyka panel, ale pozostawia lokalną analizę i licznik na
    widocznej karcie. Dymek pokazuje wyłącznie liczbę nowych propozycji i akcję
    „Sprawdź”.

Panel pokazuje u góry kompaktowy stan połączenia z ChatGPT, a potem sekcję
„Do sprawdzenia”. Pusty szkic ma komunikat „Zacznij pisać”, natomiast tekst bez
obsługiwanych danych — „Brak wykryć”. Komunikat operacji i „Cofnij” pojawiają
się tylko wtedy, gdy są potrzebne. Pod listą pozostaje pomocnicze „Maskuj
zaznaczenie” oraz stała informacja, że strona ChatGPT ma dostęp do wpisanego
tekstu. Po schowaniu panelu jego funkcje decyzyjne i `[•••]` są wyłączone;
licznik służy tylko do ponownego otwarcia panelu.

Aby zamaskować fragment ręcznie, zaznacz go myszą albo klawiaturą w polu
wiadomości, a następnie kliknij `[•••]` przy edytorze albo „Maskuj zaznaczenie”
w panelu. Obie kontrolki korzystają z tej samej operacji. Jedna operacja zmienia
tylko jedno wskazane wystąpienie. Pusty wybór, same białe znaki oraz zakres
nachodzący na oznaczenie utworzone przez promptMask są odrzucane.

Cofanie ma jeden poziom i działa tylko tak długo, jak użytkownik nie schował
panelu, nie zmienił szkicu, pola, rozmowy ani aktywnej karty i nie wysłał
wiadomości. Nowe udane
maskowanie — także ręczne — zastępuje poprzednią możliwość cofnięcia. Po
cofnięciu przywrócone dane ponownie pojawiają się jako propozycje, ale drugie
cofnięcie nie jest dostępne. Zapisane zaznaczenie wygasa po edycji, innym
maskowaniu, cofnięciu, wysłaniu, zmianie szkicu, rozmowy, karty lub pola. Powrót
do identycznego tekstu nie przywraca starego wyboru.

Oryginał potrzebny do cofnięcia istnieje tymczasowo wyłącznie w pamięci content
scriptu aktywnego szkicu. Nie jest przekazywany do panelu ani zapisywany w
`chrome.storage`, localStorage, IndexedDB, plikach lub logach. Przeładowanie
strony albo rozłączenie komponentu usuwa możliwość cofnięcia.

Rozszerzenie nie klika „Wyślij”, nie zapisuje szkicu i nie wykonuje własnych
wywołań sieciowych.

## Ważne ograniczenie prywatności

Surowy tekst znajduje się w natywnym polu ChatGPT. Może więc zostać odczytany
przez skrypty strony jeszcze przed maskowaniem. promptMask ogranicza ryzyko
przypadkowego świadomego wysłania danych, ale nie może gwarantować, że strona
lub jej dostawca wcześniej nie otrzymali treści.

## Wymagania i build

- Node.js z rodziny wskazanej w [`.nvmrc`](.nvmrc)
- npm dostarczony z tą wersją Node.js
- Chrome 142+
- Microsoft Edge wyłącznie po osobnym sprawdzeniu dostępności API i odbiorze

```bash
nvm use
npm ci
npm run typecheck
npm test
npm run build
```

Te same trzy kontrole uruchamia workflow GitHub Actions. Opis CI i jego lokalny
odpowiednik znajdują się w [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md#continuous-integration).

## Instalacja lokalna

1. Otwórz `chrome://extensions` albo `edge://extensions`.
2. Włącz tryb deweloperski.
3. Wybierz „Załaduj rozpakowane” i wskaż katalog `dist`.
4. Otwórz `https://chatgpt.com/` i nową rozmowę.
5. Zacznij pisać albo kliknij ikonę promptMask, aby otworzyć panel boczny.

Po kolejnym buildzie kliknij „Odśwież” na karcie rozszerzenia, a następnie
odśwież stronę ChatGPT.

## Ręczny odbiór bieżącego etapu

Używaj wyłącznie danych utworzonych na potrzeby testu.

Najpierw odbierz zachowanie BG-001 w Chrome 142 lub nowszym:

1. Po F5, bez otwierania panelu, wpisz `email=qa@example.com`. Sprawdź licznik,
   dymek i zachowanie fokusu edytora. Zmniejsz i zwiększ okno: kontrolki mają
   pozostać przy edytorze i wewnątrz viewportu; przy braku miejsca nad polem
   powinny przejść pod nie.
2. Dopisz zwykły tekst, zamknij dymek i dodaj kolejny typ danych. Ten sam wynik
   nie powinien ponawiać dymka, a wzrost liczby powinien użyć aktualnej wartości.
3. Otwórz panel kolejno przez „Sprawdź”, licznik i ikonę rozszerzenia.
4. Sprawdź pojedyncze, zbiorcze i ręczne maskowanie oraz dokładne „Cofnij”.
5. Użyj „Schowaj” i natywnego X. W obu przypadkach analiza ma działać dalej,
   a po ponownym otwarciu stare „Cofnij” i sukces nie mogą wrócić.
6. Powtórz na dwóch rozmowach, kartach i oknach oraz po zmianie rozmowy, F5,
   przejściu na inną domenę i powrocie.
7. Sprawdź uśpienie lub diagnostyczny restart workera, klawiaturę, zoom, wąski
   panel, limit tekstu i brak edytora.

Zapisz wersję Chrome i systemu. Edge wymaga oddzielnego odbioru; testy
automatyczne nie potwierdzają zachowania natywnego panelu ani gestu użytkownika.

Przed pozostałymi scenariuszami wpisz:

```json
{"patientName":"Żaneta Próba","patientFirstName":"Iga","patientLastName":"Modelowa","patientId":"PT-Z19-44","password":"P@ss-demo-7!Q","error":"E_17"}
```

Panel powinien pokazać pięć propozycji bez pełnych wartości: pełną nazwę, imię,
nazwisko, identyfikator pacjenta i hasło. Zbiorcze maskowanie ma pozostawić
poprawny JSON:

```json
{"patientName":"[PATIENT_NAME_1]","patientFirstName":"[PATIENT_FIRST_NAME_1]","patientLastName":"[PATIENT_LAST_NAME_1]","patientId":"[PATIENT_ID_1]","password":"[PASSWORD_1]","error":"E_17"}
```

Swobodne zdanie `Pacjentka Żaneta Próba` nie powinno zostać automatycznie
zaklasyfikowane jako nazwa pacjenta. Niejednoznaczne `patientName=Jan Testowy`
bez cudzysłowów również ma pozostać bez automatycznej propozycji. Samo słowo
`password` bez wartości nie jest wykryciem.

Dla sekretów technicznych użyj syntetycznego tekstu:

```text
client_secret=demo-client-Z8x!; api_key=sk_demo_A1b2C3d4; Authorization: Bearer demo.jwt.token-7X; postgresql://tester:demo-db-P4ss@db.invalid/clinic
```

Panel powinien pokazać cztery pozycje „Sekret” wyłącznie z podglądem `•••`.
Maskowanie zbiorcze ma zachować nazwy pól, schemat nagłówka oraz URI, zmieniając
tylko cztery wartości na kolejne `[SECRET_n]`; „Cofnij” ma przywrócić dokładny
tekst. Same nazwy pól, aliasy i słowo `Bearer` bez pełnego kontekstu nie są
wykryciami.

Dla granic MED-005 sprawdź też osobno dwa syntetyczne wejścia:

```text
curl -H "Authorization: Bearer demo.jwt.token-7X" https://example.invalid
email=qa=demo@example.com status=422
```

Po maskowaniu mają pozostać odpowiednio zamykający cudzysłów i URL oraz dokładna
etykieta `email=` i `status=422`. Ponowna analiza nie może proponować
`[SECRET_1]`, a „Cofnij” ma odtworzyć każde wejście dokładnie. Następnie wklej
oba w osobnych wierszach i sprawdź tę samą składnię po „Maskuj wszystkie”.

Dla MED-006 porównaj poprawny PESEL bez etykiety, błędny bez etykiety oraz
błędny w dokładnym polu `pesel`. Pierwszy, trzeci i czwarty mają dać
propozycję:

```text
02070803628
02070803627
pesel=02070803627
{"PESEL":"02323203627","error":"INVALID_BIRTH_DATE"}
```

W ostatnich dwóch wejściach maskowanie ma objąć wyłącznie cyfry, pozostawiając
etykietę, cudzysłowy i kod błędu. Sprawdź także odmowę dla `[PESEL_1]` oraz 12
cyfr, a następnie zbiorcze maskowanie dwóch jawnych pól i dokładne „Cofnij”.

1. Wpisz do zwykłego pola ChatGPT syntetyczny e-mail, telefon i poprawny PESEL.
2. Sprawdź biało-niebieską paletę, trzy propozycje, licznik oraz aktywne
   „Maskuj wszystkie (3)”. Powtórz kontrolę przy szerokościach panelu 280, 360
   i 480 px; nie może pojawić się poziome przewijanie ani obcięcie akcji.
3. Kliknij pojedyncze „Maskuj” i sprawdź właściwe oznaczenie, nowy licznik oraz
   krótkie potwierdzenie bez powtórzonej liczby pozostałych wykryć.
4. Przygotuj tekst z czterema wystąpieniami tego samego syntetycznego telefonu.
   Kliknij akcję zbiorczą i sprawdź cztery kolejne oznaczenia po jednym zapisie.
5. Sprawdź wielowierszowy tekst z emoji, interpunkcją i istniejącym oznaczeniem;
   poza wykryciami treść nie może się zmienić.
6. Po pojedynczym maskowaniu kliknij „Cofnij”. Sprawdź dokładne przywrócenie
   tekstu i propozycji oraz brak drugiego poziomu cofania.
7. Po zbiorczym maskowaniu kliknij „Cofnij”. Cała paczka ma wrócić jednym
   kliknięciem, bez naruszenia wcześniejszej niezależnej podmiany.
8. Powtórz maskowanie, dopisz zdanie, a następnie ręcznie wróć do identycznego
   tekstu. Cofanie ma wygasnąć przy pierwszej edycji i nie może odżyć.
9. Sprawdź osobno wysłanie bez zmiany URL, zmianę rozmowy i powrót oraz zmianę
   aktywnej karty. W każdym przypadku stary przycisk „Cofnij” ma zniknąć.
10. Zmień tekst między analizą a kliknięciem. Stary plan nie może zostać użyty,
    a panel ma poprosić o sprawdzenie aktualnych wykryć.
11. Sprawdź szybkie podwójne kliknięcie, zmianę samego fokusu i kursora, stan bez
    wykryć, brak dostępu do pola, obsługę klawiaturą, wąski panel i brak
    automatycznego wysłania.
12. Przy liczniku `0` w sekcji `Do sprawdzenia` wpisz dwa razy `Jan Testowy`,
    zaznacz drugie wystąpienie i kliknij „Maskuj zaznaczenie”. Tylko drugi
    fragment ma zmienić się na `[DANE_1]`; następnie sprawdź „Cofnij”.
13. Sprawdź ręczne zaznaczenie myszą i klawiaturą w obu kierunkach, także dla
    kilku wierszy, polskich znaków i emoji. Tekst poza zakresem ma pozostać bez
    zmian, a przejście fokusu do panelu nie może zgubić wyboru.
14. W szkicu z trzema wierszami zaznacz i zamaskuj tylko pierwszy wiersz.
    Pozostałe granice wierszy nie mogą zniknąć; „Cofnij” ma odtworzyć dokładny
    układ sprzed podmiany.
15. Sprawdź wygasanie ręcznego wyboru po ustawieniu kursora, zaznaczeniu tekstu
    poza polem, edycji z powrotem do identycznej treści, innym maskowaniu,
    cofnięciu, wysłaniu, zmianie rozmowy, karty i pola.
16. Zaznacz część `[DANE_1]` i sprawdź odmowę. Osobny tekst w nawiasach, np.
    `[JSON]`, nie może zostać uznany za oznaczenie promptMask.
17. Sprawdź, że `[•••]` pojawia się nad prawą krawędzią edytora tylko dla
    poprawnego zaznaczenia, nie zasłania tekstu, działa myszą i klawiaturą oraz
    znika po użyciu albo unieważnieniu wyboru. Panel powinien pokazać ten sam
    sukces i „Cofnij”.
18. Powtórz odbiór osobno w drugiej przeglądarce.

Testy automatyczne używają atrapy DOM. Rzeczywisty odbiór trzeba wykonać osobno
w Chrome i Edge.

## Uprawnienia

- `sidePanel` — interfejs decyzji o maskowaniu,
- `https://chatgpt.com/*` — odczyt i modyfikacja natywnego edytora ChatGPT.

Rozszerzenie nie ma dostępu do wszystkich stron, schowka, cookies ani tokenów
sesji.

## Dokumentacja

Punktem wejścia jest [`docs/INDEX.md`](docs/INDEX.md). Zweryfikowany stan znajduje
się w [`docs/STATUS.md`](docs/STATUS.md), a ograniczenia w
[`docs/SECURITY.md`](docs/SECURITY.md).
