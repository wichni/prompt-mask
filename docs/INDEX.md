# Dokumentacja promptMask

Ten indeks służy do wczytywania tylko potrzebnego kontekstu.

| Potrzeba | Przeczytaj |
| --- | --- |
| Aktualny stan, dowody i blokery | [`STATUS.md`](STATUS.md) |
| Cel, zakres i architektura | [`PROJECT.md`](PROJECT.md) |
| Dane, zaufanie i zagrożenia | [`SECURITY.md`](SECURITY.md) |
| Implementacja, testy i etapy | [`DEVELOPMENT.md`](DEVELOPMENT.md) |
| Instalacja i użycie | [`../README.md`](../README.md) |
| Reguły pracy agenta | [`../AGENTS.md`](../AGENTS.md) |

## Zasada aktualizacji

Każda informacja ma jeden dokument kanoniczny. Inne pliki powinny do niego
linkować zamiast kopiować treść. `STATUS.md` opisuje wyłącznie stan bieżący;
plany i niezatwierdzone możliwości należą do `PROJECT.md`.
