# Inwentaryzacja QR — spis sprzętu na Androidzie

Prosta aplikacja Android do spisu wyposażenia przypisanego do użytkowników. Wpisz imię i nazwisko, wybierz rodzaj sprzętu (np. komputer albo monitor), a następnie skanuj kody QR lub kreskowe z numerami seryjnymi kolejnych urządzeń. Każdy odczyt zapisuje się jako osobna pozycja z osobą, typem sprzętu i numerem seryjnym.

## Jak działa spis

1. Wpisz imię i nazwisko użytkownika.
2. Wybierz typ urządzenia.
3. Uruchom kamerę i zeskanuj numer seryjny z QR albo kodu kreskowego.
4. Zmień typ sprzętu i skanuj kolejne rzeczy tej samej osoby.
5. Naciśnij **Export CSV**, aby zapisać listę i zaimportować ją w Excelu.

Dane są przechowywane lokalnie na urządzeniu. Skanowane numery są sprawdzane pod kątem duplikatów. Można także eksportować plik XLSX.

## Excel i CSV

CSV zawiera osobne kolumny dla rodzaju sprzętu, użytkownika i numeru seryjnego. W polskiej wersji Excela wybierz **Dane → Z tekstu/CSV**, kodowanie **UTF-8** oraz separator **przecinek**. Alternatywnie użyj w aplikacji eksportu XLSX, który otwiera się bezpośrednio jako skoroszyt.

## Podgląd interfejsu

Poniższe grafiki pokazują przykładowy układ ekranu na telefonie. To makiety interfejsu, nie zrzuty z uruchomionego urządzenia.

![Formularz spisu](screenshots/podglad-formularza.svg)

![Lista zeskanowanych urządzeń](screenshots/podglad-listy.svg)

## Budowanie APK

Repo zawiera źródła interfejsu (katalog root/) oraz projekt Android Studio (katalog android/). Wymagania: Android Studio, Android SDK 36, JDK 21 oraz Node.js 22 lub nowszy.

1. Sklonuj repozytorium lub pobierz ZIP z GitHuba.
2. W katalogu głównym projektu uruchom npm install.
3. Wykonaj npx cap sync android, aby skopiować zasoby aplikacji do projektu Android.
4. W katalogu android uruchom gradlew.bat assembleDebug albo otwórz ten katalog w Android Studio.
5. APK debug znajdziesz w android/app/build/outputs/apk/debug/app-debug.apk.

Kompletny pakiet źródłowy jest też dostępny w [source/spis-sprzetu-zrodla-android.zip](source/spis-sprzetu-zrodla-android.zip).

## Status sprawdzenia

APK debug został zbudowany pomyślnie przez Gradle. Nie wykonano testu kamery na fizycznym telefonie ani na emulatorze; przed użyciem produkcyjnym sprawdź skanowanie na docelowym urządzeniu.

## Licencja i pochodzenie

Projekt jest udostępniany na licencji MIT (plik [LICENSE](LICENSE)). Aplikacja bazuje na [AssetSnap IT Lens](https://github.com/conductorhythmn/android-it-inventory-scanner), również na licencji MIT, z dodanym przepływem spisu sprzętu przypisanego do użytkownika.