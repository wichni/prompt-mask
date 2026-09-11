# promptMask

Rozszerzenie Chromium, które lokalnie analizuje tekst wpisywany w natywnym
edytorze ChatGPT. Wykrycia pojawiają się w panelu bocznym, a użytkownik decyduje,
czy zamaskować pojedynczy fragment, wszystkie aktualne wykrycia albo własne
zaznaczenie.

## Działa obecnie

1. Użytkownik pisze normalnie w polu ChatGPT.
2. Content script lokalnie analizuje bieżący tekst.
3. Panel pokazuje możliwy PESEL, adres e-mail albo polski numer telefonu.
4. „Maskuj” zastępuje wyłącznie aktualny wykryty zakres oznaczeniem, np.
   `[PESEL_1]`.
5. „Maskuj wszystkie wykryte (N)” zatwierdza dokładnie aktualną listę i wykonuje
   wszystkie podmiany jednym zapisem do pola.
6. Po ponownej analizie panel potwierdza wykonaną operację. Brak kliknięcia
   pozostawia propozycje widoczne.
7. „Cofnij” przy ostatnim potwierdzeniu przywraca stan bieżącego pola ChatGPT
   sprzed pojedynczej podmiany albo całej podmiany zbiorczej.
8. „Maskuj zaznaczenie” zastępuje dokładnie jeden aktualnie zaznaczony fragment
   ogólnym oznaczeniem `[DANE_N]`, również gdy detektory niczego nie znalazły.
9. Przy poprawnym zaznaczeniu nad prawą krawędzią edytora pojawia się mały skrót
   `[•••]`, uruchamiający dokładnie tę samą ręczną operację.

Aby zamaskować fragment ręcznie, zaznacz go myszą albo klawiaturą w polu
wiadomości, a następnie kliknij `[•••]` przy edytorze albo „Maskuj zaznaczenie”
w panelu. Obie kontrolki korzystają z tej samej operacji. Jedna operacja zmienia
tylko jedno wskazane wystąpienie. Pusty wybór, same białe znaki oraz zakres
nachodzący na oznaczenie utworzone przez promptMask są odrzucane.

Cofanie ma jeden poziom i działa tylko tak długo, jak użytkownik nie zmienił
szkicu, pola, rozmowy ani aktywnej karty i nie wysłał wiadomości. Nowe udane
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
- Chrome 114+ albo aktualny Microsoft Edge

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
5. Kliknij ikonę promptMask, aby otworzyć panel boczny.

Po kolejnym buildzie kliknij „Odśwież” na karcie rozszerzenia, a następnie
odśwież stronę ChatGPT.

## Ręczny odbiór bieżącego etapu

Używaj wyłącznie danych utworzonych na potrzeby testu.

1. Wpisz do zwykłego pola ChatGPT syntetyczny e-mail, telefon i poprawny PESEL.
2. Sprawdź biało-niebieską paletę, trzy propozycje, licznik oraz aktywne
   „Maskuj wszystkie wykryte (3)”.
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
12. Przy liczniku `Do sprawdzenia: 0` wpisz dwa razy `Jan Testowy`, zaznacz
    drugie wystąpienie i kliknij „Maskuj zaznaczenie”. Tylko drugi fragment ma
    zmienić się na `[DANE_1]`; następnie sprawdź „Cofnij”.
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
