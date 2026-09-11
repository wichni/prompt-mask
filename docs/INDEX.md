# Dokumentacja promptMask

Ten indeks służy do wczytywania tylko potrzebnego kontekstu.

| Potrzeba | Przeczytaj |
| --- | --- |
| Aktualny stan, dowody i blokery | [`STATUS.md`](STATUS.md) |
| Cel, kierunek produktu i granice modułów | [`PROJECT.md`](PROJECT.md) |
| Dane, zaufanie i zagrożenia | [`SECURITY.md`](SECURITY.md) |
| Syntetyczny korpus medyczny i wyniki detekcji | [`MEDICAL_EVALUATION.md`](MEDICAL_EVALUATION.md) |
| Implementacja, testy, etapy i praca z kontekstem | [`DEVELOPMENT.md`](DEVELOPMENT.md) |
| Instalacja i użycie | [`../README.md`](../README.md) |
| Reguły pracy agenta | [`../AGENTS.md`](../AGENTS.md) |

Mapa odpowiedzialności katalogów znajduje się w
[`PROJECT.md`](PROJECT.md#warstwy), a dobór kontroli do rodzaju zmiany w
[`DEVELOPMENT.md`](DEVELOPMENT.md#testowanie). Nie powielaj tych map w nowych
dokumentach.

## Zasada aktualizacji

Każda informacja ma jeden dokument kanoniczny. Inne pliki powinny do niego
linkować zamiast kopiować treść. `STATUS.md` opisuje wyłącznie stan bieżący;
plany i niezatwierdzone możliwości należą do `PROJECT.md`.
