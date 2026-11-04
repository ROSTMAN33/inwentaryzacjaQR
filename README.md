# Inwentaryzacja QR — spis sprzętu na Androidzie

Aplikacja Android do ewidencji urządzeń przypisanych do pracowników. Zbiera imię, nazwisko, rodzaj sprzętu i numer seryjny (SN), odczytywany z kodu QR lub kreskowego.

## Jak działa spis

1. Wpisz imię i nazwisko pracownika.
2. Wybierz rodzaj urządzenia.
3. Zeskanuj kod QR albo kreskowy z numerem seryjnym.
4. Jeśli aparat nie odczyta kodu, wpisz SN ręcznie i wybierz **Dodaj ręcznie**.
5. Skanuj następne urządzenia tej samej osoby.
6. Przy kolejnym pracowniku użyj **Nowa osoba · wyczyść formularz**. Dotychczasowe wpisy zostaną zachowane.

Dane są przechowywane lokalnie na telefonie. Duplikaty SN są blokowane, a wpisy można edytować lub usunąć.

## Wygodniejsza praca na telefonie

Po skanie pod aparatem pojawiają się cztery ostatnie wpisy z osobą, sprzętem i numerem SN. Pełny spis na małym ekranie wyświetla pozycje jako pionowe karty z nazwami pól, bez poziomego przewijania tabeli. Karta skrótu pozwala przejść do edycji wpisu.

Skaner prosi o wyższą rozdzielczość i ciągłe ustawianie ostrości. Sprawdza QR i kody kreskowe naprzemiennie, by ograniczyć obciążenie telefonu. Latarka i przybliżenie są dostępne, gdy obsługuje je aparat.

## Własne kolumny

Możesz nazwać dodatkowe kolumny, np. „Service Tag”, „Lokalizacja” lub „Uwagi”. Są dostępne w spisie i eksporcie. Ich wartości uzupełnia się w edycji rekordu.

## Eksport

Dostępne są CSV oraz XLSX. Pliki zawierają podstawowe dane i aktywne własne kolumny. W Excelu CSV można wczytać przez **Dane → Z tekstu/CSV**, wybierając UTF-8 i separator przecinek.

## Pobieranie

- [Testowy APK Android](apk/spis-sprzetu-ergonomia.apk)
- [Pakiet źródeł Android Studio](source/spis-sprzetu-zrodla-android.zip)

APK jest podpisany testowym kluczem debug. Skanowanie pięciu kodów Code 128 zweryfikowano w dekoderze. Aparatu nie testowano na fizycznym telefonie.

## Podgląd

Pliki w `screenshots/` są makietami interfejsu, nie zrzutami z uruchomionego urządzenia.

## Budowanie aplikacji

Wymagane: Android Studio, Android SDK 36, JDK 21 oraz Node.js 22 lub nowszy.

1. Uruchom `npm install`.
2. Uruchom `npx cap sync android`.
3. W folderze `android` wykonaj `gradlew.bat assembleDebug`.
4. APK znajdziesz w `android/app/build/outputs/apk/debug/app-debug.apk`.

## Licencja

MIT — zobacz [LICENSE](LICENSE). Projekt bazuje na [AssetSnap IT Lens](https://github.com/conductorhythmn/android-it-inventory-scanner), również na licencji MIT.
