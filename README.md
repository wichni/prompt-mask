# promptMask

Rozszerzenie Chromium, które lokalnie analizuje tekst wpisywany w natywnym
edytorze ChatGPT. Wykrycia pojawiają się w panelu bocznym, a użytkownik decyduje,
czy zamaskować pojedynczy fragment albo wszystkie aktualne wykrycia.

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

Cofanie ma jeden poziom i działa tylko tak długo, jak użytkownik nie zmienił
szkicu, pola, rozmowy ani aktywnej karty i nie wysłał wiadomości. Nowe udane
maskowanie zastępuje poprzednią możliwość cofnięcia. Po cofnięciu przywrócone
dane ponownie pojawiają się jako propozycje, ale drugie cofnięcie nie jest
dostępne.

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

- Node.js 22.12+
- npm 10+
- Chrome 114+ albo aktualny Microsoft Edge

```bash
npm install
npm run typecheck
npm test
npm run build
```

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
12. Powtórz odbiór osobno w drugiej przeglądarce.

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
