# Inwentaryzacja QR — spis sprzętu na Androidzie

Aplikacja Android do inwentaryzacji wyposażenia przypisanego do pracowników. Formularz zawiera podstawowe pola: imię, nazwisko, wybór sprzętu i numer seryjny (SN).

## Spis i skanowanie

1. Wpisz imię i nazwisko pracownika.
2. Wybierz sprzęt, np. komputer albo monitor.
3. Zeskanuj QR lub kod kreskowy z numerem seryjnym.
4. Jeśli skanowanie nie zadziała, wpisz SN ręcznie i wybierz **Dodaj ręcznie**.
5. Dodaj następnego pracownika lub kolejne urządzenie.

Aplikacja zapisuje typ odczytu na końcu tabeli: QR, kod kreskowy albo wpis ręczny. Wpisy można edytować bezpośrednio w tabeli. Dane są przechowywane lokalnie na telefonie.

## Własne kolumny

Przed skanowaniem możesz dodać własne kolumny i nazwać je według potrzeb, np. „Service Tag”, „Lokalizacja” albo „Uwagi”. Pojawią się w tabeli i eksporcie; wartości dla urządzeń uzupełnisz, edytując ich komórki. Można je pokazywać lub ukrywać bez kasowania danych.

## CSV i Excel

Eksport CSV oraz XLSX zawiera cztery podstawowe pola, aktywne własne kolumny oraz typ kodu. W polskim Excelu CSV można zaimportować przez **Dane → Z tekstu/CSV**, wybierając UTF-8 i separator przecinek.

## Podgląd interfejsu

Podglądy w folderze `screenshots/` są makietami interfejsu, nie zrzutami z uruchomionego urządzenia.

## Projekt i budowanie APK

Kompletny projekt Android Studio i źródła można pobrać jako [pakiet źródłowy](source/spis-sprzetu-zrodla-android.zip).

Wymagania: Android Studio, Android SDK 36, JDK 21 oraz Node.js 22 lub nowszy.

1. Uruchom `npm install`.
2. Wykonaj `npx cap sync android`.
3. W katalogu `android` uruchom `gradlew.bat assembleDebug`.
4. APK znajdziesz w `android/app/build/outputs/apk/debug/app-debug.apk`.

Manifest deklaruje uprawnienie do aparatu. APK 1.1 zbudował się poprawnie przez Gradle. Nie wykonano testu skanowania na fizycznym telefonie ani emulatorze.

## Licencja i pochodzenie

Projekt jest udostępniany na licencji MIT (plik [LICENSE](LICENSE)). Aplikacja bazuje na [AssetSnap IT Lens](https://github.com/conductorhythmn/android-it-inventory-scanner), również na licencji MIT, z dodanym przepływem spisu sprzętu przypisanego do użytkownika.
